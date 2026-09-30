import { z } from 'zod';

const accountProject = {
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
};

const body = z.string().trim().min(1, 'Write a comment').max(4000);

export const AddCanvasCommentSchema = z.object({
  ...accountProject,
  accountSlug: z.string().min(1),
  itemId: z.string().uuid(),
  body,
  mentions: z.array(z.string().uuid()).max(20).default([]),
});

export const UpdateCanvasCommentSchema = z.object({
  ...accountProject,
  commentId: z.string().uuid(),
  body,
});

export const ResolveCanvasCommentSchema = z.object({
  ...accountProject,
  commentId: z.string().uuid(),
  resolved: z.boolean(),
});

export const DeleteCanvasCommentSchema = z.object({
  ...accountProject,
  commentId: z.string().uuid(),
});

export type AddCanvasCommentInput = z.infer<typeof AddCanvasCommentSchema>;
export type UpdateCanvasCommentInput = z.infer<
  typeof UpdateCanvasCommentSchema
>;
export type ResolveCanvasCommentInput = z.infer<
  typeof ResolveCanvasCommentSchema
>;
export type DeleteCanvasCommentInput = z.infer<
  typeof DeleteCanvasCommentSchema
>;
