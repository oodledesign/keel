import 'server-only';

import { GmailApiError, gmailFetch, gmailFetchPaginated } from './client';
import {
  deleteEmailMessage,
  listSyncedGmailMessageIds,
  loadAssistantSettings,
  saveAssistantCursor,
  touchAssistantSyncTime,
  upsertEmailMessage,
  upsertEmailThread,
} from './db';
import { parseMessage, participantsFromMessage } from './mime';
import type { GmailMessage, GmailSyncResult } from './types';

const BACKFILL_QUERY = 'newer_than:30d (in:inbox OR in:sent)';
/** Keep each serverless invocation under Vercel's 300s limit (full fetch per message). */
const BACKFILL_MAX_MESSAGES_PER_RUN = 40;

type GmailListMessage = { id?: string | null; threadId?: string | null };
type GmailProfile = { historyId?: string | null; emailAddress?: string | null };

function isUnread(labelIds: string[] | null | undefined) {
  return (labelIds ?? []).includes('UNREAD');
}

async function fetchMessage(
  userId: string,
  messageId: string,
): Promise<GmailMessage> {
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
  const syncedIds = await listSyncedGmailMessageIds(userId, messageIds);
  const pending = messageIds.filter((id) => !syncedIds.has(id));
  const batch = pending.slice(0, BACKFILL_MAX_MESSAGES_PER_RUN);
  let processed = 0;

  for (const messageId of batch) {
    const message = await fetchMessage(userId, messageId);
    await persistMessage(userId, message);
    processed += 1;
  }

  const remainingEstimate = Math.max(pending.length - batch.length, 0);
  const backfillComplete = remainingEstimate === 0;

  if (backfillComplete) {
    const historyId = await fetchProfileHistoryId(userId);
    await saveAssistantCursor(userId, historyId);

    return {
      mode: 'backfill',
      messagesProcessed: processed,
      historyId,
      backfillComplete: true,
      remainingEstimate: 0,
    };
  }

  await touchAssistantSyncTime(userId);

  return {
    mode: 'backfill',
    messagesProcessed: processed,
    historyId: null,
    backfillComplete: false,
    remainingEstimate,
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

export async function incrementalSync(
  userId: string,
): Promise<GmailSyncResult> {
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

type GmailThreadResponse = {
  id?: string | null;
  messages?: GmailMessage[] | null;
};

/**
 * Fetches a single Gmail thread and persists any missing messages
 * (including Sent replies that inbox-only backfill may have skipped).
 *
 * Use `format: 'metadata'` for a lighter refresh (headers + labels only).
 */
export async function syncGmailThread(
  userId: string,
  gmailThreadId: string,
  options?: { format?: 'full' | 'metadata' },
): Promise<{ messagesProcessed: number; latestIsSent: boolean }> {
  const format = options?.format ?? 'full';
  const search = new URLSearchParams({ format });

  if (format === 'metadata') {
    for (const header of ['From', 'To', 'Cc', 'Subject', 'Date']) {
      search.append('metadataHeaders', header);
    }
  }

  const thread = await gmailFetch<GmailThreadResponse>(
    userId,
    `/threads/${encodeURIComponent(gmailThreadId)}?${search.toString()}`,
  );

  const messages = [...(thread.messages ?? [])].sort((a, b) => {
    const aDate = Number(a.internalDate ?? 0);
    const bDate = Number(b.internalDate ?? 0);
    return aDate - bDate;
  });

  let processed = 0;
  for (const message of messages) {
    await persistMessage(userId, message);
    processed += 1;
  }

  const latest = messages.at(-1);
  const latestIsSent = (latest?.labelIds ?? []).includes('SENT');

  return { messagesProcessed: processed, latestIsSent };
}
