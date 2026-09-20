import { z } from 'zod';
import { distributionModuleSchema } from '../distribution/contracts.js';
import { editorialModuleSchema } from '../editorial/contracts.js';
import { productionModuleSchema } from '../production/contracts.js';
import { releaseModuleSchema } from '../release/contracts.js';
import { stableIdSchema } from '../shared/identity.js';
import { sourceModuleSchema } from '../source/contracts.js';

export const episodeProjectSchemaVersion = 'visual-learning.episode-project/v1' as const;

export const episodeProjectSchema = z
  .object({
    schemaVersion: z.literal(episodeProjectSchemaVersion),
    id: stableIdSchema,
    title: z.string().min(1).max(300),
    source: sourceModuleSchema,
    editorial: editorialModuleSchema,
    distribution: distributionModuleSchema,
    production: productionModuleSchema,
    release: releaseModuleSchema,
  })
  .strict();

export type EpisodeProject = z.infer<typeof episodeProjectSchema>;
