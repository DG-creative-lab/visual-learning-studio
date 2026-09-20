import { describe, expect, it } from 'vitest';
import { inspectEpisode } from '../src/application/inspectEpisode.js';
import type { DocumentProbe } from '../src/ports/documentProbe.js';
import type { EpisodeRepository, LoadedEpisodeProject } from '../src/ports/episodeRepository.js';
import type { LocalBindingsRepository } from '../src/ports/localBindingsRepository.js';
import type { LocalBindings } from '../src/source/localBindings.js';
import { episodeProjectSchema } from '../src/workflow/project.js';

const sourceDigest = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

class PreparedEpisodeRepository implements EpisodeRepository {
  async load(): Promise<LoadedEpisodeProject> {
    return {
      manifestPath: '/tmp/episode/episode.json',
      directory: '/tmp/episode',
      project: episodeProjectSchema.parse({
        schemaVersion: 'visual-learning.episode-project/v1',
        id: 'episode.prototype.v1',
        title: 'Prototype',
        source: {
          records: [
            {
              id: 'source.prototype',
              versionId: 'source.prototype.v1',
              contentDigest: sourceDigest,
              kind: 'paper',
              title: 'Prototype paper',
              authors: ['Example Author'],
              accessStatus: 'owner_supplied',
              rightsStatus: 'needs_review',
              rightsNote: 'Private analysis only until reviewed.',
              coverage: {
                scope: 'whole_source',
                mode: 'partial',
                inspected: 'Metadata and structure inspected.',
                exclusions: ['Full synthesis pending.'],
              },
            },
          ],
          claims: [],
        },
        editorial: {
          audience: {
            primary: 'Product designers',
            priorKnowledge: 'General design knowledge',
            decisionContext: 'Choose whether to read the source',
          },
          learningObjective: {
            id: 'objective.prototype',
            outcome: 'Explain one model.',
            evidenceOfLearning: 'Teach the model back.',
          },
          narrative: [],
          script: [],
        },
        distribution: {
          audiencePromise: {
            viewer: 'Product designers',
            problem: 'The source is too large to assess quickly.',
            promisedOutcome: 'Understand one useful model and decide whether to read further.',
            boundary: 'The episode is a guide, not a replacement for the source.',
            subscriptionReason: 'Continue learning evidence-grounded product-design models.',
          },
          packagingCandidates: [],
          derivatives: [],
        },
        production: { scenes: [], assets: [] },
        release: {},
      }),
    };
  }
}

class PreparedLocalBindingsRepository implements LocalBindingsRepository {
  async load(): Promise<LocalBindings> {
    return {
      schemaVersion: 'visual-learning.local-source-bindings/v1',
      sources: [{ sourceId: 'source.prototype', path: 'source.pdf' }],
    };
  }
}

class PreparedDocumentProbe implements DocumentProbe {
  async inspectPdf(absolutePath: string) {
    expect(absolutePath).toBe('/tmp/episode/source.pdf');
    return {
      contentDigest: sourceDigest,
      byteSize: 10_000,
      pageCount: 20,
      encrypted: false,
      format: 'pdf' as const,
    };
  }
}

describe('inspect episode use case', () => {
  it('binds a private local source without granting it synthesis authority', async () => {
    const inspection = await inspectEpisode('ignored.json', 'ignored.local.json', {
      episodes: new PreparedEpisodeRepository(),
      bindings: new PreparedLocalBindingsRepository(),
      documents: new PreparedDocumentProbe(),
    });

    expect(inspection.readiness.currentStage).toBe('sources_ready');
    expect(inspection.documents['source.prototype']?.pageCount).toBe(20);
  });
});
