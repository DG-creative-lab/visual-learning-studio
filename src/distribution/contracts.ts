import { z } from 'zod';
import { duplicates, stableIdSchema } from '../shared/identity.js';

export const audiencePromiseSchema = z
  .object({
    viewer: z.string().min(1).max(300),
    problem: z.string().min(1).max(1_000),
    promisedOutcome: z.string().min(1).max(1_000),
    boundary: z.string().min(1).max(1_000),
    subscriptionReason: z.string().min(1).max(1_000),
  })
  .strict();

export const packagingCandidateSchema = z
  .object({
    id: stableIdSchema,
    title: z.string().min(1).max(100),
    thumbnailConcept: z.string().min(1).max(1_000),
    openingHook: z.string().min(1).max(1_000),
    angle: z.enum(['proof', 'contrarian', 'problem', 'curiosity', 'story', 'practical']),
    supportingClaimIds: z.array(stableIdSchema).min(1).max(16),
    status: z.enum(['proposed', 'selected', 'rejected']),
  })
  .strict();

export const derivativePlanSchema = z
  .object({
    id: stableIdSchema,
    format: z.enum(['youtube_short', 'article', 'newsletter', 'social_post', 'source_page']),
    purpose: z.string().min(1).max(1_000),
    sourceBeatIds: z.array(stableIdSchema).max(16),
    callToAction: z.string().min(1).max(500),
  })
  .strict();

export const distributionModuleSchema = z
  .object({
    audiencePromise: audiencePromiseSchema,
    packagingCandidates: z.array(packagingCandidateSchema).max(12),
    derivatives: z.array(derivativePlanSchema).max(32),
  })
  .strict()
  .superRefine((distribution, context) => {
    for (const id of duplicates(
      distribution.packagingCandidates.map((candidate) => candidate.id),
    )) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate packaging candidate id: ${id}`,
        path: ['packagingCandidates'],
      });
    }

    for (const id of duplicates(distribution.derivatives.map((derivative) => derivative.id))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate derivative plan id: ${id}`,
        path: ['derivatives'],
      });
    }
  });

export type DistributionModule = z.infer<typeof distributionModuleSchema>;
export type PackagingCandidate = z.infer<typeof packagingCandidateSchema>;
export type DerivativePlan = z.infer<typeof derivativePlanSchema>;
