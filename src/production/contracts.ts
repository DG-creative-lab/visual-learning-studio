import { z } from 'zod';
import { duplicates, stableIdSchema } from '../shared/identity.js';
import { visualRelationshipSchema } from '../editorial/contracts.js';

export const voicePlanSchema = z
  .object({
    narratorMode: z.enum(['human', 'generated']),
    provider: z.string().min(1).max(200),
    voiceProfileId: z.string().min(1).max(200),
    scriptDigest: z.string().regex(/^[a-f0-9]{64}$/),
    outputPath: z.string().min(1).max(2_000),
  })
  .strict();

export const audioArtifactSchema = z
  .object({
    path: z.string().min(1).max(2_000),
    origin: z.enum(['human', 'generated']),
    contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
    durationSeconds: z.number().positive(),
  })
  .strict();

export const assetSchema = z
  .object({
    id: stableIdSchema,
    kind: z.enum(['vector', 'image', 'font', 'music', 'sound', 'character', 'other']),
    path: z.string().min(1).max(2_000),
    rightsStatus: z.enum(['unknown', 'owned', 'licensed', 'public_domain', 'generated']),
    rightsNote: z.string().min(1).max(2_000),
  })
  .strict();

export const sceneSchema = z
  .object({
    id: stableIdSchema,
    scriptSegmentIds: z.array(stableIdSchema).min(1).max(32),
    learningPurpose: z.string().min(1).max(1_000),
    relationship: visualRelationshipSchema,
    visualDirection: z.string().min(1).max(2_000),
    assetIds: z.array(stableIdSchema).max(64).default([]),
  })
  .strict();

export const renderPlanSchema = z
  .object({
    renderer: z.string().min(1).max(100),
    width: z.number().int().positive().max(7_680),
    height: z.number().int().positive().max(4_320),
    framesPerSecond: z.number().int().positive().max(120),
    outputPath: z.string().min(1).max(2_000),
  })
  .strict();

export const productionModuleSchema = z
  .object({
    voicePlan: voicePlanSchema.optional(),
    audio: audioArtifactSchema.optional(),
    scenes: z.array(sceneSchema).max(256),
    assets: z.array(assetSchema).max(1_024),
    renderPlan: renderPlanSchema.optional(),
  })
  .strict()
  .superRefine((production, context) => {
    for (const id of duplicates(production.scenes.map((scene) => scene.id))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate scene id: ${id}`,
        path: ['scenes'],
      });
    }

    for (const id of duplicates(production.assets.map((asset) => asset.id))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate asset id: ${id}`,
        path: ['assets'],
      });
    }
  });

export type VoicePlan = z.infer<typeof voicePlanSchema>;
export type AudioArtifact = z.infer<typeof audioArtifactSchema>;
export type ProductionModule = z.infer<typeof productionModuleSchema>;
