export type ArtifactKind = 'audio' | 'video' | 'captions';

export interface ArtifactObservation {
  readonly contentDigest: string;
  readonly byteSize: number;
  readonly mediaKind: ArtifactKind;
  readonly durationSeconds?: number;
  readonly cueCount?: number;
}

export interface ArtifactProbeRequest {
  readonly absolutePath: string;
  readonly expectedKind: ArtifactKind;
  readonly maxByteSize: number;
}

export interface ArtifactProbe {
  observe(request: ArtifactProbeRequest): Promise<ArtifactObservation>;
}

/** Trusted evidence emitted by the voice-production boundary, not by the episode manifest. */
export interface VoiceRenderReceipt {
  readonly requestDigest: string;
  readonly outputPath: string;
  readonly outputContentDigest: string;
  readonly provider: string;
}

export interface VoiceRenderReceiptProbe {
  observe(outputPath: string): Promise<VoiceRenderReceipt>;
}
