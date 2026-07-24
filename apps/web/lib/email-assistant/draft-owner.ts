import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { MailboxKind } from '~/lib/email-assistant/mailbox-kind';

export type DraftOwnerContext = {
  email: string;
  displayName: string | null;
  connectionId: string | null;
  mailboxKind: MailboxKind;
};

export async function resolveDraftOwnerContext(
  userId: string,
  mailboxKind: MailboxKind = 'business',
): Promise<DraftOwnerContext | null> {
  const admin = getSupabaseServerAdminClient();

  const [{ data: connection }, { data: account }, { data: authUser }] =
    await Promise.all([
      admin
        .from('google_connections')
        .select('id, google_email')
        .eq('user_id', userId)
        .eq('mailbox_kind', mailboxKind)
        .maybeSingle(),
      admin
        .from('accounts')
        .select('name, email')
        .eq('id', userId)
        .maybeSingle(),
      admin.auth.admin.getUserById(userId),
    ]);

  const connectionRow = connection as {
    id?: string;
    google_email?: string | null;
  } | null;

  const ownerEmail =
    connectionRow?.google_email?.trim() ||
    authUser?.user?.email?.trim() ||
    (account as { email?: string | null } | null)?.email?.trim() ||
    '';

  if (!ownerEmail) {
    return null;
  }

  const meta = authUser?.user?.user_metadata as
    | Record<string, unknown>
    | undefined;

  let displayName =
    (account as { name?: string | null } | null)?.name?.trim() || null;

  if (!displayName && meta) {
    for (const key of ['full_name', 'name'] as const) {
      const value = meta[key];
      if (typeof value === 'string' && value.trim()) {
        displayName = value.trim();
        break;
      }
    }
  }

  return {
    email: ownerEmail,
    displayName,
    connectionId: connectionRow?.id ?? null,
    mailboxKind,
  };
}
