import { z } from 'zod';
import { duplicates, stableIdSchema } from '../shared/identity.js';

export const sourceKindSchema = z.enum([
  'book',
  'paper',
  'web',
  'documentation',
  'transcript',
  'other',
]);

export const sourceRightsStatusSchema = z.enum([
  'unknown',
  'needs_review',
  'licensed',
  'public_domain',
  'fair_dealing_reviewed',
  'owner_created',
]);

export const sourceCoverageSchema = z
  .object({
    scope: z.enum(['whole_source', 'declared_selection']),
    mode: z.enum(['full', 'partial', 'structure_only']),
    inspected: z.string().min(1),
    selectedSections: z
      .array(
        z
          .object({
            locator: z.string().min(1).max(300),
            rationale: z.string().min(1).max(1_000),
          })
          .strict(),
      )
      .max(64)
      .default([]),
    exclusions: z.array(z.string().min(1)).max(64).default([]),
  })
  .strict()
  .superRefine((coverage, context) => {
    if (
      coverage.scope === 'declared_selection' &&
      coverage.mode === 'full' &&
      coverage.selectedSections.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Full coverage of a declared selection requires at least one selected section.',
        path: ['selectedSections'],
      });
    }

    if (coverage.scope === 'whole_source' && coverage.selectedSections.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Whole-source coverage must not define selected sections.',
        path: ['selectedSections'],
      });
    }
  });

export const sourceRecordSchema = z
  .object({
    id: stableIdSchema,
    versionId: stableIdSchema,
    contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
    kind: sourceKindSchema,
    title: z.string().min(1).max(500),
    authors: z.array(z.string().min(1).max(200)).min(1).max(32),
    editionOrVersion: z.string().min(1).max(200).optional(),
    publicationDate: z.string().min(4).max(32).optional(),
    publisherOrJournal: z.string().min(1).max(300).optional(),
    uri: z.string().url().optional(),
    accessStatus: z.enum(['owner_supplied', 'licensed', 'public']),
    rightsStatus: sourceRightsStatusSchema,
    rightsNote: z.string().min(1).max(2_000),
    coverage: sourceCoverageSchema,
  })
  .strict();

export const sourceLocatorSchema = z
  .object({
    sourceId: stableIdSchema,
    locator: z.string().min(1).max(300),
  })
  .strict();

export const epistemicKindSchema = z.enum([
  'source_claim',
  'source_evidence',
  'editorial_interpretation',
  'limitation',
  'unknown',
]);

export const claimStatusSchema = z.enum(['proposed', 'verified', 'rejected']);

export const claimRecordSchema = z
  .object({
    id: stableIdSchema,
    statement: z.string().min(1).max(2_000),
    epistemicKind: epistemicKindSchema,
    status: claimStatusSchema,
    sourceIds: z.array(stableIdSchema).max(16).default([]),
    locators: z.array(sourceLocatorSchema).max(32).default([]),
    reviewNote: z.string().min(1).max(2_000),
  })
  .strict()
  .superRefine((claim, context) => {
    const requiresProvenance =
      claim.epistemicKind === 'source_claim' || claim.epistemicKind === 'source_evidence';

    if (requiresProvenance && claim.sourceIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Source claims and evidence require at least one source identity.',
        path: ['sourceIds'],
      });
    }

    if (requiresProvenance && claim.locators.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Source claims and evidence require at least one exact locator.',
        path: ['locators'],
      });
    }

    const declaredSourceIds = new Set(claim.sourceIds);
    const locatedSourceIds = new Set(claim.locators.map((locator) => locator.sourceId));
    if (requiresProvenance) {
      for (const [index, sourceId] of claim.sourceIds.entries()) {
        if (!locatedSourceIds.has(sourceId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Declared source ${sourceId} requires at least one exact locator.`,
            path: ['sourceIds', index],
          });
        }
      }
    }

    for (const [index, locator] of claim.locators.entries()) {
      if (!declaredSourceIds.has(locator.sourceId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Locator source ${locator.sourceId} is not declared in the claim's sourceIds.`,
          path: ['locators', index, 'sourceId'],
        });
      }
    }
  });

export const sourceModuleSchema = z
  .object({
    records: z.array(sourceRecordSchema).max(64),
    claims: z.array(claimRecordSchema).max(512),
  })
  .strict()
  .superRefine((source, context) => {
    for (const id of duplicates(source.records.map((record) => record.id))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate source id: ${id}`,
        path: ['records'],
      });
    }

    for (const id of duplicates(source.claims.map((claim) => claim.id))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate claim id: ${id}`,
        path: ['claims'],
      });
    }
  });

export type SourceRecord = z.infer<typeof sourceRecordSchema>;
export type ClaimRecord = z.infer<typeof claimRecordSchema>;
export type SourceModule = z.infer<typeof sourceModuleSchema>;
