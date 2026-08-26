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
  options?: {
    connectionId?: string | null;
    fallbackEmail?: string | null;
  },
): Promise<DraftOwnerContext | null> {
  const admin = getSupabaseServerAdminClient();
  const connectionId = options?.connectionId?.trim() || null;

  const connectionQuery = connectionId
    ? admin
        .from('google_connections')
        .select('id, google_email, mailbox_kind')
        .eq('id', connectionId)
        .eq('user_id', userId)
        .maybeSingle()
    : admin
        .from('google_connections')
        .select('id, google_email, mailbox_kind')
        .eq('user_id', userId)
        .eq('mailbox_kind', mailboxKind)
        .maybeSingle();

  const [{ data: connection }, { data: account }, { data: authUser }] =
    await Promise.all([
      connectionQuery,
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
    mailbox_kind?: string | null;
  } | null;

  const resolvedMailboxKind: MailboxKind =
    connectionRow?.mailbox_kind === 'personal' ? 'personal' : mailboxKind;

  const ownerEmail =
    connectionRow?.google_email?.trim() ||
    options?.fallbackEmail?.trim() ||
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
    mailboxKind: resolvedMailboxKind,
  };
}
