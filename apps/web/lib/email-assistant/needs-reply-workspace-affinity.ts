import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { pickMostFrequentAccountId } from './pick-most-frequent-account-id';

type AdminClient = SupabaseClient;

/**
 * Resolve which workspace owns a needs-reply thread for Second Brain.
 *
 * Prefer `preferredAccountId` — set when syncing from a workspace email page
 * (e.g. /home/oodle/email → Oodle). That is the workspace the inbox is opened in.
 * Fallbacks only apply for cron/background sync with no workspace context.
 */
export async function resolveNeedsReplyWorkspaceAccountId(
  admin: AdminClient,
  params: {
    userId: string;
    preferredAccountId?: string | null;
  },
): Promise<string | null> {
  const preferred = params.preferredAccountId?.trim() || null;

  if (preferred) {
    const { data: membership } = await admin
      .from('accounts_memberships')
      .select('account_id')
      .eq('user_id', params.userId)
      .eq('account_id', preferred)
      .maybeSingle();

    if (membership?.account_id) {
      return membership.account_id as string;
    }
  }

  const { data: linked } = await admin
    .from('email_threads')
    .select('account_id')
    .eq('user_id', params.userId)
    .not('account_id', 'is', null)
    .limit(100);

  const best = pickMostFrequentAccountId(
    (linked ?? []).map((row) => row.account_id as string | null),
  );

  if (best) {
    return best;
  }

  const { data: memberships } = await admin
    .from('accounts_memberships')
    .select('account_id')
    .eq('user_id', params.userId)
    .limit(2);

  if (memberships?.length === 1) {
    return memberships[0]!.account_id as string;
  }

  return null;
}

export async function ensureNeedsReplyWorkspaceAffinity(
  admin: AdminClient,
  params: {
    userId: string;
    threadId: string;
    preferredAccountId?: string | null;
  },
): Promise<string | null> {
  const { data: thread, error } = await admin
    .from('email_threads')
    .select('id, user_id, account_id, assistant_category, client_id, project_id')
    .eq('id', params.threadId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!thread) {
    return null;
  }

  if (thread.account_id) {
    return thread.account_id as string;
  }

  if (thread.assistant_category !== 'needs_reply') {
    return null;
  }

  const accountId = await resolveNeedsReplyWorkspaceAccountId(admin, {
    userId: params.userId,
    preferredAccountId: params.preferredAccountId,
  });

  if (!accountId) {
    return null;
  }

  const { error: updateError } = await admin
    .from('email_threads')
    .update({
      account_id: accountId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.threadId)
    .eq('user_id', params.userId)
    .is('account_id', null);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return accountId;
}
