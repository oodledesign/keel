import { z } from 'zod';

import {
  CAMPAIGN_AUDIENCE_TYPES,
  CampaignAudienceConfigSchema,
} from '~/lib/campaigns/campaign-audience';
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
  name: z.string().trim().min(1).max(160).optional(),
  subject: z.string().trim().max(300).optional(),
  previewText: z.string().trim().max(200).optional().nullable(),
  bodyDocument: CampaignDocumentSchema.optional(),
  fromName: z.string().trim().max(120).optional().nullable(),
  fromEmail: z.string().trim().max(320).optional().nullable(),
  replyTo: z.string().trim().max(320).optional().nullable(),
  audienceType: z.enum(CAMPAIGN_AUDIENCE_TYPES).optional(),
  audienceConfig: CampaignAudienceConfigSchema.optional(),
  scheduledAt: z.string().optional().nullable(),
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

export const SendCampaignTestSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  campaignId: z.string().uuid(),
  emails: z
    .array(z.string().trim().email().max(320))
    .min(1, 'Add at least one email')
    .max(20),
});
