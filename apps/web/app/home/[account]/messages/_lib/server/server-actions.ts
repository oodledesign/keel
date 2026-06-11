'use server';

import { enhanceAction } from '@kit/next/actions';

import {
  ArchiveThreadSchema,
  CreateThreadSchema,
  DeleteMessageSchema,
  ListAttachableSchema,
  ListMessagesSchema,
  ListThreadsSchema,
  MarkThreadReadSchema,
  RenameThreadSchema,
  SetThreadJobSchema,
  SendMessageSchema,
} from './messages.schema';
import { createMessagesService } from './messages.service';

function getService() {
  return createMessagesService();
}

export const listMessageThreads = enhanceAction(
  async (input) => {
    return getService().listThreads(input);
  },
  { schema: ListThreadsSchema },
);

export const listThreadMessages = enhanceAction(
  async (input) => {
    return getService().listMessages(input);
  },
  { schema: ListMessagesSchema },
);

export const listAttachableMessageItems = enhanceAction(
  async (input) => {
    return getService().listAttachableItems(input);
  },
  { schema: ListAttachableSchema },
);

export const createMessageThread = enhanceAction(
  async (input) => {
    return getService().createThread(input);
  },
  { schema: CreateThreadSchema },
);

export const sendThreadMessage = enhanceAction(
  async (input) => {
    return getService().sendMessage(input);
  },
  { schema: SendMessageSchema },
);

export const markMessageThreadRead = enhanceAction(
  async (input) => {
    return getService().markThreadRead(input);
  },
  { schema: MarkThreadReadSchema },
);

export const archiveMessageThread = enhanceAction(
  async (input) => {
    return getService().archiveThread(input);
  },
  { schema: ArchiveThreadSchema },
);

export const deleteThreadMessage = enhanceAction(
  async (input) => {
    return getService().deleteMessage(input);
  },
  { schema: DeleteMessageSchema },
);

export const renameMessageThread = enhanceAction(
  async (input) => {
    return getService().renameThread(input);
  },
  { schema: RenameThreadSchema },
);

export const setMessageThreadJob = enhanceAction(
  async (input) => {
    return getService().setThreadJob(input);
  },
  { schema: SetThreadJobSchema },
);
