import { z } from 'zod';
import { duplicates } from '../shared/identity.js';
import { stableIdSchema } from '../shared/identity.js';

export const localSourceBindingSchema = z
  .object({
    sourceId: stableIdSchema,
    path: z.string().min(1).max(4_000),
  })
  .strict();

export const localBindingsSchema = z
  .object({
    schemaVersion: z.literal('visual-learning.local-source-bindings/v1'),
    sources: z.array(localSourceBindingSchema).max(64),
  })
  .strict()
  .superRefine((bindings, context) => {
    for (const sourceId of duplicates(bindings.sources.map((binding) => binding.sourceId))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate local binding for source: ${sourceId}`,
        path: ['sources'],
      });
    }
  });

export type LocalBindings = z.infer<typeof localBindingsSchema>;
