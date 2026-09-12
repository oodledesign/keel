import { z } from 'zod';

import {
  CAMPAIGN_AUDIENCE_TYPES,
  CampaignAudienceConfigSchema,
} from '~/lib/campaigns/campaign-audience';
import { AudienceListFiltersSchema } from '~/lib/campaigns/campaign-audience-filters';
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
  scheduledTimezone: z.string().trim().max(80).optional().nullable(),
  subjectB: z.string().trim().max(300).optional().nullable(),
  abEnabled: z.boolean().optional(),
  abSplitPercent: z.number().int().min(10).max(90).optional(),
});

export const SaveAudienceListSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  listId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  filters: AudienceListFiltersSchema,
  contactIds: z.array(z.string().uuid()).max(5000).optional(),
});

export const DeleteAudienceListSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  listId: z.string().uuid(),
});

export const AudienceListMembersSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  listId: z.string().uuid(),
  contactIds: z.array(z.string().uuid()).min(1).max(5000),
});

export const CreateListFromCategorySchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  mode: z.enum(['logic', 'manual']),
});

export const SaveCampaignContactSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  contactId: z.string().uuid().optional(),
  email: z.string().trim().email().max(320),
  firstName: z.string().trim().max(80).optional().nullable(),
  lastName: z.string().trim().max(80).optional().nullable(),
  fullName: z.string().trim().max(160).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  companyName: z.string().trim().max(160).optional().nullable(),
  industry: z.string().trim().max(120).optional().nullable(),
  categoryIds: z.array(z.string().uuid()).max(40).optional(),
});

export const SaveContactCategorySchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  categoryId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
});

export const ArchiveContactCategorySchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  categoryId: z.string().uuid(),
});

export const AssignContactCategoriesSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  contactIds: z.array(z.string().uuid()).min(1).max(5000),
  categoryIds: z.array(z.string().uuid()).min(1).max(40),
});

export const BulkAddContactsToListSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  listId: z.string().uuid().optional(),
  newListName: z.string().trim().min(1).max(120).optional(),
  contactIds: z.array(z.string().uuid()).min(1).max(5000),
});

export const SaveAutomationSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  automationId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  campaignId: z.string().uuid(),
  formId: z.string().uuid().nullable().optional(),
  audienceListId: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'paused']).optional(),
});

export const DeleteAutomationSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  automationId: z.string().uuid(),
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
