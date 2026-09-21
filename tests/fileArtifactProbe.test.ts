import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { FileArtifactProbe } from '../src/adapters/fileArtifactProbe.js';
import type { ArtifactKind } from '../src/ports/artifactProbe.js';

const execFileAsync = promisify(execFile);

function zeroMdatPayload(source: Buffer): Buffer {
  const corrupted = Buffer.from(source);
  let offset = 0;
  while (offset + 8 <= corrupted.length) {
    let boxSize = corrupted.readUInt32BE(offset);
    const boxType = corrupted.toString('ascii', offset + 4, offset + 8);
    let headerSize = 8;
    if (boxSize === 1 && offset + 16 <= corrupted.length) {
      boxSize = Number(corrupted.readBigUInt64BE(offset + 8));
      headerSize = 16;
    } else if (boxSize === 0) {
      boxSize = corrupted.length - offset;
    }
    if (boxSize < headerSize || offset + boxSize > corrupted.length) break;
    if (boxType === 'mdat') {
      corrupted.fill(0, offset + headerSize, offset + boxSize);
      return corrupted;
    }
    offset += boxSize;
  }
  throw new Error('Generated MP4 did not contain an mdat box.');
}

async function observe(artifactPath: string, expectedKind: ArtifactKind, maxByteSize = 1_048_576) {
  return new FileArtifactProbe().observe({
    absolutePath: artifactPath,
    expectedKind,
    maxByteSize,
  });
}

describe('file artifact probe', () => {
  it('requires decodable media with positive duration and captions with a valid cue', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'visual-learning-artifact-'));
    const audioPath = path.join(directory, 'voice.wav');
    const videoPath = path.join(directory, 'episode.mp4');
    const captionsPath = path.join(directory, 'captions.vtt');
    const srtPath = path.join(directory, 'captions.srt');

    try {
      await execFileAsync('ffmpeg', [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=0.2',
        '-c:a',
        'pcm_s16le',
        audioPath,
      ]);
      await execFileAsync('ffmpeg', [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=16x16:d=0.2',
        '-an',
        '-c:v',
        'mpeg4',
        videoPath,
      ]);
      const captions = 'WEBVTT\n\n00:00.000 --> 00:01.000\nA real cue.\n';
      const srt = '1\n00:00:00,000 --> 00:00:01,000\nA real cue.\n';
      await writeFile(captionsPath, captions);
      await writeFile(srtPath, srt);

      const [audio, video, captionObservation, srtObservation] = await Promise.all([
        observe(audioPath, 'audio'),
        observe(videoPath, 'video'),
        observe(captionsPath, 'captions'),
        observe(srtPath, 'captions'),
      ]);

      expect(audio.mediaKind).toBe('audio');
      expect(audio.durationSeconds).toBeGreaterThan(0);
      expect(video.mediaKind).toBe('video');
      expect(video.durationSeconds).toBeGreaterThan(0);
      expect(captionObservation).toMatchObject({ mediaKind: 'captions', cueCount: 1 });
      expect(srtObservation).toMatchObject({ mediaKind: 'captions', cueCount: 1 });
      expect(captionObservation.contentDigest).toBe(
        createHash('sha256').update(captions).digest('hex'),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects media whose metadata survives but whose payload cannot decode', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'visual-learning-corrupt-media-'));
    const validPath = path.join(directory, 'valid.mp4');
    const corruptedPath = path.join(directory, 'corrupted.mp4');

    try {
      await execFileAsync('ffmpeg', [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=32x32:rate=10:duration=1',
        '-an',
        '-c:v',
        'mpeg4',
        validPath,
      ]);
      await writeFile(corruptedPath, zeroMdatPayload(await readFile(validPath)));

      await expect(observe(corruptedPath, 'video')).rejects.toThrow('ffmpeg rejected');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects a WebVTT prefix that is not a standards-compliant header', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'visual-learning-invalid-vtt-'));
    const captionsPath = path.join(directory, 'invalid.vtt');
    await writeFile(
      captionsPath,
      'WEBVTT-not-a-valid-header\n\n00:00.000 --> 00:01.000\nA misleading cue.\n',
    );

    try {
      await expect(observe(captionsPath, 'captions')).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each([
    {
      name: 'empty WebVTT payload',
      extension: 'vtt',
      contents: 'WEBVTT\n\n00:00.000 --> 00:01.000\n\n',
    },
    {
      name: 'zero-duration WebVTT cue',
      extension: 'vtt',
      contents: 'WEBVTT\n\n00:00.000 --> 00:00.000\nNo duration.\n',
    },
    {
      name: 'reversed WebVTT cue',
      extension: 'vtt',
      contents: 'WEBVTT\n\n00:01.000 --> 00:00.000\nReversed.\n',
    },
    {
      name: 'empty SRT payload',
      extension: 'srt',
      contents: '1\n00:00:00,000 --> 00:00:01,000\n\n',
    },
    {
      name: 'zero-duration SRT cue',
      extension: 'srt',
      contents: '1\n00:00:00,000 --> 00:00:00,000\nNo duration.\n',
    },
    {
      name: 'reversed SRT cue',
      extension: 'srt',
      contents: '1\n00:00:01,000 --> 00:00:00,000\nReversed.\n',
    },
  ])('rejects $name', async ({ extension, contents }) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'visual-learning-invalid-cue-'));
    const captionsPath = path.join(directory, `invalid.${extension}`);
    await writeFile(captionsPath, contents);

    try {
      await expect(observe(captionsPath, 'captions')).rejects.toThrow('positive-duration cue');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each([
    {
      name: 'whitespace-only WebVTT cue',
      extension: 'vtt',
      contents: 'WEBVTT\n\n00:00.000 --> 00:01.000\n \t \n',
    },
    {
      name: 'whitespace-only SRT cue',
      extension: 'srt',
      contents: '1\n00:00:00,000 --> 00:00:01,000\n \t \n',
    },
    {
      name: 'markup-only WebVTT cue',
      extension: 'vtt',
      contents: 'WEBVTT\n\n00:00.000 --> 00:01.000\n<b></b>\n',
    },
    {
      name: 'markup-only SRT cue',
      extension: 'srt',
      contents: '1\n00:00:00,000 --> 00:00:01,000\n<i></i>\n',
    },
    {
      name: 'invisible-entity-only WebVTT cue',
      extension: 'vtt',
      contents: 'WEBVTT\n\n00:00.000 --> 00:01.000\n&nbsp;\n',
    },
    {
      name: 'invisible-entity-only SRT cue',
      extension: 'srt',
      contents: '1\n00:00:00,000 --> 00:00:01,000\n&#8203;\n',
    },
    {
      name: 'markup-wrapped invisible entity',
      extension: 'vtt',
      contents: 'WEBVTT\n\n00:00.000 --> 00:01.000\n<b>&lrm;</b>\n',
    },
    {
      name: 'raw zero-width character',
      extension: 'srt',
      contents: '1\n00:00:00,000 --> 00:00:01,000\n\u200b\n',
    },
    {
      name: 'unrecognized entity-only cue',
      extension: 'vtt',
      contents: 'WEBVTT\n\n00:00.000 --> 00:01.000\n&ZeroWidthSpace;\n',
    },
  ])('rejects $name', async ({ extension, contents }) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'visual-learning-invisible-cue-'));
    const captionsPath = path.join(directory, `invisible.${extension}`);
    await writeFile(captionsPath, contents);

    try {
      await expect(observe(captionsPath, 'captions')).rejects.toThrow('viewer-visible text');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('counts only positive-duration caption cues with viewer-visible text', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'visual-learning-mixed-cues-'));
    const captionsPath = path.join(directory, 'mixed.vtt');
    await writeFile(
      captionsPath,
      [
        'WEBVTT',
        '',
        '00:00.000 --> 00:00.000',
        'No duration.',
        '',
        '00:01.000 --> 00:02.000',
        '<b>A usable cue.</b>',
        '',
      ].join('\n'),
    );

    try {
      await expect(observe(captionsPath, 'captions')).resolves.toMatchObject({ cueCount: 1 });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('accepts valid captions above the former hex-output ceiling', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'visual-learning-large-captions-'));
    const captionsPath = path.join(directory, 'large.vtt');
    const payload = 'A'.repeat(1_100_000);
    await writeFile(captionsPath, `WEBVTT\n\n00:00.000 --> 00:01.000\n${payload}\n`);

    try {
      await expect(observe(captionsPath, 'captions', 20_971_520)).resolves.toMatchObject({
        mediaKind: 'captions',
        cueCount: 1,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 20_000);

  it('rejects signature-only files that are not usable media or captions', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'visual-learning-truncated-'));
    const videoPath = path.join(directory, 'truncated.mp4');
    const audioPath = path.join(directory, 'truncated.wav');
    const captionsPath = path.join(directory, 'truncated.vtt');
    await writeFile(videoPath, Buffer.concat([Buffer.from([0, 0, 0, 8]), Buffer.from('ftyp')]));
    await writeFile(
      audioPath,
      Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]),
    );
    await writeFile(captionsPath, 'WEBVTT');

    try {
      await expect(observe(videoPath, 'video')).rejects.toThrow();
      await expect(observe(audioPath, 'audio')).rejects.toThrow();
      await expect(observe(captionsPath, 'captions')).rejects.toThrow('positive-duration cue');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects empty, oversized, malformed, and non-regular artifacts', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'visual-learning-artifact-'));
    const emptyPath = path.join(directory, 'empty.wav');
    const oversizedPath = path.join(directory, 'oversized.wav');
    const malformedPath = path.join(directory, 'malformed.m4a');
    const nestedDirectory = path.join(directory, 'directory.wav');
    await writeFile(emptyPath, Buffer.alloc(0));
    await writeFile(
      oversizedPath,
      Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt ')]),
    );
    await writeFile(malformedPath, 'not media');
    await mkdir(nestedDirectory);

    try {
      await expect(observe(emptyPath, 'audio')).rejects.toThrow('rejects empty files');
      await expect(observe(oversizedPath, 'audio', 8)).rejects.toThrow('inspection limit');
      await expect(observe(malformedPath, 'audio')).rejects.toThrow();
      await expect(observe(nestedDirectory, 'audio')).rejects.toThrow('regular file');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
