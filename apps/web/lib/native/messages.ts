import 'server-only';

import { z } from 'zod';

import { createMessagesService } from '~/home/[account]/messages/_lib/server/messages.service';

import { NativeHttpError } from './http';
import {
  NativeComposeTypeSchema,
  NativeCreateThreadBodySchema,
  NativeSendMessageBodySchema,
} from './messages-shared';
import type { NativeWorkspace } from './workspace-shared';

export {
  NativeComposeTypeSchema,
  NativeCreateThreadBodySchema,
  NativeSendMessageBodySchema,
};

function accountSlug(workspace: NativeWorkspace) {
  return workspace.slug?.trim() || workspace.id;
}

function mapMessageError(error: unknown): never {
  const message = error instanceof Error ? error.message : 'Request failed';
  const lower = message.toLowerCase();

  if (
    lower.includes('not a participant') ||
    lower.includes('do not have access')
  ) {
    throw new NativeHttpError(403, message);
  }

  if (lower.includes('not found')) {
    throw new NativeHttpError(404, message);
  }

  throw new NativeHttpError(400, message);
}

export async function listNativeMessageThreads(params: {
  userId: string;
  workspace: NativeWorkspace;
  limit?: number;
  clientId?: string;
}) {
  try {
    const items = await createMessagesService().listThreads({
      accountId: params.workspace.id,
      userId: params.userId,
      clientId: params.clientId,
      limit: params.limit,
    });
    return { items };
  } catch (error) {
    mapMessageError(error);
  }
}

export async function createNativeMessageThread(params: {
  userId: string;
  workspace: NativeWorkspace;
  type: z.infer<typeof NativeComposeTypeSchema>;
  title?: string;
  jobId?: string | null;
  clientId?: string;
  memberUserIds?: string[];
  contactIds?: string[];
}) {
  try {
    const result = await createMessagesService().createThread({
      accountId: params.workspace.id,
      userId: params.userId,
      type: params.type,
      title: params.title,
      jobId: params.jobId,
      clientId: params.clientId,
      memberUserIds: params.memberUserIds,
      contactIds: params.contactIds,
    });
    return { ok: true as const, thread_id: result.threadId };
  } catch (error) {
    mapMessageError(error);
  }
}

export async function listNativeThreadMessages(params: {
  userId: string;
  workspace: NativeWorkspace;
  threadId: string;
  limit?: number;
  before?: string;
}) {
  try {
    const items = await createMessagesService().listMessages({
      accountId: params.workspace.id,
      userId: params.userId,
      threadId: params.threadId,
      accountSlug: accountSlug(params.workspace),
      limit: params.limit,
      before: params.before,
    });
    return { items };
  } catch (error) {
    mapMessageError(error);
  }
}

export async function sendNativeThreadMessage(params: {
  userId: string;
  workspace: NativeWorkspace;
  threadId: string;
  body?: string;
  imageUrl?: string;
  attachments?: Array<{ type: 'note' | 'doc'; id: string; title: string }>;
}) {
  try {
    return await createMessagesService().sendMessage({
      accountId: params.workspace.id,
      userId: params.userId,
      threadId: params.threadId,
      accountSlug: accountSlug(params.workspace),
      body: params.body ?? '',
      imageUrl: params.imageUrl,
      attachments: params.attachments,
    });
  } catch (error) {
    mapMessageError(error);
  }
}

export async function listNativeAttachableItems(params: {
  userId: string;
  workspace: NativeWorkspace;
  threadId: string;
}) {
  try {
    const items = await createMessagesService().listAttachableItems({
      accountId: params.workspace.id,
      userId: params.userId,
      threadId: params.threadId,
    });
    return { items };
  } catch (error) {
    mapMessageError(error);
  }
}
