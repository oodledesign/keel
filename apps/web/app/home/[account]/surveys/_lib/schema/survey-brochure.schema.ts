import { z } from 'zod';

import { BROCHURE_SECTION_KEYS } from '~/lib/building-surveyor/brochure-import';

import { SurveyAccountSchema } from './survey-capture.schema';

export const PreviewSurveyBrochureSchema = SurveyAccountSchema.extend({
  filePath: z.string().min(1).max(500),
  originalFilename: z.string().max(260).optional(),
  mimeType: z.string().max(120).optional(),
});

export const ApplySurveyBrochureSchema = SurveyAccountSchema.extend({
  originDocId: z.string().uuid().nullable().optional(),
  choices: z
    .array(
      z.object({
        sectionKey: z.enum(BROCHURE_SECTION_KEYS),
        mode: z.enum(['exact', 'rewritten', 'skip']),
        exactText: z.string().max(20_000),
        rewrittenText: z.string().max(20_000),
      }),
    )
    .min(1)
    .max(10),
});

export type PreviewSurveyBrochureInput = z.infer<
  typeof PreviewSurveyBrochureSchema
>;
export type ApplySurveyBrochureInput = z.infer<
  typeof ApplySurveyBrochureSchema
>;
