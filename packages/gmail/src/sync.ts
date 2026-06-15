import 'server-only';

import { GmailApiError, gmailFetch, gmailFetchPaginated } from './client';
import {
  deleteEmailMessage,
  loadAssistantSettings,
  saveAssistantCursor,
  upsertEmailMessage,
  upsertEmailThread,
} from './db';
import { parseMessage, participantsFromMessage } from './mime';
import type { GmailMessage, GmailSyncResult } from './types';

const BACKFILL_QUERY = 'in:inbox newer_than:30d';

type GmailListMessage = { id?: string | null; threadId?: string | null };
type GmailProfile = { historyId?: string | null; emailAddress?: string | null };

function isUnread(labelIds: string[] | null | undefined) {
  return (labelIds ?? []).includes('UNREAD');
}

async function fetchMessage(userId: string, messageId: string): Promise<GmailMessage> {
  return gmailFetch<GmailMessage>(
    userId,
    `/messages/${encodeURIComponent(messageId)}?format=full`,
  );
}

async function persistMessage(userId: string, message: GmailMessage) {
  if (!message.id || !message.threadId) {
    return;
  }

  const parsed = parseMessage(message);
  const threadId = await upsertEmailThread({
    userId,
    gmailThreadId: message.threadId,
    subject: parsed.subject,
    participants: participantsFromMessage(message),
    snippet: message.snippet ?? null,
    labelIds: message.labelIds ?? [],
    isUnread: isUnread(message.labelIds),
    lastMessageAt: parsed.internalDate,
  });

  await upsertEmailMessage({
    userId,
    threadId,
    gmailMessageId: message.id,
    fromAddress: parsed.from,
    toAddresses: parsed.to,
    ccAddresses: parsed.cc,
    subject: parsed.subject,
    snippet: message.snippet ?? null,
    bodyText: parsed.bodyText,
    bodyHtml: parsed.bodyHtml,
    internalDate: parsed.internalDate,
  });
}

async function listBackfillMessageIds(userId: string): Promise<string[]> {
  const listed = await gmailFetchPaginated<GmailListMessage>(
    userId,
    '/messages',
    { q: BACKFILL_QUERY, maxResults: '100' },
    (page) => (page.messages as GmailListMessage[] | undefined) ?? [],
    (page) => page.nextPageToken as string | undefined,
  );

  return listed
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id));
}

async function fetchProfileHistoryId(userId: string): Promise<string | null> {
  const profile = await gmailFetch<GmailProfile>(userId, '/profile');
  return profile.historyId ?? null;
}

export async function backfill(userId: string): Promise<GmailSyncResult> {
  const messageIds = await listBackfillMessageIds(userId);
  let processed = 0;

  for (const messageId of messageIds) {
    const message = await fetchMessage(userId, messageId);
    await persistMessage(userId, message);
    processed += 1;
  }

  const historyId = await fetchProfileHistoryId(userId);
  await saveAssistantCursor(userId, historyId);

  return {
    mode: 'backfill',
    messagesProcessed: processed,
    historyId,
  };
}

function collectHistoryMessageIds(
  records: Array<Record<string, unknown>> | undefined,
) {
  const ids = new Set<string>();

  for (const record of records ?? []) {
    const buckets = [
      record.messagesAdded,
      record.labelsAdded,
      record.labelsRemoved,
      record.messages,
    ];

    for (const bucket of buckets) {
      if (!Array.isArray(bucket)) {
        continue;
      }

      for (const entry of bucket) {
        const message = (entry as { message?: { id?: string | null } }).message;
        if (message?.id) {
          ids.add(message.id);
        }
      }
    }

    for (const deleted of (record.messagesDeleted as Array<{
      message?: { id?: string | null };
    }> | null) ?? []) {
      if (deleted.message?.id) {
        ids.add(`__delete__:${deleted.message.id}`);
      }
    }
  }

  return ids;
}

export async function incrementalSync(userId: string): Promise<GmailSyncResult> {
  const settings = await loadAssistantSettings(userId);

  if (!settings?.last_history_id) {
    return backfill(userId);
  }

  try {
    let processed = 0;
    let latestHistoryId = settings.last_history_id;
    let pageToken: string | undefined;

    do {
      const search = new URLSearchParams({
        startHistoryId: latestHistoryId,
      });

      if (pageToken) {
        search.set('pageToken', pageToken);
      }

      const page = await gmailFetch<{
        history?: Array<Record<string, unknown>>;
        historyId?: string | null;
        nextPageToken?: string | null;
      }>(userId, `/history?${search.toString()}`);

      const messageIds = collectHistoryMessageIds(page.history);

      for (const token of messageIds) {
        if (token.startsWith('__delete__:')) {
          await deleteEmailMessage(userId, token.replace('__delete__:', ''));
          processed += 1;
          continue;
        }

        const message = await fetchMessage(userId, token);
        await persistMessage(userId, message);
        processed += 1;
      }

      if (page.historyId) {
        latestHistoryId = page.historyId;
      }

      pageToken = page.nextPageToken ?? undefined;
    } while (pageToken);

    await saveAssistantCursor(userId, latestHistoryId);

    return {
      mode: 'incremental',
      messagesProcessed: processed,
      historyId: latestHistoryId,
    };
  } catch (error) {
    if (error instanceof GmailApiError && error.status === 404) {
      return backfill(userId);
    }

    throw error;
  }
}

export async function syncMailbox(userId: string): Promise<GmailSyncResult> {
  const settings = await loadAssistantSettings(userId);

  if (!settings?.last_history_id) {
    return backfill(userId);
  }

  return incrementalSync(userId);
}
