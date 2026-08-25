import type { EmailThreadSummary } from '~/home/(user)/email/_lib/types';
import {
  ACTIONABLE_EMAIL_CATEGORIES,
  isActionableEmailCategory,
} from '~/lib/email-assistant/email-thread-categories';
import { parseMailboxKind } from '~/lib/email-assistant/mailbox-kind';
import { mapEmailThreadRow } from '~/lib/email-assistant/map-email-thread-row';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';
import { searchEmailThreadIds } from '~/lib/email-assistant/search-threads';
import {
  EMAIL_THREAD_LINK_SELECT,
  enrichEmailThreadLinks,
} from '~/lib/email-assistant/thread-link-display';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const dynamic = 'force-dynamic';

function parseFilterCategories(filter: string | null): string[] | null {
  if (!filter) return null;

  if (filter === 'action' || filter === 'needs_reply') {
    return [...ACTIONABLE_EMAIL_CATEGORIES];
  }

  if (filter === 'follow_up') {
    return null;
  }

  const parts = filter.split(',').map((part) => part.trim());
  const valid = parts.filter((part) =>
    ['reply_now', 'reply_later', 'waiting', 'fyi', 'noise', 'linked'].includes(
      part,
    ),
  );

  return valid.length > 0 ? valid : null;
}

function sortActionableThreads(
  threads: EmailThreadSummary[],
): EmailThreadSummary[] {
  const priority = (thread: EmailThreadSummary) => {
    let score = 0;
    if (thread.link.clientId) score += 100;
    if (thread.assistant_category === 'reply_now') score += 20;
    if (thread.assistant_category === 'reply_later') score += 10;
    return score;
  };

  return [...threads].sort((a, b) => {
    const scoreDiff = priority(b) - priority(a);
    if (scoreDiff !== 0) return scoreDiff;

    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return aTime - bTime;
  });
}

export async function GET(request: Request) {
  const auth = await requireEmailAssistantApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get('limit') ?? 25), 1),
    100,
  );
  const cursor = url.searchParams.get('cursor');
  const filter = url.searchParams.get('filter');
  const searchQuery = url.searchParams.get('q')?.trim() ?? '';
  const mailboxKind = parseMailboxKind(url.searchParams.get('mailbox'));

  const { data: connection } = await auth.client
    .from('google_connections')
    .select('id')
    .eq('user_id', auth.user.id)
    .eq('mailbox_kind', mailboxKind)
    .maybeSingle();

  const connectionId = (connection as { id?: string } | null)?.id;

  if (!connectionId) {
    return jsonOk({
      threads: [],
      nextCursor: null,
    });
  }

  let matchingThreadIds: string[] | null = null;

  if (searchQuery) {
    try {
      matchingThreadIds = await searchEmailThreadIds(
        auth.client,
        auth.user.id,
        searchQuery,
      );
    } catch (error) {
      return jsonErr(
        'SEARCH_FAILED',
        error instanceof Error ? error.message : 'Email search failed',
        500,
      );
    }

    if (matchingThreadIds.length === 0) {
      return jsonOk({
        threads: [],
        nextCursor: null,
      });
    }
  }

  const threadSelect = `id, gmail_thread_id, subject, snippet, participants, label_ids, is_unread, last_message_at, updated_at, assistant_category, assistant_category_reason, assistant_category_confidence, follow_up_at, follow_up_note, link_confidence, link_suggestion, pipeline_lead_suggestion, pipeline_lead_confidence, pipeline_deal_id, ${EMAIL_THREAD_LINK_SELECT}`;

  let query = auth.client
    .from('email_threads')
    .select(threadSelect)
    .eq('user_id', auth.user.id)
    .eq('connection_id', connectionId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(limit + 1);

  if (matchingThreadIds) {
    query = query.in('id', matchingThreadIds);
  }

  const categoryFilters = parseFilterCategories(filter);

  if (filter === 'follow_up') {
    query = query
      .not('follow_up_at', 'is', null)
      .lte('follow_up_at', new Date().toISOString())
      .in('assistant_category', [...ACTIONABLE_EMAIL_CATEGORIES]);
  } else if (filter === 'linked') {
    query = query.or('client_id.not.is.null,project_id.not.is.null');
  } else if (categoryFilters) {
    query = query.in('assistant_category', categoryFilters);
  }

  if (cursor) {
    query = query.lt('last_message_at', cursor);
  }

  const { data, error } = await query;

  if (error) {
    return jsonErr('LOAD_FAILED', error.message, 500);
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? ((pageRows.at(-1) as { last_message_at?: string | null } | undefined)
        ?.last_message_at ?? null)
    : null;

  let threads = await enrichEmailThreadLinks(
    auth.client,
    pageRows.map((row) => mapEmailThreadRow(row as Record<string, unknown>)),
  );

  if (
    filter === 'action' ||
    filter === 'needs_reply' ||
    categoryFilters?.some((c) => isActionableEmailCategory(c))
  ) {
    threads = sortActionableThreads(threads);
  }

  return jsonOk({
    threads,
    nextCursor,
  });
}
