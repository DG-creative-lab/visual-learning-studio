import { z } from 'zod';
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
  .strict();

export type LocalBindings = z.infer<typeof localBindingsSchema>;
