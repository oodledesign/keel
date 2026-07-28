import 'server-only';

import type { MailboxKind } from '@kit/google-auth';

import { GmailApiError, gmailFetch } from './client';
import {
  deleteEmailMessage,
  listSyncedGmailMessageIds,
  loadAssistantSettings,
  resolveConnectionId,
  saveAssistantCursor,
  upsertEmailMessage,
  upsertEmailThread,
} from './db';
import {
  htmlSignatureToPlain,
  parseMessage,
  participantsFromMessage,
} from './mime';
import type { GmailMessage, GmailSyncResult } from './types';

/** Recent mail only — older threads stay in Gmail; already-synced rows remain in Ozer. */
const BACKFILL_QUERY = 'newer_than:14d (in:inbox OR in:sent)';
/** Parallel full fetches stay under the Gmail sync route maxDuration (120s). */
const BACKFILL_MAX_MESSAGES_PER_RUN = 60;
const INCREMENTAL_MAX_MESSAGES_PER_RUN = 80;
const FETCH_CONCURRENCY = 8;
const MAX_BODY_TEXT_CHARS = 20_000;

type GmailListMessage = { id?: string | null; threadId?: string | null };
type GmailProfile = { historyId?: string | null; emailAddress?: string | null };

type SyncContext = {
  userId: string;
  connectionId: string;
  mailboxKind: MailboxKind;
};

function isUnread(labelIds: string[] | null | undefined) {
  return (labelIds ?? []).includes('UNREAD');
}

function truncateBodyText(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= MAX_BODY_TEXT_CHARS) return value;
  return `${value.slice(0, MAX_BODY_TEXT_CHARS)}\n…`;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];

  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

async function requireSyncContext(
  userId: string,
  mailboxKind: MailboxKind,
): Promise<SyncContext> {
  const connectionId = await resolveConnectionId(userId, mailboxKind);

  if (!connectionId) {
    throw new Error('Google account is not connected');
  }

  return { userId, connectionId, mailboxKind };
}

async function fetchMessage(
  ctx: SyncContext,
  messageId: string,
): Promise<GmailMessage> {
  return gmailFetch<GmailMessage>(
    ctx.userId,
    `/messages/${encodeURIComponent(messageId)}?format=full`,
    undefined,
    ctx.mailboxKind,
  );
}

async function persistMessage(ctx: SyncContext, message: GmailMessage) {
  if (!message.id || !message.threadId) {
    return;
  }

  const parsed = parseMessage(message);
  const bodyText = truncateBodyText(
    parsed.bodyText?.trim() ||
      (parsed.bodyHtml ? htmlSignatureToPlain(parsed.bodyHtml) : null),
  );

  const threadId = await upsertEmailThread({
    userId: ctx.userId,
    connectionId: ctx.connectionId,
    gmailThreadId: message.threadId,
    subject: parsed.subject,
    participants: participantsFromMessage(message),
    snippet: message.snippet ?? null,
    labelIds: message.labelIds ?? [],
    isUnread: isUnread(message.labelIds),
    lastMessageAt: parsed.internalDate,
  });

  await upsertEmailMessage({
    userId: ctx.userId,
    connectionId: ctx.connectionId,
    threadId,
    gmailMessageId: message.id,
    fromAddress: parsed.from,
    toAddresses: parsed.to,
    ccAddresses: parsed.cc,
    subject: parsed.subject,
    snippet: message.snippet ?? null,
    bodyText,
    // UI + assistant use body_text; skip storing HTML to cut write size.
    bodyHtml: null,
    internalDate: parsed.internalDate,
  });
}

/**
 * List message IDs until we have enough unsynced ones (or the query ends).
 * Avoids re-paging the entire 14-day window on every backfill visit.
 */
async function listPendingBackfillMessageIds(
  ctx: SyncContext,
  limit: number,
): Promise<{ pending: string[]; exhausted: boolean }> {
  const pending: string[] = [];
  let pageToken: string | undefined;
  let exhausted = false;

  do {
    const search = new URLSearchParams({
      q: BACKFILL_QUERY,
      maxResults: '100',
    });
    if (pageToken) {
      search.set('pageToken', pageToken);
    }

    const page = await gmailFetch<{
      messages?: GmailListMessage[];
      nextPageToken?: string | null;
    }>(
      ctx.userId,
      `/messages?${search.toString()}`,
      undefined,
      ctx.mailboxKind,
    );

    const pageIds = (page.messages ?? [])
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id));

    if (!pageIds.length) {
      exhausted = true;
      break;
    }

    const syncedIds = await listSyncedGmailMessageIds(
      ctx.userId,
      pageIds,
      ctx.connectionId,
    );

    for (const id of pageIds) {
      if (!syncedIds.has(id)) {
        pending.push(id);
        if (pending.length >= limit) {
          return { pending, exhausted: false };
        }
      }
    }

    pageToken = page.nextPageToken ?? undefined;
    if (!pageToken) {
      exhausted = true;
    }
  } while (pageToken);

  return { pending, exhausted };
}

async function fetchProfileHistoryId(ctx: SyncContext): Promise<string | null> {
  const profile = await gmailFetch<GmailProfile>(
    ctx.userId,
    '/profile',
    undefined,
    ctx.mailboxKind,
  );
  return profile.historyId ?? null;
}

export async function backfill(
  userId: string,
  mailboxKind: MailboxKind = 'business',
): Promise<GmailSyncResult> {
  const ctx = await requireSyncContext(userId, mailboxKind);
  const { pending, exhausted } = await listPendingBackfillMessageIds(
    ctx,
    BACKFILL_MAX_MESSAGES_PER_RUN,
  );
  const batch = pending.slice(0, BACKFILL_MAX_MESSAGES_PER_RUN);

  await mapPool(batch, FETCH_CONCURRENCY, async (messageId) => {
    const message = await fetchMessage(ctx, messageId);
    await persistMessage(ctx, message);
  });

  const processed = batch.length;
  const backfillComplete = exhausted && pending.length <= batch.length;

  if (backfillComplete) {
    const historyId = await fetchProfileHistoryId(ctx);
    await saveAssistantCursor(userId, historyId, mailboxKind);

    return {
      mode: 'backfill',
      messagesProcessed: processed,
      historyId,
      backfillComplete: true,
      remainingEstimate: 0,
    };
  }

  // Do not bump last_synced_at mid-backfill — keeps cron/UI prioritising catch-up.
  return {
    mode: 'backfill',
    messagesProcessed: processed,
    historyId: null,
    backfillComplete: false,
    remainingEstimate: exhausted
      ? Math.max(pending.length - batch.length, 0)
      : Math.max(pending.length - batch.length, 1),
  };
}

function collectHistoryMessageIds(
  records: Array<Record<string, unknown>> | undefined,
) {
  const ids = new Set<string>();

  for (const record of records ?? []) {
    // messageAdded / messageDeleted only — label noise used to force full refetches.
    const buckets = [record.messagesAdded, record.messagesDeleted];

    for (const bucket of buckets) {
      if (!Array.isArray(bucket)) {
        continue;
      }

      for (const entry of bucket) {
        const message = (entry as { message?: { id?: string | null } }).message;
        if (!message?.id) continue;

        if (bucket === record.messagesDeleted) {
          ids.add(`__delete__:${message.id}`);
        } else {
          ids.add(message.id);
        }
      }
    }
  }

  return ids;
}

export async function incrementalSync(
  userId: string,
  mailboxKind: MailboxKind = 'business',
): Promise<GmailSyncResult> {
  const settings = await loadAssistantSettings(userId, mailboxKind);

  if (!settings?.last_history_id) {
    return backfill(userId, mailboxKind);
  }

  const ctx = await requireSyncContext(userId, mailboxKind);

  try {
    let processed = 0;
    let latestHistoryId = settings.last_history_id;
    let pageToken: string | undefined;
    const toFetch: string[] = [];
    const toDelete: string[] = [];
    let hitCap = false;

    do {
      const search = new URLSearchParams({
        startHistoryId: latestHistoryId,
      });
      search.append('historyTypes', 'messageAdded');
      search.append('historyTypes', 'messageDeleted');

      if (pageToken) {
        search.set('pageToken', pageToken);
      }

      const page = await gmailFetch<{
        history?: Array<Record<string, unknown>>;
        historyId?: string | null;
        nextPageToken?: string | null;
      }>(ctx.userId, `/history?${search.toString()}`, undefined, mailboxKind);

      const messageIds = collectHistoryMessageIds(page.history);

      for (const token of messageIds) {
        if (token.startsWith('__delete__:')) {
          toDelete.push(token.replace('__delete__:', ''));
        } else {
          toFetch.push(token);
        }

        if (
          toFetch.length + toDelete.length >=
          INCREMENTAL_MAX_MESSAGES_PER_RUN
        ) {
          hitCap = true;
          break;
        }
      }

      if (page.historyId) {
        latestHistoryId = page.historyId;
      }

      pageToken = hitCap ? undefined : (page.nextPageToken ?? undefined);
    } while (pageToken);

    for (const gmailMessageId of toDelete) {
      await deleteEmailMessage(userId, gmailMessageId, ctx.connectionId);
      processed += 1;
    }

    await mapPool(toFetch, FETCH_CONCURRENCY, async (messageId) => {
      const message = await fetchMessage(ctx, messageId);
      await persistMessage(ctx, message);
    });
    processed += toFetch.length;

    await saveAssistantCursor(userId, latestHistoryId, mailboxKind);

    return {
      mode: 'incremental',
      messagesProcessed: processed,
      historyId: latestHistoryId,
    };
  } catch (error) {
    if (error instanceof GmailApiError && error.status === 404) {
      return backfill(userId, mailboxKind);
    }

    throw error;
  }
}

export async function syncMailbox(
  userId: string,
  mailboxKind: MailboxKind = 'business',
): Promise<GmailSyncResult> {
  const settings = await loadAssistantSettings(userId, mailboxKind);

  if (!settings?.last_history_id) {
    return backfill(userId, mailboxKind);
  }

  return incrementalSync(userId, mailboxKind);
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
  options?: {
    format?: 'full' | 'metadata';
    mailboxKind?: MailboxKind;
  },
): Promise<{ messagesProcessed: number; latestIsSent: boolean }> {
  const mailboxKind = options?.mailboxKind ?? 'business';
  const ctx = await requireSyncContext(userId, mailboxKind);
  const format = options?.format ?? 'full';
  const search = new URLSearchParams({ format });

  if (format === 'metadata') {
    for (const header of ['From', 'To', 'Cc', 'Subject', 'Date']) {
      search.append('metadataHeaders', header);
    }
  }

  const thread = await gmailFetch<GmailThreadResponse>(
    ctx.userId,
    `/threads/${encodeURIComponent(gmailThreadId)}?${search.toString()}`,
    undefined,
    mailboxKind,
  );

  const messages = [...(thread.messages ?? [])].sort((a, b) => {
    const aDate = Number(a.internalDate ?? 0);
    const bDate = Number(b.internalDate ?? 0);
    return aDate - bDate;
  });

  let processed = 0;
  for (const message of messages) {
    await persistMessage(ctx, message);
    processed += 1;
  }

  const latest = messages.at(-1);
  const latestIsSent = (latest?.labelIds ?? []).includes('SENT');

  return { messagesProcessed: processed, latestIsSent };
}
