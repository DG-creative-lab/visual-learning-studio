import { realpath } from 'node:fs/promises';
import path from 'node:path';
import type {
  ArtifactKind,
  ArtifactObservation,
  ArtifactProbe,
  VoiceRenderReceipt,
  VoiceRenderReceiptProbe,
} from '../ports/artifactProbe.js';
import type { DocumentObservation, DocumentProbe } from '../ports/documentProbe.js';
import type { EpisodeRepository } from '../ports/episodeRepository.js';
import type { LocalBindingsRepository } from '../ports/localBindingsRepository.js';
import { deriveEpisodeReadiness, type EpisodeReadiness } from '../workflow/readiness.js';
import type { EpisodeProject } from '../workflow/project.js';

const artifactByteLimits: Readonly<Record<ArtifactKind, number>> = {
  audio: 1_073_741_824,
  video: 17_179_869_184,
  captions: 20_971_520,
};

interface ArtifactSpec {
  readonly manifestPath: string;
  readonly kind: ArtifactKind;
}

async function containedArtifactPath(
  episodeDirectory: string,
  manifestPath: string,
): Promise<string> {
  if (path.isAbsolute(manifestPath) || path.win32.isAbsolute(manifestPath)) {
    throw new Error('Artifact paths must be relative to the episode directory.');
  }

  const episodeRoot = await realpath(episodeDirectory);
  const resolvedArtifact = await realpath(path.resolve(episodeRoot, manifestPath));
  const relativePath = path.relative(episodeRoot, resolvedArtifact);
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error('Artifact path resolves outside the episode directory.');
  }

  return resolvedArtifact;
}

export interface InspectEpisodeDependencies {
  readonly episodes: EpisodeRepository;
  readonly bindings: LocalBindingsRepository;
  readonly documents: DocumentProbe;
  readonly artifacts: ArtifactProbe;
  readonly voiceRenderReceipts?: VoiceRenderReceiptProbe;
}

export interface EpisodeInspection {
  readonly project: EpisodeProject;
  readonly documents: Readonly<Record<string, DocumentObservation>>;
  readonly artifacts: Readonly<Record<string, ArtifactObservation>>;
  readonly voiceRenderReceipts: Readonly<Record<string, VoiceRenderReceipt>>;
  readonly readiness: EpisodeReadiness;
}

export async function inspectEpisode(
  manifestPath: string,
  bindingsPath: string,
  dependencies: InspectEpisodeDependencies,
): Promise<EpisodeInspection> {
  const loaded = await dependencies.episodes.load(manifestPath);
  const localBindings = await dependencies.bindings.load(bindingsPath);
  const bindingBySourceId = new Map(
    localBindings.sources.map((binding) => [binding.sourceId, binding.path]),
  );
  const documents: Record<string, DocumentObservation> = {};
  const documentErrors: Record<string, string> = {};
  const artifacts: Record<string, ArtifactObservation> = {};
  const voiceRenderReceipts: Record<string, VoiceRenderReceipt> = {};

  for (const source of loaded.project.source.records) {
    const boundPath = bindingBySourceId.get(source.id);
    if (boundPath === undefined) {
      documentErrors[source.id] = `No local document is bound to source ${source.id}.`;
      continue;
    }

    const absolutePath = path.resolve(loaded.directory, boundPath);
    try {
      documents[source.id] = await dependencies.documents.inspectPdf(absolutePath);
    } catch (error) {
      documentErrors[source.id] =
        error instanceof Error ? error.message : `Source ${source.id} could not be inspected.`;
    }
  }

  const artifactSpecs: ArtifactSpec[] = [];
  if (loaded.project.production.audio !== undefined) {
    artifactSpecs.push({ manifestPath: loaded.project.production.audio.path, kind: 'audio' });
  }
  if (loaded.project.release.candidate !== undefined) {
    artifactSpecs.push(
      { manifestPath: loaded.project.release.candidate.videoPath, kind: 'video' },
      { manifestPath: loaded.project.release.candidate.captionsPath, kind: 'captions' },
    );
  }

  for (const artifact of artifactSpecs) {
    try {
      const absolutePath = await containedArtifactPath(loaded.directory, artifact.manifestPath);
      artifacts[artifact.manifestPath] = await dependencies.artifacts.observe({
        absolutePath,
        expectedKind: artifact.kind,
        maxByteSize: artifactByteLimits[artifact.kind],
      });
    } catch {
      // Invalid, missing, escaped, or unreadable artifacts remain unobserved and cannot authorize readiness.
    }
  }

  if (
    loaded.project.production.audio !== undefined &&
    dependencies.voiceRenderReceipts !== undefined
  ) {
    const audioPath = loaded.project.production.audio.path;
    try {
      voiceRenderReceipts[audioPath] = await dependencies.voiceRenderReceipts.observe(audioPath);
    } catch {
      // An unavailable provider receipt cannot authorize the audio artifact.
    }
  }

  const readiness = deriveEpisodeReadiness(loaded.project, {
    documents,
    documentErrors,
    artifacts,
    voiceRenderReceipts,
  });

  return {
    project: loaded.project,
    documents,
    artifacts,
    voiceRenderReceipts,
    readiness,
  };
}
