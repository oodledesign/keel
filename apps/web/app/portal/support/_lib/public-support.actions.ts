'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';

import {
  addPublicSupportTicketReply,
  createPublicSupportTicket,
} from '~/lib/support/public-support.service';
import type { SupportAttachmentMeta } from '~/lib/support/support-tokens';

const AttachmentSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  mimeType: z.string().min(1),
  size: z.number().nonnegative(),
});

const CreatePublicTicketSchema = z.object({
  token: z.string().min(8),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  submitterContactId: z.string().uuid().nullable().optional(),
  submitterName: z.string().min(1).max(200),
  submitterEmail: z.string().email(),
  projectId: z.string().uuid().nullable().optional(),
  recordingUrl: z.string().url().nullable().optional().or(z.literal('')),
  externalUrl: z.string().url().nullable().optional().or(z.literal('')),
  attachments: z.array(AttachmentSchema).max(5).optional(),
});

const ReplyPublicTicketSchema = z.object({
  token: z.string().min(8),
  message: z.string().min(1).max(10000),
  authorName: z.string().min(1).max(200),
  authorEmail: z.string().email(),
  attachments: z.array(AttachmentSchema).max(5).optional(),
  externalUrl: z.string().url().nullable().optional().or(z.literal('')),
});

export const createPublicSupportTicketAction = enhanceAction(
  async (input) => {
    const result = await createPublicSupportTicket({
      token: input.token,
      title: input.title,
      description: input.description,
      priority: input.priority,
      submitterContactId: input.submitterContactId ?? null,
      submitterName: input.submitterName,
      submitterEmail: input.submitterEmail,
      projectId: input.projectId ?? null,
      recordingUrl: input.recordingUrl || null,
      externalUrl: input.externalUrl || null,
      attachments: (input.attachments ?? []) as SupportAttachmentMeta[],
    });

    return { success: true as const, ...result };
  },
  { schema: CreatePublicTicketSchema, auth: false },
);

export const replyPublicSupportTicketAction = enhanceAction(
  async (input) => {
    await addPublicSupportTicketReply({
      token: input.token,
      message: input.message,
      authorName: input.authorName,
      authorEmail: input.authorEmail,
      attachments: (input.attachments ?? []) as SupportAttachmentMeta[],
      externalUrl: input.externalUrl || null,
    });

    return { success: true as const };
  },
  { schema: ReplyPublicTicketSchema, auth: false },
);
