import { z } from 'zod';

import {
  SurveyAccommodationSchema,
  SurveyServicesSchema,
  SurveyorProfileFieldsSchema,
} from '~/lib/building-surveyor/survey-report-details';

import { SurveyAccountSchema } from './survey-capture.schema';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

export const UpdateSurveyReportDetailsSchema = SurveyAccountSchema.extend({
  inspectionDate: isoDate.optional(),
  termsReceivedDate: isoDate.optional(),
  reportReference: z.string().trim().max(80).nullable().optional(),
});

export const UpdateSurveyAccommodationSchema = SurveyAccountSchema.extend({
  accommodation: SurveyAccommodationSchema,
});

export const UpdateSurveyServicesSchema = SurveyAccountSchema.extend({
  services: SurveyServicesSchema,
});

export const SaveSurveyorProfileSchema = SurveyorProfileFieldsSchema.extend({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
});

export type UpdateSurveyReportDetailsInput = z.infer<
  typeof UpdateSurveyReportDetailsSchema
>;
export type UpdateSurveyAccommodationInput = z.infer<
  typeof UpdateSurveyAccommodationSchema
>;
export type UpdateSurveyServicesInput = z.infer<
  typeof UpdateSurveyServicesSchema
>;
export type SaveSurveyorProfileInput = z.infer<
  typeof SaveSurveyorProfileSchema
>;
