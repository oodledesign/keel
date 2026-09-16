import { z } from 'zod';

export const SurveySystemTemplateKeySchema = z.enum([
  'rics_hss_l3',
  'rics_hss_l2',
]);

export const CloneSurveyTemplateSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  systemKey: SurveySystemTemplateKeySchema,
  name: z.string().min(1).max(200).optional(),
  setDefault: z.boolean().optional(),
});

export const UpdateSurveyTemplateSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  templateId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  isDefault: z.boolean().optional(),
  brand: z
    .object({
      primaryColor: z.string().max(40).optional(),
      footerLabel: z.string().max(200).optional(),
      logoUrl: z.string().max(2_000).optional(),
      coverHeroUrl: z.string().max(2_000).optional(),
    })
    .optional(),
  surveyorDefaults: z.record(z.string(), z.string()).optional(),
  blocks: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        kind: z.string().min(1).max(40),
        letter: z.string().max(4).optional(),
        ricsCode: z.string().max(40).optional(),
        sectionKey: z.string().max(80).optional(),
        title: z.string().max(200).optional(),
        staticHtml: z.string().max(40_000).optional(),
        slots: z
          .array(
            z.object({
              type: z.enum(['merge', 'content', 'photos', 'rating', 'table']),
              path: z.string().max(80),
            }),
          )
          .optional(),
      }),
    )
    .max(200)
    .optional(),
});

export const DeleteSurveyTemplateSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  templateId: z.string().uuid(),
});

export type CloneSurveyTemplateInput = z.infer<
  typeof CloneSurveyTemplateSchema
>;
export type UpdateSurveyTemplateInput = z.infer<
  typeof UpdateSurveyTemplateSchema
>;
export type DeleteSurveyTemplateInput = z.infer<
  typeof DeleteSurveyTemplateSchema
>;
