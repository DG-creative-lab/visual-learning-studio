import type { EditorialModule, NarrativeBeat, ScriptSegment } from '../editorial/contracts.js';
import { digestJson } from '../shared/digest.js';
import type { VoiceRenderReceipt } from './artifactProbe.js';
import type { ProductionModule } from '../production/contracts.js';
import type {
  PublicationObservation,
  ReleaseApproval,
  ReleaseCandidate,
} from '../release/contracts.js';
import type { ClaimRecord, SourceRecord } from '../source/contracts.js';

export interface EditorialProposalRequest {
  readonly sources: readonly SourceRecord[];
  readonly verifiedClaims: readonly ClaimRecord[];
  readonly audience: EditorialModule['audience'];
  readonly learningObjective: EditorialModule['learningObjective'];
}

export interface EditorialProposal {
  readonly narrative: readonly NarrativeBeat[];
  readonly script: readonly ScriptSegment[];
  readonly modelName: string;
  readonly modelOutputId?: string;
}

/** Produces proposals only. Its output cannot verify claims or approve an episode. */
export interface EditorialProposalPort {
  propose(request: EditorialProposalRequest): Promise<EditorialProposal>;
}

export interface VoiceRenderRequest {
  readonly episodeId: string;
  readonly script: readonly ScriptSegment[];
  readonly scriptDigest: string;
  readonly voiceProfileId: string;
  readonly outputPath: string;
}

export function voiceRenderRequestDigest(request: VoiceRenderRequest): string {
  return digestJson(request);
}

export interface RenderObservation {
  readonly outputPath: string;
  readonly contentDigest: string;
  readonly durationSeconds: number;
  readonly provider: string;
}

export interface VoiceRenderPort {
  render(request: VoiceRenderRequest): Promise<VoiceRenderReceipt>;
}

export interface VideoRenderRequest {
  readonly episodeId: string;
  readonly production: ProductionModule;
  readonly approvedAudio: RenderObservation;
}

export interface VideoRenderPort {
  render(request: VideoRenderRequest): Promise<RenderObservation>;
}

export interface PublishEpisodeRequest {
  readonly candidate: ReleaseCandidate;
  readonly approval: ReleaseApproval;
}

/** Performs the external publication effect for one exact approved candidate. */
export interface EpisodePublisherPort {
  publish(request: PublishEpisodeRequest): Promise<PublicationObservation>;
}
