import { describe, expect, it } from 'vitest';
import { releaseCandidateDigest, type ReleaseCandidate } from '../src/release/contracts.js';
import { claimRecordSchema } from '../src/source/contracts.js';
import { episodeProjectSchema, type EpisodeProject } from '../src/workflow/project.js';
import { deriveEpisodeReadiness } from '../src/workflow/readiness.js';

const sourceDigest = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function observedSource() {
  return {
    documents: {
      'source.emotional-design': {
        contentDigest: sourceDigest,
        byteSize: 10_000,
        pageCount: 200,
        encrypted: false,
        format: 'pdf' as const,
      },
    },
    documentErrors: {},
  };
}

function completeProject(): EpisodeProject {
  const candidate: ReleaseCandidate = {
    id: 'release.pretty-things.v1',
    videoPath: 'artifacts/pretty-things.mp4',
    captionsPath: 'artifacts/pretty-things.vtt',
    title: 'Why Pretty Things Work Better',
    description: 'A source-grounded visual reading guide.',
    sourcePageUrl: 'https://example.com/sources/pretty-things',
    aiDisclosure: 'AI assisted; source checking and publication were reviewed by a human editor.',
  };
  const digest = releaseCandidateDigest(candidate);

  return episodeProjectSchema.parse({
    schemaVersion: 'visual-learning.episode-project/v1',
    id: 'episode.pretty-things.v1',
    title: 'Why Pretty Things Work Better',
    source: {
      records: [
        {
          id: 'source.emotional-design',
          versionId: 'source.emotional-design.edition-1',
          contentDigest: sourceDigest,
          kind: 'book',
          title: 'Example source',
          authors: ['Example Author'],
          editionOrVersion: 'First edition',
          publicationDate: '2026',
          publisherOrJournal: 'Example Publisher',
          uri: 'https://example.com/source',
          accessStatus: 'owner_supplied',
          rightsStatus: 'fair_dealing_reviewed',
          rightsNote: 'Original explanation with short attributed quotations only.',
          coverage: {
            scope: 'whole_source',
            mode: 'full',
            inspected: 'All chapters, notes, and bibliography inspected.',
            exclusions: [],
          },
        },
      ],
      claims: [
        {
          id: 'claim.affect-and-use',
          statement: 'The source connects emotional response with how a product is approached.',
          epistemicKind: 'source_claim',
          status: 'verified',
          sourceIds: ['source.emotional-design'],
          locators: [
            {
              sourceId: 'source.emotional-design',
              locator: 'Chapter 1, page 12',
            },
          ],
          reviewNote: 'Verified against the named edition.',
        },
      ],
    },
    editorial: {
      audience: {
        primary: 'Product designers and AI engineers',
        priorKnowledge: 'General product-development experience',
        decisionContext: 'Apply the model to one AI-product design decision',
      },
      learningObjective: {
        id: 'objective.apply-model',
        outcome: 'Explain and apply the central model.',
        evidenceOfLearning: 'Correctly diagnose a new example.',
      },
      narrative: [
        {
          id: 'beat.central-model',
          title: 'The central model',
          purpose: 'Show the relationship rather than list key words.',
          relationship: 'cause',
          claimIds: ['claim.affect-and-use'],
        },
      ],
      script: [
        {
          id: 'script.central-model',
          beatId: 'beat.central-model',
          narration: 'A reviewed narration grounded in the verified claim.',
          claimIds: ['claim.affect-and-use'],
          intendedSeconds: 20,
        },
      ],
    },
    distribution: {
      audiencePromise: {
        viewer: 'Product designers and AI engineers',
        problem: 'Technically capable products can still be confusing or unwanted.',
        promisedOutcome: 'A practical model for making an AI product understandable and desirable.',
        boundary: 'This is a source-grounded design framework, not a guarantee of product success.',
        subscriptionReason: 'Follow the complete path from AI-product idea to adoption.',
      },
      packagingCandidates: [
        {
          id: 'packaging.selected',
          title: 'Why Pretty Things Work Better',
          thumbnailConcept: 'A confusing interface becomes clear and inviting.',
          openingHook: 'Useful is not enough.',
          angle: 'contrarian',
          supportingClaimIds: ['claim.affect-and-use'],
          status: 'selected',
        },
        {
          id: 'packaging.alternate-one',
          title: 'The Missing Layer in Product Design',
          thumbnailConcept: 'Function and feeling shown as two incomplete halves.',
          openingHook: 'A usable product can still be one nobody wants.',
          angle: 'problem',
          supportingClaimIds: ['claim.affect-and-use'],
          status: 'proposed',
        },
        {
          id: 'packaging.alternate-two',
          title: 'Why Good Products Still Feel Wrong',
          thumbnailConcept: 'A polished product with an emotional warning sign.',
          openingHook: 'What if the interface works but the experience fails?',
          angle: 'curiosity',
          supportingClaimIds: ['claim.affect-and-use'],
          status: 'proposed',
        },
      ],
      derivatives: [
        {
          id: 'derivative.central-model-short',
          format: 'youtube_short',
          purpose: 'Introduce the central causal relationship to new viewers.',
          sourceBeatIds: ['beat.central-model'],
          callToAction: 'Watch the complete source-grounded episode.',
        },
      ],
    },
    production: {
      voicePlan: {
        narratorMode: 'generated',
        provider: 'prepared-test-voice',
        voiceProfileId: 'voice.test',
        scriptDigest: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        outputPath: 'audio/voice.m4a',
      },
      audio: {
        path: 'audio/voice.m4a',
        origin: 'generated',
        contentDigest: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        durationSeconds: 20,
      },
      scenes: [
        {
          id: 'scene.central-model',
          scriptSegmentIds: ['script.central-model'],
          learningPurpose: 'Reveal the causal relationship.',
          relationship: 'cause',
          visualDirection: 'A stable product object changes as the emotional state changes.',
          assetIds: ['asset.diagram'],
        },
      ],
      assets: [
        {
          id: 'asset.diagram',
          kind: 'vector',
          path: 'assets/diagram.svg',
          rightsStatus: 'owned',
          rightsNote: 'Original vector diagram.',
        },
      ],
      renderPlan: {
        renderer: 'prepared-test-renderer',
        width: 1920,
        height: 1080,
        framesPerSecond: 30,
        outputPath: 'artifacts/pretty-things.mp4',
      },
    },
    release: {
      candidate,
      approval: {
        candidateId: candidate.id,
        approvedDigest: digest,
        approvedBy: 'owner',
        approvedAt: '2026-09-20T12:00:00.000Z',
      },
      publication: {
        candidateId: candidate.id,
        approvedDigest: digest,
        provider: 'youtube',
        publicUrl: 'https://www.youtube.com/watch?v=example',
        observedAt: '2026-09-20T13:00:00.000Z',
      },
    },
  });
}

describe('episode readiness', () => {
  it('starts from an observed source and waits for complete synthesis', () => {
    const project = completeProject();
    project.source.records[0]!.coverage = {
      scope: 'whole_source',
      mode: 'partial',
      inspected: 'Metadata and contents only.',
      exclusions: ['Full body synthesis pending.'],
    };
    project.source.claims = [];
    project.editorial.narrative = [];
    project.editorial.script = [];
    project.production.scenes = [];
    project.production.assets = [];
    delete project.production.voicePlan;
    delete project.production.audio;
    delete project.production.renderPlan;
    project.release = {};

    const readiness = deriveEpisodeReadiness(project, observedSource());

    expect(readiness.currentStage).toBe('sources_ready');
    expect(readiness.blockers.map((item) => item.code)).toContain('source.coverage_incomplete');
    expect(readiness.blockers.map((item) => item.code)).toContain('claim.none');
    expect(readiness.blockers.map((item) => item.code)).toContain('audio.none');
  });

  it('rejects a source claim without an exact locator', () => {
    const result = claimRecordSchema.safeParse({
      id: 'claim.unlocated',
      statement: 'A material claim.',
      epistemicKind: 'source_claim',
      status: 'proposed',
      sourceIds: ['source.example'],
      locators: [],
      reviewNote: 'Not yet checked.',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a local document whose content changed after registration', () => {
    const readiness = deriveEpisodeReadiness(completeProject(), {
      documents: {
        'source.emotional-design': {
          contentDigest: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
          byteSize: 10_000,
          pageCount: 200,
          encrypted: false,
          format: 'pdf',
        },
      },
      documentErrors: {},
    });

    expect(readiness.currentStage).toBe('registered');
    expect(readiness.blockers.map((item) => item.code)).toContain('source.digest_mismatch');
  });

  it('derives published only when the complete approved provenance chain exists', () => {
    const readiness = deriveEpisodeReadiness(completeProject(), observedSource());

    expect(readiness.currentStage).toBe('published');
    expect(readiness.blockers).toEqual([]);
  });

  it('invalidates approval when the release changes after human review', () => {
    const project = completeProject();
    if (project.release.candidate === undefined) {
      throw new Error('Fixture candidate is required.');
    }
    project.release.candidate.description = 'Changed after approval.';

    const readiness = deriveEpisodeReadiness(project, observedSource());

    expect(readiness.currentStage).toBe('production_ready');
    expect(readiness.blockers.map((item) => item.code)).toContain(
      'release.approval_digest_mismatch',
    );
  });

  it('does not accept packaging that is unsupported by verified episode claims', () => {
    const project = completeProject();
    project.distribution.packagingCandidates[0]!.supportingClaimIds = ['claim.missing'];

    const readiness = deriveEpisodeReadiness(project, observedSource());

    expect(readiness.currentStage).toBe('narrative_ready');
    expect(readiness.blockers.map((item) => item.code)).toContain('packaging.claim_missing');
  });
});
