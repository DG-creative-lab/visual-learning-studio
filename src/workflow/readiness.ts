import type { DocumentObservation } from '../ports/documentProbe.js';
import { scriptSegmentsDigest } from '../editorial/contracts.js';
import type { ArtifactObservation, VoiceRenderReceipt } from '../ports/artifactProbe.js';
import { voiceRenderRequestDigest } from '../ports/externalEffects.js';
import { releaseCandidateDigest } from '../release/contracts.js';
import type { EpisodeProject } from './project.js';

export const episodeStages = [
  'registered',
  'sources_ready',
  'synthesis_ready',
  'narrative_ready',
  'packaging_ready',
  'script_verified',
  'scenes_ready',
  'production_ready',
  'release_approved',
  'published',
] as const;

export type EpisodeStage = (typeof episodeStages)[number];

export interface ReadinessBlocker {
  readonly gate: Exclude<EpisodeStage, 'registered'>;
  readonly code: string;
  readonly message: string;
}

export interface EpisodeReadiness {
  readonly currentStage: EpisodeStage;
  readonly completedStages: readonly EpisodeStage[];
  readonly blockers: readonly ReadinessBlocker[];
}

export interface ReadinessEvidence {
  readonly documents: Readonly<Record<string, DocumentObservation>>;
  readonly documentErrors: Readonly<Record<string, string>>;
  readonly artifacts: Readonly<Record<string, ArtifactObservation>>;
  readonly voiceRenderReceipts: Readonly<Record<string, VoiceRenderReceipt>>;
}

function blocker(
  gate: Exclude<EpisodeStage, 'registered'>,
  code: string,
  message: string,
): ReadinessBlocker {
  return { gate, code, message };
}

function sourceBlockers(project: EpisodeProject, evidence: ReadinessEvidence): ReadinessBlocker[] {
  const blockers: ReadinessBlocker[] = [];

  if (project.source.records.length === 0) {
    blockers.push(
      blocker(
        'sources_ready',
        'source.none',
        'No exact book, paper, or other source record has been registered.',
      ),
    );
  }

  for (const source of project.source.records) {
    const observation = evidence.documents[source.id];
    const observationError = evidence.documentErrors[source.id];

    if (observationError !== undefined) {
      blockers.push(
        blocker(
          'sources_ready',
          'source.unreadable',
          `Source ${source.id} could not be inspected: ${observationError}`,
        ),
      );
      continue;
    }

    if (observation === undefined) {
      blockers.push(
        blocker(
          'sources_ready',
          'source.unobserved',
          `Source ${source.id} has not been inspected through a document adapter.`,
        ),
      );
      continue;
    }

    if (observation.contentDigest !== source.contentDigest) {
      blockers.push(
        blocker(
          'sources_ready',
          'source.digest_mismatch',
          `Source ${source.id} does not match its registered content digest.`,
        ),
      );
    }

    if (observation.encrypted) {
      blockers.push(
        blocker(
          'sources_ready',
          'source.encrypted',
          `Source ${source.id} is encrypted and cannot enter the extraction workflow.`,
        ),
      );
    }
  }

  return blockers;
}

function synthesisBlockers(project: EpisodeProject): ReadinessBlocker[] {
  const blockers: ReadinessBlocker[] = [];
  const sourceIds = new Set(project.source.records.map((source) => source.id));

  for (const source of project.source.records) {
    if (source.coverage.mode !== 'full') {
      blockers.push(
        blocker(
          'synthesis_ready',
          'source.coverage_incomplete',
          `Source ${source.id} has ${source.coverage.mode} coverage of its ${source.coverage.scope}; complete synthesis of the declared scope is not yet established.`,
        ),
      );
    }
  }

  if (project.source.claims.length === 0) {
    blockers.push(
      blocker(
        'synthesis_ready',
        'claim.none',
        'No source-grounded claims, interpretations, limitations, or unknowns exist.',
      ),
    );
  }

  for (const claim of project.source.claims) {
    if (claim.status !== 'verified') {
      blockers.push(
        blocker(
          'synthesis_ready',
          'claim.unverified',
          `Claim ${claim.id} is ${claim.status}; only verified claims may ground a narrative.`,
        ),
      );
    }

    for (const sourceId of claim.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        blockers.push(
          blocker(
            'synthesis_ready',
            'claim.source_missing',
            `Claim ${claim.id} references unknown source ${sourceId}.`,
          ),
        );
      }
    }

    for (const locator of claim.locators) {
      if (!sourceIds.has(locator.sourceId)) {
        blockers.push(
          blocker(
            'synthesis_ready',
            'claim.locator_source_missing',
            `Claim ${claim.id} has a locator for unknown source ${locator.sourceId}.`,
          ),
        );
      }
    }
  }

  return blockers;
}

function narrativeBlockers(project: EpisodeProject): ReadinessBlocker[] {
  const blockers: ReadinessBlocker[] = [];
  const claimIds = new Set(project.source.claims.map((claim) => claim.id));

  if (project.editorial.narrative.length === 0) {
    blockers.push(
      blocker('narrative_ready', 'narrative.none', 'No audience-specific narrative exists.'),
    );
  }

  const coveredClaimIds = new Set<string>();
  for (const beat of project.editorial.narrative) {
    for (const claimId of beat.claimIds) {
      coveredClaimIds.add(claimId);
      if (!claimIds.has(claimId)) {
        blockers.push(
          blocker(
            'narrative_ready',
            'narrative.claim_missing',
            `Narrative beat ${beat.id} references unknown claim ${claimId}.`,
          ),
        );
      }
    }
  }

  for (const claim of project.source.claims) {
    if (claim.status === 'verified' && !coveredClaimIds.has(claim.id)) {
      blockers.push(
        blocker(
          'narrative_ready',
          'narrative.claim_uncovered',
          `Verified claim ${claim.id} is not represented or explicitly excluded by the narrative.`,
        ),
      );
    }
  }

  return blockers;
}

function scriptBlockers(project: EpisodeProject): ReadinessBlocker[] {
  const blockers: ReadinessBlocker[] = [];
  const beatIds = new Set(project.editorial.narrative.map((beat) => beat.id));
  const claimIds = new Set(project.source.claims.map((claim) => claim.id));

  if (project.editorial.script.length === 0) {
    blockers.push(blocker('script_verified', 'script.none', 'No final narration script exists.'));
  }

  const scriptedBeatIds = new Set<string>();
  for (const segment of project.editorial.script) {
    scriptedBeatIds.add(segment.beatId);
    if (!beatIds.has(segment.beatId)) {
      blockers.push(
        blocker(
          'script_verified',
          'script.beat_missing',
          `Script segment ${segment.id} references unknown beat ${segment.beatId}.`,
        ),
      );
    }
    for (const claimId of segment.claimIds) {
      if (!claimIds.has(claimId)) {
        blockers.push(
          blocker(
            'script_verified',
            'script.claim_missing',
            `Script segment ${segment.id} references unknown claim ${claimId}.`,
          ),
        );
      }
    }
  }

  for (const beat of project.editorial.narrative) {
    if (!scriptedBeatIds.has(beat.id)) {
      blockers.push(
        blocker(
          'script_verified',
          'script.beat_uncovered',
          `Narrative beat ${beat.id} has no script segment.`,
        ),
      );
    }
  }

  return blockers;
}

function packagingBlockers(project: EpisodeProject): ReadinessBlocker[] {
  const blockers: ReadinessBlocker[] = [];
  const claimIds = new Set(project.source.claims.map((claim) => claim.id));
  const candidates = project.distribution.packagingCandidates;

  if (candidates.length < 3) {
    blockers.push(
      blocker(
        'packaging_ready',
        'packaging.candidates_insufficient',
        'At least three truthful title, thumbnail, and opening-hook candidates are required.',
      ),
    );
  }

  const selected = candidates.filter((candidate) => candidate.status === 'selected');
  if (selected.length !== 1) {
    blockers.push(
      blocker(
        'packaging_ready',
        'packaging.selection_invalid',
        'Exactly one packaging candidate must be selected before the final script is verified.',
      ),
    );
  }

  for (const candidate of candidates) {
    for (const claimId of candidate.supportingClaimIds) {
      if (!claimIds.has(claimId)) {
        blockers.push(
          blocker(
            'packaging_ready',
            'packaging.claim_missing',
            `Packaging candidate ${candidate.id} relies on unknown claim ${claimId}.`,
          ),
        );
      }
    }
  }

  return blockers;
}

function sceneBlockers(project: EpisodeProject): ReadinessBlocker[] {
  const blockers: ReadinessBlocker[] = [];
  const scriptIds = new Set(project.editorial.script.map((segment) => segment.id));
  const assetIds = new Set(project.production.assets.map((asset) => asset.id));

  if (project.production.scenes.length === 0) {
    blockers.push(blocker('scenes_ready', 'scene.none', 'No visual scene plan exists.'));
  }

  const coveredScriptIds = new Set<string>();
  for (const scene of project.production.scenes) {
    for (const scriptId of scene.scriptSegmentIds) {
      coveredScriptIds.add(scriptId);
      if (!scriptIds.has(scriptId)) {
        blockers.push(
          blocker(
            'scenes_ready',
            'scene.script_missing',
            `Scene ${scene.id} references unknown script segment ${scriptId}.`,
          ),
        );
      }
    }
    for (const assetId of scene.assetIds) {
      if (!assetIds.has(assetId)) {
        blockers.push(
          blocker(
            'scenes_ready',
            'scene.asset_missing',
            `Scene ${scene.id} references unknown asset ${assetId}.`,
          ),
        );
      }
    }
  }

  for (const segment of project.editorial.script) {
    if (!coveredScriptIds.has(segment.id)) {
      blockers.push(
        blocker(
          'scenes_ready',
          'scene.script_uncovered',
          `Script segment ${segment.id} has no visual scene.`,
        ),
      );
    }
  }

  return blockers;
}

function productionBlockers(
  project: EpisodeProject,
  evidence: ReadinessEvidence,
): ReadinessBlocker[] {
  const blockers: ReadinessBlocker[] = [];

  if (project.production.voicePlan === undefined) {
    blockers.push(
      blocker(
        'production_ready',
        'voice_plan.none',
        'No voice-over plan is bound to the verified script.',
      ),
    );
  }

  if (
    project.production.voicePlan !== undefined &&
    project.production.voicePlan.scriptDigest !== scriptSegmentsDigest(project.editorial.script)
  ) {
    blockers.push(
      blocker(
        'production_ready',
        'voice_plan.script_digest_mismatch',
        'The voice-over plan is bound to a different narration script.',
      ),
    );
  }

  if (project.production.audio !== undefined) {
    const { audio, voicePlan } = project.production;
    const receipt = evidence.voiceRenderReceipts[audio.path];
    const observation = evidence.artifacts[audio.path];

    if (receipt === undefined) {
      blockers.push(
        blocker(
          'production_ready',
          'audio.render_receipt_unobserved',
          'No trusted voice-production receipt binds the audio output to its input script.',
        ),
      );
    } else {
      if (
        voicePlan !== undefined &&
        receipt.requestDigest !==
          voiceRenderRequestDigest({
            episodeId: project.id,
            script: project.editorial.script,
            scriptDigest: voicePlan.scriptDigest,
            voiceProfileId: voicePlan.voiceProfileId,
            outputPath: voicePlan.outputPath,
          })
      ) {
        blockers.push(
          blocker(
            'production_ready',
            'audio.render_receipt_request_mismatch',
            'The voice-production receipt was issued for a different episode, script, voice profile, or output path.',
          ),
        );
      }

      if (
        receipt.outputPath !== audio.path ||
        receipt.outputContentDigest !== audio.contentDigest ||
        (voicePlan !== undefined && receipt.provider !== voicePlan.provider)
      ) {
        blockers.push(
          blocker(
            'production_ready',
            'audio.render_receipt_output_mismatch',
            'The voice-production receipt does not match the declared audio output.',
          ),
        );
      }
    }

    if (observation === undefined) {
      blockers.push(
        blocker(
          'production_ready',
          'audio.artifact_unobserved',
          'The audio output bytes have not been independently observed.',
        ),
      );
    } else {
      if (observation.byteSize <= 0) {
        blockers.push(
          blocker(
            'production_ready',
            'audio.artifact_empty',
            'The independently observed audio artifact is empty.',
          ),
        );
      }
      if (observation.mediaKind !== 'audio') {
        blockers.push(
          blocker(
            'production_ready',
            'audio.artifact_format_invalid',
            'The independently observed artifact is not valid audio.',
          ),
        );
      }
      if (
        observation.mediaKind === 'audio' &&
        (observation.durationSeconds === undefined || observation.durationSeconds <= 0)
      ) {
        blockers.push(
          blocker(
            'production_ready',
            'audio.artifact_unusable',
            'The independently observed audio has no playable stream with positive duration.',
          ),
        );
      }
      if (observation.contentDigest !== audio.contentDigest) {
        blockers.push(
          blocker(
            'production_ready',
            'audio.artifact_digest_mismatch',
            'The independently observed audio bytes do not match the declared audio digest.',
          ),
        );
      }
    }
  }

  if (project.production.audio === undefined) {
    blockers.push(
      blocker(
        'production_ready',
        'audio.none',
        'No generated or human-recorded voice-over artifact exists.',
      ),
    );
  }

  if (
    project.production.voicePlan !== undefined &&
    project.production.audio !== undefined &&
    (project.production.voicePlan.outputPath !== project.production.audio.path ||
      project.production.voicePlan.narratorMode !== project.production.audio.origin)
  ) {
    blockers.push(
      blocker(
        'production_ready',
        'audio.voice_plan_mismatch',
        'The observed audio does not match the path and origin declared by the voice-over plan.',
      ),
    );
  }

  if (project.production.renderPlan === undefined) {
    blockers.push(
      blocker('production_ready', 'render.none', 'No deterministic render plan exists.'),
    );
  }

  for (const asset of project.production.assets) {
    if (asset.rightsStatus === 'unknown') {
      blockers.push(
        blocker(
          'production_ready',
          'asset.rights_unresolved',
          `Asset ${asset.id} has unresolved rights.`,
        ),
      );
    }
  }

  return blockers;
}

function releaseBlockers(project: EpisodeProject, evidence: ReadinessEvidence): ReadinessBlocker[] {
  const blockers: ReadinessBlocker[] = [];
  const { candidate, approval } = project.release;

  for (const source of project.source.records) {
    if (source.rightsStatus === 'unknown' || source.rightsStatus === 'needs_review') {
      blockers.push(
        blocker(
          'release_approved',
          'source.rights_unresolved',
          `Source ${source.id} has unresolved public-release rights.`,
        ),
      );
    }
  }

  if (candidate === undefined) {
    blockers.push(
      blocker('release_approved', 'release.none', 'No exact publication candidate exists.'),
    );
    return blockers;
  }

  const releaseArtifacts = [
    { label: 'video', path: candidate.videoPath, digest: candidate.videoDigest, kind: 'video' },
    {
      label: 'captions',
      path: candidate.captionsPath,
      digest: candidate.captionsDigest,
      kind: 'captions',
    },
  ];
  for (const artifact of releaseArtifacts) {
    if (artifact.digest === undefined) {
      blockers.push(
        blocker(
          'release_approved',
          'release.artifact_digest_missing',
          `The legacy release ${artifact.label} at ${artifact.path} has no trusted content digest.`,
        ),
      );
      continue;
    }

    const observation = evidence.artifacts[artifact.path];
    if (observation === undefined) {
      blockers.push(
        blocker(
          'release_approved',
          'release.artifact_unobserved',
          `The release ${artifact.label} at ${artifact.path} has not been independently observed.`,
        ),
      );
    } else {
      if (observation.byteSize <= 0) {
        blockers.push(
          blocker(
            'release_approved',
            'release.artifact_empty',
            `The observed release ${artifact.label} is empty.`,
          ),
        );
      }
      if (observation.mediaKind !== artifact.kind) {
        blockers.push(
          blocker(
            'release_approved',
            'release.artifact_format_invalid',
            `The observed release ${artifact.label} has the wrong media format.`,
          ),
        );
      }
      if (
        artifact.kind === 'video' &&
        observation.mediaKind === 'video' &&
        (observation.durationSeconds === undefined || observation.durationSeconds <= 0)
      ) {
        blockers.push(
          blocker(
            'release_approved',
            'release.artifact_unusable',
            'The observed release video has no playable video stream with positive duration.',
          ),
        );
      }
      if (
        artifact.kind === 'captions' &&
        observation.mediaKind === 'captions' &&
        (observation.cueCount === undefined || observation.cueCount <= 0)
      ) {
        blockers.push(
          blocker(
            'release_approved',
            'release.artifact_unusable',
            'The observed release captions contain no positive-duration cue with viewer-visible text.',
          ),
        );
      }
      if (observation.contentDigest !== artifact.digest) {
        blockers.push(
          blocker(
            'release_approved',
            'release.artifact_digest_mismatch',
            `The observed release ${artifact.label} does not match its declared content digest.`,
          ),
        );
      }
    }
  }

  const selectedPackaging = project.distribution.packagingCandidates.find(
    (item) => item.status === 'selected',
  );
  if (selectedPackaging === undefined || candidate.title !== selectedPackaging.title) {
    blockers.push(
      blocker(
        'release_approved',
        'release.packaging_mismatch',
        'The release title does not match the selected, claim-supported packaging candidate.',
      ),
    );
  }

  if (
    project.production.renderPlan === undefined ||
    candidate.videoPath !== project.production.renderPlan.outputPath
  ) {
    blockers.push(
      blocker(
        'release_approved',
        'release.render_path_mismatch',
        'The release candidate does not identify the output of the approved render plan.',
      ),
    );
  }

  if (approval === undefined) {
    blockers.push(
      blocker(
        'release_approved',
        'release.unapproved',
        'The exact publication candidate has not been approved by a human owner.',
      ),
    );
    return blockers;
  }

  if (approval.candidateId !== candidate.id) {
    blockers.push(
      blocker(
        'release_approved',
        'release.approval_candidate_mismatch',
        'The approval refers to a different release candidate.',
      ),
    );
  }

  if (approval.approvedDigest !== releaseCandidateDigest(candidate)) {
    blockers.push(
      blocker(
        'release_approved',
        'release.approval_digest_mismatch',
        'The release candidate changed after approval or the approval is invalid.',
      ),
    );
  }

  return blockers;
}

function publicationBlockers(project: EpisodeProject): ReadinessBlocker[] {
  const blockers: ReadinessBlocker[] = [];
  const { approval, candidate, publication } = project.release;

  if (publication === undefined) {
    blockers.push(
      blocker('published', 'publication.unobserved', 'No public publication has been observed.'),
    );
    return blockers;
  }

  if (
    candidate === undefined ||
    approval === undefined ||
    publication.candidateId !== candidate.id ||
    publication.approvedDigest !== approval.approvedDigest
  ) {
    blockers.push(
      blocker(
        'published',
        'publication.identity_mismatch',
        'The observed publication does not match the exact approved release.',
      ),
    );
  }

  return blockers;
}

export function deriveEpisodeReadiness(
  project: EpisodeProject,
  evidence: ReadinessEvidence,
): EpisodeReadiness {
  const blockers = [
    ...sourceBlockers(project, evidence),
    ...synthesisBlockers(project),
    ...narrativeBlockers(project),
    ...packagingBlockers(project),
    ...scriptBlockers(project),
    ...sceneBlockers(project),
    ...productionBlockers(project, evidence),
    ...releaseBlockers(project, evidence),
    ...publicationBlockers(project),
  ];

  const firstBlockedIndex = episodeStages.findIndex(
    (stage) => stage !== 'registered' && blockers.some((item) => item.gate === stage),
  );
  const currentIndex = firstBlockedIndex === -1 ? episodeStages.length - 1 : firstBlockedIndex - 1;

  return {
    currentStage: episodeStages[currentIndex] ?? 'registered',
    completedStages: episodeStages.slice(0, currentIndex + 1),
    blockers,
  };
}
