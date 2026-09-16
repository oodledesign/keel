import { z } from 'zod';

export const ImportGoreportPhrasesSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  scope: z.enum(['personal', 'workspace']),
  surveyType: z.enum(['rics_hss_l3', 'rics_hss_l2']).optional(),
  fileBase64: z.string().min(20).max(4_000_000),
  fileName: z.string().max(300).optional(),
});

export const ListSurveyPhrasesSchema = z.object({
  accountId: z.string().uuid(),
  ricsCode: z.string().max(40).optional(),
  sectionKey: z.string().max(80).optional(),
  query: z.string().max(200).optional(),
});

export const DeleteSurveyPhraseBankSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  bankId: z.string().uuid(),
});

export type ImportGoreportPhrasesInput = z.infer<
  typeof ImportGoreportPhrasesSchema
>;
export type ListSurveyPhrasesInput = z.infer<typeof ListSurveyPhrasesSchema>;
export type DeleteSurveyPhraseBankInput = z.infer<
  typeof DeleteSurveyPhraseBankSchema
>;

export type SurveyPhrase = {
  id: string;
  bankId: string;
  title: string;
  body: string;
  ricsCode: string | null;
  sectionKey: string | null;
  defaultRating: string | null;
  goreportPath: string | null;
};

export type SurveyPhraseBank = {
  id: string;
  name: string;
  scope: 'personal' | 'workspace';
  source: string | null;
  surveyType: string | null;
  phraseCount: number;
  createdAt: string;
};
