import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectEpisode } from '../src/application/inspectEpisode.js';
import type { ArtifactProbe, ArtifactProbeRequest } from '../src/ports/artifactProbe.js';
import type { DocumentProbe } from '../src/ports/documentProbe.js';
import type { EpisodeRepository, LoadedEpisodeProject } from '../src/ports/episodeRepository.js';
import type { LocalBindingsRepository } from '../src/ports/localBindingsRepository.js';
import type { LocalBindings } from '../src/source/localBindings.js';
import { episodeProjectSchema } from '../src/workflow/project.js';

const sourceDigest = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

class PreparedEpisodeRepository implements EpisodeRepository {
  constructor(
    private readonly directory: string,
    private readonly audioPath = 'audio/voice.m4a',
  ) {}

  async load(): Promise<LoadedEpisodeProject> {
    return {
      manifestPath: path.join(this.directory, 'episode.json'),
      directory: this.directory,
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
        production: {
          audio: {
            path: this.audioPath,
            origin: 'generated',
            contentDigest: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            durationSeconds: 20,
          },
          scenes: [],
          assets: [],
        },
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
  constructor(private readonly directory: string) {}

  async inspectPdf(absolutePath: string) {
    expect(absolutePath).toBe(path.join(this.directory, 'source.pdf'));
    return {
      contentDigest: sourceDigest,
      byteSize: 10_000,
      pageCount: 20,
      encrypted: false,
      format: 'pdf' as const,
    };
  }
}

class PreparedArtifactProbe implements ArtifactProbe {
  readonly requests: ArtifactProbeRequest[] = [];

  async observe(request: ArtifactProbeRequest) {
    this.requests.push(request);
    return {
      contentDigest: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      byteSize: 100_000,
      mediaKind: request.expectedKind,
      durationSeconds: 20,
    };
  }
}

describe('inspect episode use case', () => {
  it('binds a private local source without granting it synthesis authority', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'visual-learning-episode-'));
    await mkdir(path.join(directory, 'audio'));
    await writeFile(path.join(directory, 'audio/voice.m4a'), 'placeholder');
    const artifacts = new PreparedArtifactProbe();

    try {
      const inspection = await inspectEpisode('ignored.json', 'ignored.local.json', {
        episodes: new PreparedEpisodeRepository(directory),
        bindings: new PreparedLocalBindingsRepository(),
        documents: new PreparedDocumentProbe(directory),
        artifacts,
      });

      expect(inspection.readiness.currentStage).toBe('sources_ready');
      expect(inspection.documents['source.prototype']?.pageCount).toBe(20);
      expect(inspection.artifacts['audio/voice.m4a']?.byteSize).toBe(100_000);
      expect(artifacts.requests).toEqual([
        {
          absolutePath: await realpath(path.join(directory, 'audio/voice.m4a')),
          expectedKind: 'audio',
          maxByteSize: 1_073_741_824,
        },
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each(['/etc/hosts', '../outside.m4a'])(
    'does not inspect a manifest artifact path outside the episode directory: %s',
    async (artifactPath) => {
      const parent = await mkdtemp(path.join(os.tmpdir(), 'visual-learning-containment-'));
      const directory = path.join(parent, 'episode');
      await mkdir(directory);
      await writeFile(path.join(parent, 'outside.m4a'), 'outside');
      const artifacts = new PreparedArtifactProbe();

      try {
        const inspection = await inspectEpisode('ignored.json', 'ignored.local.json', {
          episodes: new PreparedEpisodeRepository(directory, artifactPath),
          bindings: new PreparedLocalBindingsRepository(),
          documents: new PreparedDocumentProbe(directory),
          artifacts,
        });

        expect(artifacts.requests).toEqual([]);
        expect(inspection.artifacts).toEqual({});
        expect(inspection.readiness.blockers.map((item) => item.code)).toContain(
          'audio.artifact_unobserved',
        );
      } finally {
        await rm(parent, { recursive: true, force: true });
      }
    },
  );

  it('does not follow an in-directory symlink to an artifact outside the episode directory', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'visual-learning-symlink-'));
    const directory = path.join(parent, 'episode');
    await mkdir(path.join(directory, 'audio'), { recursive: true });
    await writeFile(path.join(parent, 'outside.m4a'), 'outside');
    await symlink(path.join(parent, 'outside.m4a'), path.join(directory, 'audio/voice.m4a'));
    const artifacts = new PreparedArtifactProbe();

    try {
      const inspection = await inspectEpisode('ignored.json', 'ignored.local.json', {
        episodes: new PreparedEpisodeRepository(directory),
        bindings: new PreparedLocalBindingsRepository(),
        documents: new PreparedDocumentProbe(directory),
        artifacts,
      });

      expect(artifacts.requests).toEqual([]);
      expect(inspection.artifacts).toEqual({});
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
});
