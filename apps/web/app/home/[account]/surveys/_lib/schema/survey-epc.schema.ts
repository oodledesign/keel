import { z } from 'zod';

import { SurveyAccountSchema } from './survey-capture.schema';

export const SurveyPropertyLookupSchema = SurveyAccountSchema.extend({
  address: z.string().max(500).nullable().optional(),
  postcode: z.string().max(16).nullable().optional(),
  uprn: z.string().max(20).nullable().optional(),
  suggest: z.boolean().optional(),
});

export const SearchSurveyEpcSchema = SurveyAccountSchema.extend({
  address: z.string().max(500).nullable().optional(),
  postcode: z.string().max(16).nullable().optional(),
  uprn: z.string().max(20).nullable().optional(),
});

export const AttachSurveyEpcSchema = SurveyAccountSchema.extend({
  certificateNumber: z
    .string()
    .regex(
      /^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}$/,
      'Certificate number must be 20 digits',
    ),
});

export const ClearSurveyEpcSchema = SurveyAccountSchema;

export const UpdateSurveyEpcSchema = SurveyAccountSchema.extend({
  currentRating: z.string().max(4).nullable().optional(),
  potentialRating: z.string().max(4).nullable().optional(),
  lodgementDate: z.string().max(16).nullable().optional(),
  floorArea: z.number().nullable().optional(),
  fuelType: z.string().max(240).nullable().optional(),
  recommendationsSummary: z.string().max(4000).nullable().optional(),
});

export const RefreshSurveyEpcSchema = SurveyAccountSchema;

export type SurveyPropertyLookupInput = z.infer<
  typeof SurveyPropertyLookupSchema
>;
export type SearchSurveyEpcInput = z.infer<typeof SearchSurveyEpcSchema>;
export type AttachSurveyEpcInput = z.infer<typeof AttachSurveyEpcSchema>;
export type ClearSurveyEpcInput = z.infer<typeof ClearSurveyEpcSchema>;
export type UpdateSurveyEpcInput = z.infer<typeof UpdateSurveyEpcSchema>;
export type RefreshSurveyEpcInput = z.infer<typeof RefreshSurveyEpcSchema>;
