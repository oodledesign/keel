import { z } from 'zod';

import {
  CAMPAIGN_AUDIENCE_TYPES,
  CampaignAudienceConfigSchema,
} from '~/lib/campaigns/campaign-audience';
import { CampaignDocumentSchema } from '~/lib/campaigns/campaign-document';

export const CreateCampaignSeriesSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required').max(160),
  timezone: z.string().trim().max(80).optional(),
  recurrenceByWeekday: z.number().int().min(1).max(7),
  sendHour: z.number().int().min(0).max(23),
  sendMinute: z.number().int().min(0).max(59).optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  generateAhead: z.number().int().min(1).max(12).optional(),
  audienceType: z.enum(CAMPAIGN_AUDIENCE_TYPES).optional(),
  audienceConfig: CampaignAudienceConfigSchema.optional(),
  subject: z.string().trim().max(300).optional(),
  previewText: z.string().trim().max(200).optional().nullable(),
  bodyDocument: CampaignDocumentSchema.optional(),
  fromName: z.string().trim().max(120).optional().nullable(),
  fromEmail: z.string().trim().max(320).optional().nullable(),
  replyTo: z.string().trim().max(320).optional().nullable(),
});

export const UpdateCampaignSeriesSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  seriesId: z.string().uuid(),
  name: z.string().trim().min(1).max(160).optional(),
  timezone: z.string().trim().max(80).optional(),
  recurrenceByWeekday: z.number().int().min(1).max(7).optional(),
  sendHour: z.number().int().min(0).max(23).optional(),
  sendMinute: z.number().int().min(0).max(59).optional(),
  startsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  generateAhead: z.number().int().min(1).max(12).optional(),
  audienceType: z.enum(CAMPAIGN_AUDIENCE_TYPES).optional(),
  audienceConfig: CampaignAudienceConfigSchema.optional(),
  subject: z.string().trim().max(300).optional(),
  previewText: z.string().trim().max(200).optional().nullable(),
  status: z.enum(['active', 'paused', 'cancelled']).optional(),
});

export const CampaignSeriesInstanceActionSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  campaignId: z.string().uuid(),
  seriesId: z.string().uuid().optional(),
});
