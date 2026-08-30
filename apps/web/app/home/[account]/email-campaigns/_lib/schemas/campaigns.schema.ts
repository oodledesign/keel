import { z } from 'zod';

import { CampaignDocumentSchema } from '~/lib/campaigns/campaign-document';

export const CreateCampaignSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required').max(160),
  subject: z.string().trim().max(300).default(''),
  previewText: z.string().trim().max(200).optional().nullable(),
  bodyDocument: CampaignDocumentSchema.optional(),
});

export const UpdateCampaignSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  campaignId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  subject: z.string().trim().max(300),
  previewText: z.string().trim().max(200).optional().nullable(),
  bodyDocument: CampaignDocumentSchema,
});

export const SendCampaignSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  campaignId: z.string().uuid(),
});

export const ScheduleCampaignSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  campaignId: z.string().uuid(),
  scheduledAt: z.string().min(1),
});

export const CancelScheduleCampaignSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  campaignId: z.string().uuid(),
});
