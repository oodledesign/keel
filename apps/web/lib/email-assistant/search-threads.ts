import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_THREAD_MATCHES = 100;
const MAX_MESSAGE_MATCHES = 200;
const MAX_PARTICIPANT_SCAN = 200;

function toIlikeTerm(query: string): string {
  const trimmed = query.trim();

  if (!trimmed) {
    return '';
  }

  return `%${trimmed.replace(/%/g, '\\%')}%`;
}

function participantMatches(
  participants: unknown,
  normalizedQuery: string,
): boolean {
  if (!Array.isArray(participants)) {
    return false;
  }

  for (const entry of participants) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const participant = entry as { name?: unknown; email?: unknown };
    const name =
      typeof participant.name === 'string'
        ? participant.name.toLowerCase()
        : '';
    const email =
      typeof participant.email === 'string'
        ? participant.email.toLowerCase()
        : '';

    if (
      (name && name.includes(normalizedQuery)) ||
      (email && email.includes(normalizedQuery))
    ) {
      return true;
    }
  }

  return false;
}

/** Thread ids matching subject, snippet, participants, or message content. */
export async function searchEmailThreadIds(
  client: SupabaseClient,
  userId: string,
  query: string,
): Promise<string[]> {
  const term = toIlikeTerm(query);

  if (!term) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  const ids = new Set<string>();

  const [threadsResult, messagesResult, recentThreadsResult] =
    await Promise.all([
      client
        .from('email_threads')
        .select('id')
        .eq('user_id', userId)
        .or(`subject.ilike.${term},snippet.ilike.${term}`)
        .limit(MAX_THREAD_MATCHES),
      client
        .from('email_messages')
        .select('thread_id')
        .eq('user_id', userId)
        .or(
          `from_address.ilike.${term},subject.ilike.${term},body_text.ilike.${term},snippet.ilike.${term}`,
        )
        .limit(MAX_MESSAGE_MATCHES),
      client
        .from('email_threads')
        .select('id, participants')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(MAX_PARTICIPANT_SCAN),
    ]);

  if (threadsResult.error) {
    throw new Error(threadsResult.error.message);
  }

  if (messagesResult.error) {
    throw new Error(messagesResult.error.message);
  }

  if (recentThreadsResult.error) {
    throw new Error(recentThreadsResult.error.message);
  }

  for (const row of threadsResult.data ?? []) {
    ids.add((row as { id: string }).id);
  }

  for (const row of messagesResult.data ?? []) {
    const threadId = (row as { thread_id?: string | null }).thread_id;

    if (threadId) {
      ids.add(threadId);
    }
  }

  for (const row of recentThreadsResult.data ?? []) {
    if (
      participantMatches(
        (row as { participants?: unknown }).participants,
        normalizedQuery,
      )
    ) {
      ids.add((row as { id: string }).id);
    }
  }

  return [...ids];
}
