import { z } from 'zod';

export const ListThreadsSchema = z.object({
  accountId: z.string().uuid(),
  userId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const ListMessagesSchema = z.object({
  accountId: z.string().uuid(),
  userId: z.string().uuid(),
  threadId: z.string().uuid(),
  accountSlug: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
  before: z.string().datetime().optional(),
});

export const ListAttachableSchema = z.object({
  accountId: z.string().uuid(),
  userId: z.string().uuid(),
  threadId: z.string().uuid(),
});

export const CreateThreadSchema = z.object({
  accountId: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum(['direct', 'group', 'job']),
  title: z.string().max(180).optional(),
  jobId: z.string().uuid().nullable().optional(),
  memberUserIds: z.array(z.string().uuid()).optional(),
  clientIds: z.array(z.string().uuid()).optional(),
});

export const SendMessageSchema = z.object({
  accountId: z.string().uuid(),
  userId: z.string().uuid(),
  threadId: z.string().uuid(),
  accountSlug: z.string().min(1),
  body: z.string().max(5000).default(''),
  imageUrl: z.string().url().max(2048).optional(),
  attachments: z
    .array(
      z.object({
        type: z.enum(['note', 'doc']),
        id: z.string().uuid(),
        title: z.string().min(1).max(200),
      }),
    )
    .max(5)
    .optional(),
});

export const MarkThreadReadSchema = z.object({
  accountId: z.string().uuid(),
  userId: z.string().uuid(),
  threadId: z.string().uuid(),
});

export const ArchiveThreadSchema = z.object({
  accountId: z.string().uuid(),
  userId: z.string().uuid(),
  threadId: z.string().uuid(),
});

export const DeleteMessageSchema = z.object({
  accountId: z.string().uuid(),
  userId: z.string().uuid(),
  threadId: z.string().uuid(),
  messageId: z.string().uuid(),
});

export const RenameThreadSchema = z.object({
  accountId: z.string().uuid(),
  userId: z.string().uuid(),
  threadId: z.string().uuid(),
  title: z.string().min(1).max(180),
});

export const SetThreadJobSchema = z.object({
  accountId: z.string().uuid(),
  userId: z.string().uuid(),
  threadId: z.string().uuid(),
  jobId: z.string().uuid().nullable(),
});
