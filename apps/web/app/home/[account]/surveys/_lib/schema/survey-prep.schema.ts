import { z } from 'zod';

import { FLOOD_RISK_BANDS } from '~/lib/building-surveyor/flood/types';

import { SurveyAccountSchema } from './survey-capture.schema';

const optionalLatitude = z.number().min(-90).max(90).nullable().optional();
const optionalLongitude = z.number().min(-180).max(180).nullable().optional();

export const ConfirmSurveyAddressSchema = SurveyAccountSchema.extend({
  address: z.string().max(500).nullable().optional(),
  postcode: z.string().max(16).nullable().optional(),
  uprn: z.string().max(20).nullable().optional(),
  latitude: optionalLatitude,
  longitude: optionalLongitude,
  titleFromAddress: z.boolean().optional(),
});

export const PullSurveyFloodSchema = SurveyAccountSchema.extend({
  address: z.string().max(500).nullable().optional(),
  postcode: z.string().max(16).nullable().optional(),
  latitude: optionalLatitude,
  longitude: optionalLongitude,
});

export const UpdateSurveyFloodSchema = SurveyAccountSchema.extend({
  band: z.enum(FLOOD_RISK_BANDS).nullable(),
  summary: z.string().max(2_000).nullable(),
});

export const UpdateSurveyLevelSchema = SurveyAccountSchema.extend({
  surveyLevel: z.union([z.literal(2), z.literal(3)]),
});

export type ConfirmSurveyAddressInput = z.infer<
  typeof ConfirmSurveyAddressSchema
>;
export type PullSurveyFloodInput = z.infer<typeof PullSurveyFloodSchema>;
export type UpdateSurveyFloodInput = z.infer<typeof UpdateSurveyFloodSchema>;
export type UpdateSurveyLevelInput = z.infer<typeof UpdateSurveyLevelSchema>;
