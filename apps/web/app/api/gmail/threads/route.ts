import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { requireApiUser } from '~/lib/email-assistant/require-api-user';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get('limit') ?? 25), 1),
    100,
  );
  const cursor = url.searchParams.get('cursor');

  let query = auth.client
    .from('email_threads')
    .select(
      'id, gmail_thread_id, subject, snippet, participants, label_ids, is_unread, last_message_at, updated_at',
    )
    .eq('user_id', auth.user.id)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(limit + 1);

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
