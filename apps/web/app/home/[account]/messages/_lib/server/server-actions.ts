'use server';

import { enhanceAction } from '@kit/next/actions';

import {
  blockChatUser,
  reportChatMessage,
  unblockChatUser,
} from '~/lib/messages/message-safety';
import {
  ChatUserIdSchema,
  ReportChatMessageSchema,
} from '~/lib/messages/message-safety-shared';

import {
  ArchiveThreadSchema,
  CreateThreadSchema,
  DeleteMessageSchema,
  ListAttachableSchema,
  ListMessagesSchema,
  ListPortalThreadsSchema,
  ListThreadsSchema,
  MarkThreadReadSchema,
  RenameThreadSchema,
  SendMessageSchema,
  SetThreadJobSchema,
} from './messages.schema';
import { createMessagesService } from './messages.service';

function getService() {
  return createMessagesService();
}

/** The service uses the admin client, so never trust a userId from the browser. */
function asSignedInUser<T extends { userId: string }>(
  input: T,
  user: { id: string },
): T {
  return { ...input, userId: user.id };
}

function safetyError(error: unknown, fallback: string) {
  return {
    ok: false as const,
    error: error instanceof Error && error.message ? error.message : fallback,
  };
}

export const listMessageThreads = enhanceAction(
  async (input, user) => {
    return getService().listThreads(asSignedInUser(input, user));
  },
  { schema: ListThreadsSchema },
);

export const listThreadMessages = enhanceAction(
  async (input, user) => {
    return getService().listMessages(asSignedInUser(input, user));
  },
  { schema: ListMessagesSchema },
);

export const listAttachableMessageItems = enhanceAction(
  async (input, user) => {
    return getService().listAttachableItems(asSignedInUser(input, user));
  },
  { schema: ListAttachableSchema },
);

export const createMessageThread = enhanceAction(
  async (input, user) => {
    try {
      const result = await getService().createThread(
        asSignedInUser(input, user),
      );
      return { ok: true as const, threadId: result.threadId };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : 'Failed to create chat',
      };
    }
  },
  { schema: CreateThreadSchema },
);

export const sendThreadMessage = enhanceAction(
  async (input, user) => {
    return getService().sendMessage(asSignedInUser(input, user));
  },
  { schema: SendMessageSchema },
);

export const markMessageThreadRead = enhanceAction(
  async (input, user) => {
    return getService().markThreadRead(asSignedInUser(input, user));
  },
  { schema: MarkThreadReadSchema },
);

export const archiveMessageThread = enhanceAction(
  async (input, user) => {
    return getService().archiveThread(asSignedInUser(input, user));
  },
  { schema: ArchiveThreadSchema },
);

export const deleteThreadMessage = enhanceAction(
  async (input, user) => {
    return getService().deleteMessage(asSignedInUser(input, user));
  },
  { schema: DeleteMessageSchema },
);

export const renameMessageThread = enhanceAction(
  async (input, user) => {
    return getService().renameThread(asSignedInUser(input, user));
  },
  { schema: RenameThreadSchema },
);

export const setMessageThreadJob = enhanceAction(
  async (input, user) => {
    return getService().setThreadJob(asSignedInUser(input, user));
  },
  { schema: SetThreadJobSchema },
);

export const listPortalMessageThreads = enhanceAction(
  async (input, user) => {
    return getService().listPortalThreads({
      userId: user.id,
      clientOrgId: input.clientOrgId,
    });
  },
  { auth: true, schema: ListPortalThreadsSchema },
);

export const reportChatMessageAction = enhanceAction(
  async (input, user) => {
    try {
      const result = await reportChatMessage({
        userId: user.id,
        accountId: input.accountId,
        threadId: input.threadId,
        messageId: input.messageId,
        reason: input.reason,
        details: input.details,
        block: input.block,
        source: 'web',
      });
      return { ok: true as const, ...result };
    } catch (error) {
      return safetyError(error, 'Could not send the report');
    }
  },
  { schema: ReportChatMessageSchema },
);

export const blockChatUserAction = enhanceAction(
  async (input, user) => {
    try {
      await blockChatUser(user.id, input.userId);
      return { ok: true as const };
    } catch (error) {
      return safetyError(error, 'Could not block this person');
    }
  },
  { schema: ChatUserIdSchema },
);

export const unblockChatUserAction = enhanceAction(
  async (input, user) => {
    try {
      await unblockChatUser(user.id, input.userId);
      return { ok: true as const };
    } catch (error) {
      return safetyError(error, 'Could not unblock this person');
    }
  },
  { schema: ChatUserIdSchema },
);
