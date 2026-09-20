import path from 'node:path';
import type { DocumentObservation, DocumentProbe } from '../ports/documentProbe.js';
import type { EpisodeRepository } from '../ports/episodeRepository.js';
import type { LocalBindingsRepository } from '../ports/localBindingsRepository.js';
import { deriveEpisodeReadiness, type EpisodeReadiness } from '../workflow/readiness.js';
import type { EpisodeProject } from '../workflow/project.js';

export interface InspectEpisodeDependencies {
  readonly episodes: EpisodeRepository;
  readonly bindings: LocalBindingsRepository;
  readonly documents: DocumentProbe;
}

export interface EpisodeInspection {
  readonly project: EpisodeProject;
  readonly documents: Readonly<Record<string, DocumentObservation>>;
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

  const readiness = deriveEpisodeReadiness(loaded.project, {
    documents,
    documentErrors,
  });

  return {
    project: loaded.project,
    documents,
    readiness,
  };
}
