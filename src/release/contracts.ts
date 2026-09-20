import { createHash } from 'node:crypto';
import { z } from 'zod';
import { stableIdSchema } from '../shared/identity.js';

export const releaseCandidateSchema = z
  .object({
    id: stableIdSchema,
    videoPath: z.string().min(1).max(2_000),
    captionsPath: z.string().min(1).max(2_000),
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(5_000),
    sourcePageUrl: z.string().url(),
    aiDisclosure: z.string().min(1).max(2_000),
  })
  .strict();

export const releaseApprovalSchema = z
  .object({
    candidateId: stableIdSchema,
    approvedDigest: z.string().regex(/^[a-f0-9]{64}$/),
    approvedBy: z.string().min(1).max(200),
    approvedAt: z.string().datetime(),
  })
  .strict();

export const publicationObservationSchema = z
  .object({
    candidateId: stableIdSchema,
    approvedDigest: z.string().regex(/^[a-f0-9]{64}$/),
    provider: z.enum(['youtube']),
    publicUrl: z.string().url(),
    observedAt: z.string().datetime(),
  })
  .strict();

export const releaseModuleSchema = z
  .object({
    candidate: releaseCandidateSchema.optional(),
    approval: releaseApprovalSchema.optional(),
    publication: publicationObservationSchema.optional(),
  })
  .strict();

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }

  return value;
}

export function releaseCandidateDigest(candidate: ReleaseCandidate): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(candidate)))
    .digest('hex');
}

export type ReleaseCandidate = z.infer<typeof releaseCandidateSchema>;
export type ReleaseApproval = z.infer<typeof releaseApprovalSchema>;
export type PublicationObservation = z.infer<typeof publicationObservationSchema>;
export type ReleaseModule = z.infer<typeof releaseModuleSchema>;
