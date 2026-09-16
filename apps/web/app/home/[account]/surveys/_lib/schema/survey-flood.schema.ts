import { z } from 'zod';

import { SurveyAccountSchema } from './survey-capture.schema';

export const PullSurveyFloodSchema = SurveyAccountSchema.extend({
  latitude: z.number().min(49).max(61).nullable().optional(),
  longitude: z.number().min(-9).max(3).nullable().optional(),
});

export const UpdateSurveyFloodSchema = SurveyAccountSchema.extend({
  floodZone: z.enum(['1', '2', '3']).nullable().optional(),
  riversAndSea: z.string().max(80).nullable().optional(),
  surfaceWater: z.string().max(80).nullable().optional(),
  summary: z.string().max(2000).nullable().optional(),
});

export const ClearSurveyFloodSchema = SurveyAccountSchema;

export type PullSurveyFloodInput = z.infer<typeof PullSurveyFloodSchema>;
export type UpdateSurveyFloodInput = z.infer<typeof UpdateSurveyFloodSchema>;
export type ClearSurveyFloodInput = z.infer<typeof ClearSurveyFloodSchema>;
