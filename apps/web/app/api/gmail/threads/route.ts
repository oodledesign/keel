import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';
import { searchEmailThreadIds } from '~/lib/email-assistant/search-threads';
import {
  EMAIL_THREAD_LINK_SELECT,
  enrichEmailThreadLinks,
  mapThreadLinkFields,
} from '~/lib/email-assistant/thread-link-display';
import type {
  EmailParticipant,
  EmailThreadSummary,
} from '~/home/(user)/email/_lib/types';

export const dynamic = 'force-dynamic';

function parseParticipants(value: unknown): EmailParticipant[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const row = entry as { name?: unknown; email?: unknown };
      const email = typeof row.email === 'string' ? row.email.trim() : '';

      if (!email) {
        return null;
      }

      return {
        name: typeof row.name === 'string' ? row.name : null,
        email,
      };
    })
    .filter((entry): entry is EmailParticipant => entry !== null);
}

function mapThreadRow(row: Record<string, unknown>): EmailThreadSummary {
  const category = row.assistant_category;
  const assistantCategory =
    category === 'needs_reply' || category === 'no_reply' ? category : null;

  return {
    id: String(row.id),
    gmail_thread_id: String(row.gmail_thread_id),
    subject: (row.subject as string | null) ?? null,
    snippet: (row.snippet as string | null) ?? null,
    participants: parseParticipants(row.participants),
    is_unread: Boolean(row.is_unread),
    last_message_at: (row.last_message_at as string | null) ?? null,
    assistant_category: assistantCategory,
    link: mapThreadLinkFields(row),
  };
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

  let query = auth.client
    .from('email_threads')
    .select(
      `id, gmail_thread_id, subject, snippet, participants, label_ids, is_unread, last_message_at, updated_at, assistant_category, ${EMAIL_THREAD_LINK_SELECT}`,
    )
    .eq('user_id', auth.user.id)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(limit + 1);

  if (matchingThreadIds) {
    query = query.in('id', matchingThreadIds);
  }

  if (filter === 'needs_reply') {
    query = query.eq('assistant_category', 'needs_reply');
  }

  if (filter === 'linked') {
    query = query.or('client_id.not.is.null,project_id.not.is.null');
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

  const threads = await enrichEmailThreadLinks(
    auth.client,
    pageRows.map((row) => mapThreadRow(row as Record<string, unknown>)),
  );

  return jsonOk({
    threads,
    nextCursor,
  });
}
