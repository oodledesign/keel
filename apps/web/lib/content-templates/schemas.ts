import { z } from 'zod';

import { CONTENT_TEMPLATE_KINDS } from '~/lib/content-templates/types';

export const UpsertSystemTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(CONTENT_TEMPLATE_KINDS),
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase kebab-case'),
  description: z.string().max(500).optional().nullable(),
  subject: z.string().max(500).optional().nullable(),
  bodyHtml: z.string().max(200_000).optional().default(''),
  bodyText: z.string().max(50_000).optional().default(''),
  signature: z.string().max(5000).optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export const DeleteSystemTemplateSchema = z.object({
  id: z.string().uuid(),
});

export const UpsertAccountTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).optional(),
  kind: z.enum([
    'proposal_html',
    'proposal_email',
    'contract_email',
    'invoice_email',
    'survey_report_html',
  ]),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  subject: z.string().max(500).optional().nullable(),
  bodyHtml: z.string().max(200_000).optional().default(''),
  bodyText: z.string().max(50_000).optional().default(''),
  signature: z.string().max(5000).optional().nullable(),
  isDefault: z.boolean().optional(),
  sourceSystemTemplateId: z.string().uuid().optional().nullable(),
});

export const DeleteAccountTemplateSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).optional(),
});

export const SetAccountTemplateDefaultSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).optional(),
});

export const DuplicateSystemToAccountSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).optional(),
  systemTemplateId: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
});

export const UpsertUserReplyPresetSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  bodyText: z.string().min(1).max(20_000),
  isDefault: z.boolean().optional(),
  sourceSystemTemplateId: z.string().uuid().optional().nullable(),
});

export const DeleteUserReplyPresetSchema = z.object({
  id: z.string().uuid(),
});

export const SetUserReplyPresetDefaultSchema = z.object({
  id: z.string().uuid(),
});

export const DuplicateSystemToUserSchema = z.object({
  systemTemplateId: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
});

export const ListTemplatesPickerSchema = z.object({
  kind: z.enum(CONTENT_TEMPLATE_KINDS),
  accountId: z.string().uuid().optional().nullable(),
});

export const GetResolvedTemplateSchema = z.object({
  source: z.enum(['system', 'account', 'user']),
  id: z.string().uuid(),
});
