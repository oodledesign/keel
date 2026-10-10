import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type AiProcessingConsent = 'granted' | 'denied';

export function parseAiProcessingConsent(
  value: unknown,
): AiProcessingConsent | null {
  return value === 'granted' || value === 'denied' ? value : null;
}

export async function loadAiProcessingConsent(
  client: SupabaseClient,
  userId: string,
): Promise<AiProcessingConsent | null> {
  const { data, error } = await client
    .from('user_settings')
    .select('ai_processing_consent')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  return parseAiProcessingConsent(
    (data as { ai_processing_consent?: unknown } | null)?.ai_processing_consent,
  );
}

/** Unanswered counts as allowed: only an explicit "Don't allow" turns AI off. */
export async function isAiProcessingDenied(
  client: SupabaseClient,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  return (await loadAiProcessingConsent(client, userId)) === 'denied';
}

export async function loadAiProcessingDeniedUserIds(
  client: SupabaseClient,
  userIds: Iterable<string | null | undefined>,
): Promise<Set<string>> {
  const ids = [
    ...new Set([...userIds].filter((id): id is string => Boolean(id))),
  ];
  if (ids.length === 0) return new Set();

  const denied = new Set<string>();
  const chunkSize = 200;

  for (let start = 0; start < ids.length; start += chunkSize) {
    const { data, error } = await client
      .from('user_settings')
      .select('user_id')
      .in('user_id', ids.slice(start, start + chunkSize))
      .eq('ai_processing_consent', 'denied');

    if (error) throw error;

    for (const row of data ?? []) {
      denied.add((row as { user_id: string }).user_id);
    }
  }

  return denied;
}

export async function saveAiProcessingConsent(
  client: SupabaseClient,
  userId: string,
  consent: AiProcessingConsent,
) {
  const now = new Date().toISOString();
  const { error } = await client.from('user_settings').upsert(
    {
      user_id: userId,
      ai_processing_consent: consent,
      ai_processing_consent_at: now,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );

  if (error) throw error;
}
