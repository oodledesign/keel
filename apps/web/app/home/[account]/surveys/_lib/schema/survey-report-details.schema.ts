import { z } from 'zod';

import { COVER_MAX_ZOOM } from '~/lib/building-surveyor/survey-cover';
import {
  DroneBillingSchema,
  DroneFeePenceSchema,
} from '~/lib/building-surveyor/survey-drone';
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

export const UpdateSurveyDroneSchema = SurveyAccountSchema.extend({
  used: z.boolean().optional(),
  billing: DroneBillingSchema.optional(),
  /** NULL clears the fee so the workspace default applies. */
  feePence: DroneFeePenceSchema.nullable().optional(),
});

export const SaveDroneDefaultFeeSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  feePence: DroneFeePenceSchema,
});

export const CoverFocusSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  zoom: z.number().min(1).max(COVER_MAX_ZOOM),
});

export const UpdateSurveyCoverSchema = SurveyAccountSchema.extend({
  /** NULL clears the choice so the workspace default image applies. */
  photoDocId: z.string().uuid().nullable().optional(),
  /** NULL resets the crop to centred. */
  focus: CoverFocusSchema.nullable().optional(),
});

export const SaveCoverDefaultImageSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  /** Storage path of the uploaded image; NULL removes the default. */
  filePath: z.string().min(1).max(500).nullable(),
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
export type UpdateSurveyDroneInput = z.infer<typeof UpdateSurveyDroneSchema>;
export type SaveDroneDefaultFeeInput = z.infer<
  typeof SaveDroneDefaultFeeSchema
>;
export type UpdateSurveyCoverInput = z.infer<typeof UpdateSurveyCoverSchema>;
export type SaveCoverDefaultImageInput = z.infer<
  typeof SaveCoverDefaultImageSchema
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
