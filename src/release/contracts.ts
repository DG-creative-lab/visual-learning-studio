import { z } from 'zod';
import { digestJson } from '../shared/digest.js';
import { stableIdSchema } from '../shared/identity.js';

export const releaseCandidateSchema = z
  .object({
    id: stableIdSchema,
    videoPath: z.string().min(1).max(2_000),
    // Optional only for compatibility with v1 manifests written before artifact binding existed.
    // Readiness treats an absent digest as unverified and will not authorize release.
    videoDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    captionsPath: z.string().min(1).max(2_000),
    captionsDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
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

export function releaseCandidateDigest(candidate: ReleaseCandidate): string {
  return digestJson(candidate);
}

export type ReleaseCandidate = z.infer<typeof releaseCandidateSchema>;
export type ReleaseApproval = z.infer<typeof releaseApprovalSchema>;
export type PublicationObservation = z.infer<typeof publicationObservationSchema>;
export type ReleaseModule = z.infer<typeof releaseModuleSchema>;
