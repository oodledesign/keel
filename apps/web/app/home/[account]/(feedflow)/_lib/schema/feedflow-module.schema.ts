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
