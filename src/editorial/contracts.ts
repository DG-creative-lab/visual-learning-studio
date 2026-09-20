import { z } from 'zod';
import { duplicates, stableIdSchema } from '../shared/identity.js';

export const audienceSchema = z
  .object({
    primary: z.string().min(1).max(300),
    priorKnowledge: z.string().min(1).max(1_000),
    decisionContext: z.string().min(1).max(1_000),
  })
  .strict();

export const learningObjectiveSchema = z
  .object({
    id: stableIdSchema,
    outcome: z.string().min(1).max(1_000),
    evidenceOfLearning: z.string().min(1).max(1_000),
  })
  .strict();

export const visualRelationshipSchema = z.enum([
  'define',
  'cause',
  'sequence',
  'contrast',
  'example',
  'transfer',
  'retrieve',
]);

export const narrativeBeatSchema = z
  .object({
    id: stableIdSchema,
    title: z.string().min(1).max(200),
    purpose: z.string().min(1).max(1_000),
    relationship: visualRelationshipSchema,
    claimIds: z.array(stableIdSchema).min(1).max(32),
  })
  .strict();

export const scriptSegmentSchema = z
  .object({
    id: stableIdSchema,
    beatId: stableIdSchema,
    narration: z.string().min(1).max(5_000),
    claimIds: z.array(stableIdSchema).min(1).max(32),
    intendedSeconds: z.number().positive().max(600),
  })
  .strict();

export const editorialModuleSchema = z
  .object({
    audience: audienceSchema,
    learningObjective: learningObjectiveSchema,
    narrative: z.array(narrativeBeatSchema).max(64),
    script: z.array(scriptSegmentSchema).max(256),
  })
  .strict()
  .superRefine((editorial, context) => {
    for (const id of duplicates(editorial.narrative.map((beat) => beat.id))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate narrative beat id: ${id}`,
        path: ['narrative'],
      });
    }

    for (const id of duplicates(editorial.script.map((segment) => segment.id))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate script segment id: ${id}`,
        path: ['script'],
      });
    }
  });

export type EditorialModule = z.infer<typeof editorialModuleSchema>;
export type NarrativeBeat = z.infer<typeof narrativeBeatSchema>;
export type ScriptSegment = z.infer<typeof scriptSegmentSchema>;
