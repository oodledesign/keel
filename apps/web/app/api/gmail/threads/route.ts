import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';
import { searchEmailThreadIds } from '~/lib/email-assistant/search-threads';

export const dynamic = 'force-dynamic';

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
      'id, gmail_thread_id, subject, snippet, participants, label_ids, is_unread, last_message_at, updated_at, assistant_category',
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

  if (cursor) {
    query = query.lt('last_message_at', cursor);
  }

  const { data, error } = await query;

  if (error) {
    return jsonErr('LOAD_FAILED', error.message, 500);
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const threads = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? ((threads.at(-1) as { last_message_at?: string | null } | undefined)
        ?.last_message_at ?? null)
    : null;

  return jsonOk({
    threads,
    nextCursor,
  });
}
