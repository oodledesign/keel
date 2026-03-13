import { z } from 'zod/v3';

export const KitEmailsListInputSchema = z.object({});

const EmailTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  file: z.string(),
  description: z.string(),
});

const KitEmailsListSuccessOutputSchema = z.object({
  templates: z.array(EmailTemplateSchema),
  categories: z.array(z.string()),
  total: z.number(),
});

export const KitEmailsListOutputSchema = KitEmailsListSuccessOutputSchema;

export const KitEmailsReadInputSchema = z.object({
  id: z.string().min(1),
});

const PropSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
});

const KitEmailsReadSuccessOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  file: z.string(),
  source: z.string(),
  props: z.array(PropSchema),
  renderedHtml: z.string().nullable(),
});

export const KitEmailsReadOutputSchema = KitEmailsReadSuccessOutputSchema;

export type KitEmailsListInput = z.infer<typeof KitEmailsListInputSchema>;
export type KitEmailsListOutput = z.infer<typeof KitEmailsListOutputSchema>;
export type KitEmailsReadInput = z.infer<typeof KitEmailsReadInputSchema>;
export type KitEmailsReadOutput = z.infer<typeof KitEmailsReadOutputSchema>;
