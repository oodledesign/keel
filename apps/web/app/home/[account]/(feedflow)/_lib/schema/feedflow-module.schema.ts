import { z } from 'zod';

export const createFeedflowWidgetActionSchema = z.object({
  accountId: z.string().uuid(),
  socialAccountId: z.string().uuid(),
  name: z.string().min(1).max(200),
});

export const deleteFeedflowSocialAccountActionSchema = z.object({
  accountId: z.string().uuid(),
  socialAccountId: z.string().uuid(),
});

const accountId = z.string().uuid();
const connectionId = z.string().uuid();

export const connectWebflowActionSchema = z.object({
  accountId,
  clientId: z.string().uuid().nullable().optional(),
  token: z.string().trim().min(10).max(500),
});

export const loadWebflowTargetsActionSchema = z.object({
  accountId,
  connectionId,
  siteId: z.string().min(1).max(100).optional(),
});

export const saveWebflowTargetActionSchema = z.object({
  accountId,
  connectionId,
  siteId: z.string().min(1).max(100),
  collectionId: z.string().min(1).max(100),
});

export const webflowConnectionActionSchema = z.object({
  accountId,
  connectionId,
});

export const saveWebflowSettingsActionSchema = z.object({
  accountId,
  connectionId,
  mapping: z.record(z.string(), z.string().max(100)),
  syncMode: z.enum(['all', 'with_text']),
  autoPublish: z.boolean(),
  minRating: z.number().int().min(1).max(5),
  minCharacterCount: z.number().int().min(0).max(5000),
});

export const addManualReviewActionSchema = z.object({
  accountId,
  clientId: z.string().uuid().nullable().optional(),
  reviewerName: z.string().trim().min(1).max(200),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(4000).optional(),
  reviewedAt: z.string().max(40).optional(),
});

export const importReviewsCsvActionSchema = z.object({
  accountId,
  clientId: z.string().uuid().nullable().optional(),
  csv: z.string().min(1).max(1_000_000),
});

export const setReviewHiddenActionSchema = z.object({
  accountId,
  reviewId: z.string().uuid(),
  hidden: z.boolean(),
});

export const deleteReviewActionSchema = z.object({
  accountId,
  reviewId: z.string().uuid(),
});
