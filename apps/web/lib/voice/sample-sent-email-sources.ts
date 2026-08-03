import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { isFromOwner } from '~/lib/email-assistant/address-utils';
import { stripEmailQuotesAndSignature } from '~/lib/voice/strip-email-quotes';
import {
  VOICE_MAX_SENT_EMAIL_SAMPLES,
  VOICE_MAX_SOURCES,
  VOICE_MAX_SOURCE_CHARS,
} from '~/lib/voice/voice.types';

/**
 * Opt-in: pull recent sent messages into voice_sources for a personal profile.
 */
export async function sampleSentEmailSources(
  client: SupabaseClient,
  input: { profileId: string; userId: string; ownerEmail: string },
): Promise<number> {
  const { count: existingCount } = await client
    .from('voice_sources')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', input.profileId);

  const room = Math.max(0, VOICE_MAX_SOURCES - (existingCount ?? 0));
  if (room <= 0) {
    return 0;
  }

  const take = Math.min(room, VOICE_MAX_SENT_EMAIL_SAMPLES);

  const { data: messages, error } = await client
    .from('email_messages')
    .select('id, subject, body_text, snippet, from_address, internal_date')
    .eq('user_id', input.userId)
    .order('internal_date', { ascending: false, nullsFirst: false })
    .limit(120);

  if (error) {
    throw new Error(error.message);
  }

  const { data: existingRefs } = await client
    .from('voice_sources')
    .select('external_ref')
    .eq('profile_id', input.profileId)
    .eq('type', 'sent_email');

  const seen = new Set(
    (existingRefs ?? [])
      .map((row) => (row as { external_ref?: string | null }).external_ref)
      .filter((ref): ref is string => Boolean(ref)),
  );

  const rows: Array<Record<string, unknown>> = [];
  const contentSeen = new Set<string>();

  for (const message of messages ?? []) {
    if (rows.length >= take) break;
    const id = (message as { id: string }).id;
    if (seen.has(id)) continue;

    const from = (message as { from_address?: string | null }).from_address;
    if (!isFromOwner(from, input.ownerEmail)) continue;

    const raw =
      ((message as { body_text?: string | null }).body_text ?? '').trim() ||
      ((message as { snippet?: string | null }).snippet ?? '').trim();
    if (!raw || raw.length < 40) continue;

    const cleaned = stripEmailQuotesAndSignature(raw).slice(
      0,
      VOICE_MAX_SOURCE_CHARS,
    );
    if (cleaned.length < 40) continue;

    const dedupeKey = cleaned.slice(0, 280).toLowerCase();
    if (contentSeen.has(dedupeKey)) continue;
    contentSeen.add(dedupeKey);

    const subject =
      ((message as { subject?: string | null }).subject ?? '').trim() ||
      'Sent email';

    rows.push({
      profile_id: input.profileId,
      type: 'sent_email',
      title: subject.slice(0, 120),
      content_text: cleaned,
      included: true,
      external_ref: id,
    });
  }

  if (rows.length === 0) {
    return 0;
  }

  const { error: insertError } = await client
    .from('voice_sources')
    .insert(rows);
  if (insertError) {
    throw new Error(insertError.message);
  }

  return rows.length;
}
