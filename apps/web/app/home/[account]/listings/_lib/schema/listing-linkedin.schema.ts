import { z } from 'zod';

export const LinkedInCopySourceSchema = z.enum(['ai', 'manual', 'description']);

export const GenerateLinkedInPostSchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
});

export const SaveListingLinkedInDraftSchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
  postId: z.string().uuid().optional(),
  body: z.string().max(3000),
  imageMediaIds: z.array(z.string().uuid()).max(20),
  overlayFirst: z.boolean(),
  listingUrl: z.string().url().nullable().optional(),
});

export const PostListingToLinkedInSchema = SaveListingLinkedInDraftSchema;

export const ScheduleListingLinkedInSchema =
  SaveListingLinkedInDraftSchema.extend({
    scheduledAt: z.string().min(1),
  });

export const PreviewLinkedInOverlaySchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
  mediaId: z.string().uuid(),
});
