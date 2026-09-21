import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, type Stats } from 'node:fs';
import { lstat, open, type FileHandle } from 'node:fs/promises';
import type {
  ArtifactObservation,
  ArtifactProbe,
  ArtifactProbeRequest,
} from '../ports/artifactProbe.js';

const probeTimeoutMilliseconds = 30_000;
const decodeTimeoutMilliseconds = 600_000;
const toolOutputLimitBytes = 4_194_304;

interface FfprobeMediaOutput {
  readonly streams?: ReadonlyArray<{
    readonly codec_type?: string;
    readonly duration?: string;
  }>;
  readonly format?: { readonly duration?: string };
}

interface ToolOutput {
  readonly stdout: string;
  readonly stderr: string;
}

async function sha256File(
  handle: FileHandle,
  maxByteSize: number,
): Promise<{ readonly contentDigest: string; readonly byteSize: number }> {
  const digest = createHash('sha256');
  let observedBytes = 0;
  for await (const chunk of handle.createReadStream({ start: 0, autoClose: false })) {
    observedBytes += chunk.length;
    if (observedBytes > maxByteSize) {
      throw new Error(`Artifact exceeds the ${maxByteSize}-byte inspection limit.`);
    }
    digest.update(chunk);
  }
  return { contentDigest: digest.digest('hex'), byteSize: observedBytes };
}

async function runMediaTool(
  command: 'ffmpeg' | 'ffprobe',
  argumentsBeforeInput: readonly string[],
  argumentsAfterInput: readonly string[],
  handle: FileHandle,
  timeoutMilliseconds: number,
): Promise<ToolOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...argumentsBeforeInput, '/dev/fd/3', ...argumentsAfterInput], {
      stdio: ['ignore', 'pipe', 'pipe', handle.fd],
    });
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error !== undefined) reject(error);
      else resolve({ stdout, stderr });
    };

    const addOutput = (chunk: Buffer, destination: 'stdout' | 'stderr') => {
      outputBytes += chunk.length;
      if (outputBytes > toolOutputLimitBytes) {
        child.kill('SIGKILL');
        finish(new Error(`${command} exceeded its output limit.`));
        return;
      }
      if (destination === 'stdout') stdout += chunk.toString('utf8');
      else stderr += chunk.toString('utf8');
    };

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error(`${command} timed out while validating the artifact.`));
    }, timeoutMilliseconds);

    child.stdout!.on('data', (chunk: Buffer) => addOutput(chunk, 'stdout'));
    child.stderr!.on('data', (chunk: Buffer) => addOutput(chunk, 'stderr'));
    child.on('error', (error) => finish(error));
    child.on('close', (code) => {
      finish(
        code === 0 ? undefined : new Error(`${command} rejected the artifact: ${stderr.trim()}`),
      );
    });
  });
}

function parseJson<T>(command: string, output: string): T {
  try {
    return JSON.parse(output) as T;
  } catch {
    throw new Error(`${command} returned invalid JSON.`);
  }
}

function positiveDuration(output: FfprobeMediaOutput, expectedStream: 'audio' | 'video'): number {
  const matchingStreams = (output.streams ?? []).filter(
    (stream) => stream.codec_type === expectedStream,
  );
  if (matchingStreams.length === 0) {
    throw new Error(`Media artifact has no ${expectedStream} stream.`);
  }

  const durations = [output.format?.duration, ...matchingStreams.map((stream) => stream.duration)]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  const duration = Math.max(...durations);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Media artifact has no positive ${expectedStream} duration.`);
  }
  return duration;
}

function assertSameFile(expected: Stats, observed: Stats): void {
  if (
    !observed.isFile() ||
    observed.dev !== expected.dev ||
    observed.ino !== expected.ino ||
    observed.size !== expected.size ||
    observed.mtimeMs !== expected.mtimeMs
  ) {
    throw new Error('Artifact changed while it was being inspected.');
  }
}

const captionEntities: Readonly<Record<string, string>> = {
  amp: '&',
  ensp: '\u2002',
  emsp: '\u2003',
  gt: '>',
  lrm: '\u200e',
  lt: '<',
  nbsp: '\u00a0',
  rlm: '\u200f',
  shy: '\u00ad',
  thinsp: '\u2009',
  zwj: '\u200d',
  zwnj: '\u200c',
};

function decodeCaptionEntities(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi, (_entity, decimal, hex, named) => {
    if (named !== undefined) return captionEntities[String(named).toLowerCase()] ?? '';
    const codePoint = Number.parseInt(String(decimal ?? hex), decimal === undefined ? 16 : 10);
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return '';
    }
  });
}

function hasViewerVisibleText(decoded: string): boolean {
  const text = decodeCaptionEntities(
    decoded
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\{\\[^}\r\n]*\}/g, '')
      .replace(/<\/?[a-z][^>\r\n]*>/gi, '')
      .replace(/<\d{2}:\d{2}(?::\d{2})?[.,]\d{3}>/g, ''),
  );
  return /[\p{L}\p{N}\p{P}\p{S}]/u.test(text);
}

interface CaptionPacketState {
  durationSeconds: number;
  expectedSize: number;
  payload?: Buffer;
  payloadOffset: number;
  readingPayload: boolean;
}

async function inspectCaptionPackets(handle: FileHandle, maxByteSize: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        's:0',
        '-show_packets',
        '-show_data',
        '-show_entries',
        'packet=duration_time,size,data',
        '-of',
        'default',
        '/dev/fd/3',
      ],
      { stdio: ['ignore', 'pipe', 'pipe', handle.fd] },
    );
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const transformedOutputLimit = maxByteSize * 8 + 1_048_576;
    let pending = '';
    let outputBytes = 0;
    let errorOutput = '';
    let packet: CaptionPacketState | undefined;
    let cueCount = 0;
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error !== undefined) reject(error);
      else resolve(cueCount);
    };

    const finishPacket = () => {
      if (packet === undefined) throw new Error('ffprobe returned an unmatched packet terminator.');
      const current = packet;
      packet = undefined;
      if (
        current.payload === undefined ||
        current.payloadOffset !== current.expectedSize ||
        !Number.isFinite(current.durationSeconds) ||
        current.durationSeconds <= 0
      ) {
        return;
      }
      try {
        if (hasViewerVisibleText(decoder.decode(current.payload))) cueCount += 1;
      } catch {
        // A packet that is not valid UTF-8 cannot establish usable caption text.
      }
    };

    const consumeLine = (line: string) => {
      if (line === '[PACKET]') {
        if (packet !== undefined) throw new Error('ffprobe returned nested caption packets.');
        packet = {
          durationSeconds: Number.NaN,
          expectedSize: -1,
          payloadOffset: 0,
          readingPayload: false,
        };
        return;
      }
      if (line === '[/PACKET]') {
        finishPacket();
        return;
      }
      if (packet === undefined) return;
      if (line.startsWith('duration_time=')) {
        packet.durationSeconds = Number(line.slice('duration_time='.length));
        return;
      }
      if (line.startsWith('size=')) {
        const size = Number(line.slice('size='.length));
        if (!Number.isInteger(size) || size < 0 || size > maxByteSize) {
          throw new Error('ffprobe returned an invalid caption packet size.');
        }
        packet.expectedSize = size;
        return;
      }
      if (line === 'data=') {
        if (packet.expectedSize < 0) throw new Error('ffprobe omitted the caption packet size.');
        packet.payload = Buffer.alloc(packet.expectedSize);
        packet.readingPayload = true;
        return;
      }
      if (!packet.readingPayload || !/^[\da-f]+:/i.test(line)) return;
      const colon = line.indexOf(':');
      const hexColumn = line
        .slice(colon + 1)
        .trimStart()
        .split(/\s{2,}/, 1)[0];
      const hex = (hexColumn ?? '').replace(/\s/g, '');
      if (hex.length === 0 || hex.length % 2 !== 0 || !/^[\da-f]+$/i.test(hex)) {
        throw new Error('ffprobe returned malformed caption packet data.');
      }
      const bytes = Buffer.from(hex, 'hex');
      if (
        packet.payload === undefined ||
        packet.payloadOffset + bytes.length > packet.expectedSize
      ) {
        throw new Error('ffprobe returned caption data beyond its declared packet size.');
      }
      bytes.copy(packet.payload, packet.payloadOffset);
      packet.payloadOffset += bytes.length;
    };

    const consumeLines = () => {
      let newline = pending.indexOf('\n');
      while (newline >= 0) {
        consumeLine(pending.slice(0, newline).replace(/\r$/, ''));
        pending = pending.slice(newline + 1);
        newline = pending.indexOf('\n');
      }
      if (pending.length > 4_096)
        throw new Error('ffprobe returned an overlong caption-data line.');
    };

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('ffprobe timed out while validating the caption artifact.'));
    }, probeTimeoutMilliseconds);

    child.stdout!.on('data', (chunk: Buffer) => {
      try {
        outputBytes += chunk.length;
        if (outputBytes > transformedOutputLimit) {
          child.kill('SIGKILL');
          finish(new Error('ffprobe exceeded the bounded caption-output limit.'));
          return;
        }
        pending += chunk.toString('utf8');
        consumeLines();
      } catch (error) {
        child.kill('SIGKILL');
        finish(error instanceof Error ? error : new Error('Caption packets could not be decoded.'));
      }
    });
    child.stderr!.on('data', (chunk: Buffer) => {
      if (Buffer.byteLength(errorOutput) + chunk.length > toolOutputLimitBytes) {
        child.kill('SIGKILL');
        finish(new Error('ffprobe exceeded its error-output limit.'));
        return;
      }
      errorOutput += chunk.toString('utf8');
    });
    child.on('error', (error) => finish(error));
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        finish(new Error(`ffprobe rejected the caption artifact: ${errorOutput.trim()}`));
        return;
      }
      try {
        if (pending.length > 0) consumeLine(pending.replace(/\r$/, ''));
        if (packet !== undefined)
          throw new Error('ffprobe returned an unterminated caption packet.');
        finish();
      } catch (error) {
        finish(error instanceof Error ? error : new Error('Caption packets could not be decoded.'));
      }
    });
  });
}

async function withValidationHandle<T>(
  absolutePath: string,
  expected: Stats,
  operation: (handle: FileHandle) => Promise<T>,
): Promise<T> {
  const handle = await open(
    absolutePath,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    assertSameFile(expected, await handle.stat());
    return await operation(handle);
  } finally {
    await handle.close();
  }
}

async function inspectMedia(
  absolutePath: string,
  expected: Stats,
  expectedKind: 'audio' | 'video',
): Promise<number> {
  const metadata = await withValidationHandle(absolutePath, expected, async (handle) => {
    const output = await runMediaTool(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'stream=codec_type,duration:format=duration', '-of', 'json'],
      [],
      handle,
      probeTimeoutMilliseconds,
    );
    return parseJson<FfprobeMediaOutput>('ffprobe', output.stdout);
  });
  const duration = positiveDuration(metadata, expectedKind);

  const decode = await withValidationHandle(absolutePath, expected, async (handle) =>
    runMediaTool(
      'ffmpeg',
      ['-v', 'error', '-xerror', '-nostdin', '-progress', 'pipe:1', '-i'],
      ['-map', expectedKind === 'audio' ? '0:a:0' : '0:v:0', '-f', 'null', '-'],
      handle,
      decodeTimeoutMilliseconds,
    ),
  );
  const progressValues =
    expectedKind === 'video'
      ? [...decode.stdout.matchAll(/^frame=(\d+)$/gm)].map((match) => Number(match[1]))
      : [...decode.stdout.matchAll(/^out_time_us=(\d+)$/gm)].map((match) => Number(match[1]));
  if (!progressValues.some((value) => Number.isFinite(value) && value > 0)) {
    throw new Error(`Media artifact produced no decoded ${expectedKind} output.`);
  }

  return duration;
}

async function inspectCaptions(
  absolutePath: string,
  expected: Stats,
  maxByteSize: number,
): Promise<number> {
  const cueCount = await withValidationHandle(absolutePath, expected, (handle) =>
    inspectCaptionPackets(handle, maxByteSize),
  );
  if (cueCount === 0) {
    throw new Error(
      'Caption artifact has no standards-compliant, positive-duration cue with viewer-visible text.',
    );
  }
  return cueCount;
}

export class FileArtifactProbe implements ArtifactProbe {
  async observe(request: ArtifactProbeRequest): Promise<ArtifactObservation> {
    const pathEntry = await lstat(request.absolutePath);
    if (!pathEntry.isFile()) {
      throw new Error('Artifact inspection requires a regular file.');
    }
    if (pathEntry.size <= 0) {
      throw new Error('Artifact inspection rejects empty files.');
    }
    if (pathEntry.size > request.maxByteSize) {
      throw new Error(`Artifact exceeds the ${request.maxByteSize}-byte inspection limit.`);
    }

    const handle = await open(
      request.absolutePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const before = await handle.stat();
      assertSameFile(pathEntry, before);

      const usability =
        request.expectedKind === 'captions'
          ? {
              cueCount: await inspectCaptions(request.absolutePath, before, request.maxByteSize),
            }
          : {
              durationSeconds: await inspectMedia(
                request.absolutePath,
                before,
                request.expectedKind,
              ),
            };

      const observation = await sha256File(handle, request.maxByteSize);
      assertSameFile(before, await handle.stat());
      if (observation.byteSize !== before.size) {
        throw new Error('Artifact changed while it was being inspected.');
      }

      return { ...observation, mediaKind: request.expectedKind, ...usability };
    } finally {
      await handle.close();
    }
  }
}
