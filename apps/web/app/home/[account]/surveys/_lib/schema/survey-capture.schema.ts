import { z } from 'zod';

import { BUILDING_SURVEY_SECTIONS } from '~/lib/building-surveyor/report-sections';
import { BUILDING_SURVEY_TYPES } from '~/lib/building-surveyor/survey-types';

const surveyTypeKeys = BUILDING_SURVEY_TYPES.map((item) => item.key) as [
  (typeof BUILDING_SURVEY_TYPES)[number]['key'],
  ...(typeof BUILDING_SURVEY_TYPES)[number]['key'][],
];

export const SurveyTypeSchema = z.enum(surveyTypeKeys);

const sectionKeys = BUILDING_SURVEY_SECTIONS.map((section) => section.key) as [
  string,
  ...string[],
];

export const SurveySectionKeySchema = z.enum(sectionKeys);

export const SurveyAccountSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  proposalId: z.string().uuid(),
});

export const AddSurveyTranscriptSchema = SurveyAccountSchema.extend({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(20).max(120_000),
  meetingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const UpdateSurveyObservationSchema = SurveyAccountSchema.extend({
  observationId: z.string().uuid(),
  sectionKey: SurveySectionKeySchema.optional(),
  body: z.string().min(1).max(20_000).optional(),
});

export const CreateSurveyObservationSchema = SurveyAccountSchema.extend({
  sectionKey: SurveySectionKeySchema,
  body: z.string().min(1).max(20_000),
});

export const DeleteSurveyObservationSchema = SurveyAccountSchema.extend({
  observationId: z.string().uuid(),
});

export const UpdateSurveyTypeSchema = SurveyAccountSchema.extend({
  surveyType: SurveyTypeSchema,
});

export const GenerateSurveyDraftSchema = SurveyAccountSchema.extend({
  accountName: z.string().min(1).max(500),
  surveyorName: z.string().min(1).max(500),
});

export type AddSurveyTranscriptInput = z.infer<
  typeof AddSurveyTranscriptSchema
>;
export type UpdateSurveyObservationInput = z.infer<
  typeof UpdateSurveyObservationSchema
>;
export type CreateSurveyObservationInput = z.infer<
  typeof CreateSurveyObservationSchema
>;
export type DeleteSurveyObservationInput = z.infer<
  typeof DeleteSurveyObservationSchema
>;
export type UpdateSurveyTypeInput = z.infer<typeof UpdateSurveyTypeSchema>;
export type GenerateSurveyDraftInput = z.infer<
  typeof GenerateSurveyDraftSchema
>;

export type SurveyObservation = {
  id: string;
  proposalId: string;
  transcriptId: string | null;
  sectionKey: string;
  body: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type SurveyTranscriptSummary = {
  id: string;
  title: string;
  content: string;
  source: string;
  meetingDate: string | null;
  createdAt: string;
};
