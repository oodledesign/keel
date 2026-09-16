import { z } from 'zod';

import { BUILDING_SURVEY_SECTIONS } from '~/lib/building-surveyor/report-sections';
import { SURVEY_SECTION_CATALOGUE } from '~/lib/building-surveyor/survey-section-catalogue';
import { BUILDING_SURVEY_TYPES } from '~/lib/building-surveyor/survey-types';

const surveyTypeKeys = BUILDING_SURVEY_TYPES.map((item) => item.key) as [
  (typeof BUILDING_SURVEY_TYPES)[number]['key'],
  ...(typeof BUILDING_SURVEY_TYPES)[number]['key'][],
];

export const SurveyTypeSchema = z.enum(surveyTypeKeys);

const sectionKeys = [
  ...new Set([
    ...BUILDING_SURVEY_SECTIONS.map((section) => section.key),
    ...SURVEY_SECTION_CATALOGUE.map((item) => item.key),
  ]),
] as [string, ...string[]];

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

export const ConditionRatingSchema = z.enum(['1', '2', '3', 'NA', 'NI']);

export const UpdateSurveyObservationSchema = SurveyAccountSchema.extend({
  observationId: z.string().uuid(),
  sectionKey: SurveySectionKeySchema.optional(),
  body: z.string().min(1).max(20_000).optional(),
  conditionRating: ConditionRatingSchema.nullable().optional(),
});

export const CreateSurveyObservationSchema = SurveyAccountSchema.extend({
  sectionKey: SurveySectionKeySchema,
  body: z.string().min(1).max(20_000),
  conditionRating: ConditionRatingSchema.nullable().optional(),
});

export const DeleteSurveyObservationSchema = SurveyAccountSchema.extend({
  observationId: z.string().uuid(),
});

export const UpdateSurveyTypeSchema = SurveyAccountSchema.extend({
  surveyType: SurveyTypeSchema,
  surveyTemplateId: z.string().uuid().nullable().optional(),
});

export const GenerateSurveyDraftSchema = SurveyAccountSchema.extend({
  accountName: z.string().min(1).max(500),
  surveyorName: z.string().min(1).max(500),
});

export const ProposeSurveyPhotoCurationSchema = SurveyAccountSchema;

export const UpdateSurveyPhotoCurationSchema = SurveyAccountSchema.extend({
  docId: z.string().uuid(),
  sectionKey: SurveySectionKeySchema.nullable().optional(),
  caption: z.string().max(500).nullable().optional(),
  photoRole: z.enum(['archive', 'curated']).optional(),
  curatedSortOrder: z.number().int().min(0).max(99).nullable().optional(),
});

export const ReorderSurveyPhotosSchema = SurveyAccountSchema.extend({
  orderedDocIds: z.array(z.string().uuid()).min(1).max(80),
  sectionKey: SurveySectionKeySchema,
});

export const SetSurveyPhotoShareSchema = SurveyAccountSchema.extend({
  enabled: z.boolean(),
});

export const AddSurveyStyleExampleSchema = z
  .object({
    accountId: z.string().uuid(),
    accountSlug: z.string().min(1).max(200),
    title: z.string().min(1).max(500),
    filePath: z.string().min(1).max(1_000),
    mimeType: z.string().max(200).nullable().optional(),
    originalFilename: z.string().max(500).optional(),
  })
  .refine((value) => value.filePath.startsWith(`${value.accountId}/`), {
    message: 'File must be stored under this workspace',
    path: ['filePath'],
  });

export const UpdateSurveyStyleExampleSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  exampleId: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  styleNotes: z.string().max(8_000).nullable().optional(),
});

export const DeleteSurveyStyleExampleSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  exampleId: z.string().uuid(),
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
export type ProposeSurveyPhotoCurationInput = z.infer<
  typeof ProposeSurveyPhotoCurationSchema
>;
export type UpdateSurveyPhotoCurationInput = z.infer<
  typeof UpdateSurveyPhotoCurationSchema
>;
export type ReorderSurveyPhotosInput = z.infer<
  typeof ReorderSurveyPhotosSchema
>;
export type SetSurveyPhotoShareInput = z.infer<
  typeof SetSurveyPhotoShareSchema
>;
export type AddSurveyStyleExampleInput = z.infer<
  typeof AddSurveyStyleExampleSchema
>;
export type UpdateSurveyStyleExampleInput = z.infer<
  typeof UpdateSurveyStyleExampleSchema
>;
export type DeleteSurveyStyleExampleInput = z.infer<
  typeof DeleteSurveyStyleExampleSchema
>;

export type SurveyObservation = {
  id: string;
  proposalId: string;
  transcriptId: string | null;
  sectionKey: string;
  ricsCode: string | null;
  body: string;
  conditionRating: '1' | '2' | '3' | 'NA' | 'NI' | null;
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

export type SurveyStyleExample = {
  id: string;
  title: string;
  originalFilename: string | null;
  mimeType: string | null;
  styleNotes: string | null;
  extractedPreview: string;
  createdAt: string;
};

export type SurveyPhotoShare = {
  enabled: boolean;
  token: string | null;
};
