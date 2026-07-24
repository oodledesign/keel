import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { decrypt, encrypt } from './crypto';
import { refreshAccessToken } from './oauth';
import type { GoogleConnectionTokens } from './types';

const REFRESH_WINDOW_MS = 5 * 60_000;

export type MailboxKind = 'business' | 'personal';

type GoogleConnectionRow = {
  id: string;
  user_id: string;
  mailbox_kind: MailboxKind;
  google_email: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
};

type DynamicQuery = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}> & {
  select: (columns: string) => DynamicQuery;
  eq: (column: string, value: string) => DynamicQuery;
  maybeSingle: () => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

type DynamicTable = {
  select: (columns: string) => DynamicQuery;
  upsert: (
    values: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>;
};

function googleConnectionsTable() {
  return (
    getSupabaseServerAdminClient() as unknown as {
      from: (name: string) => DynamicTable;
    }
  ).from('google_connections');
}

function expiresAtFromToken(expiresIn?: number): string | null {
  if (!expiresIn) {
    return null;
  }

  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function tokenExpiresSoon(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return true;
  }

  return new Date(expiresAt).getTime() - Date.now() <= REFRESH_WINDOW_MS;
}

export async function upsertConnection(
  userId: string,
  tokens: GoogleConnectionTokens,
  scopes: string[],
  mailboxKind: MailboxKind = 'business',
): Promise<{ connectionId: string }> {
  const now = new Date().toISOString();

  const { data: existing } = await googleConnectionsTable()
    .select('id')
    .eq('user_id', userId)
    .eq('mailbox_kind', mailboxKind)
    .maybeSingle();

  const connectionId =
    (existing as { id?: string } | null)?.id ?? crypto.randomUUID();

  const { error } = await googleConnectionsTable().upsert(
    {
      id: connectionId,
      user_id: userId,
      mailbox_kind: mailboxKind,
      google_email: tokens.googleEmail,
      access_token_encrypted: encrypt(tokens.access),
      refresh_token_encrypted: tokens.refresh ? encrypt(tokens.refresh) : null,
      token_expires_at: tokens.expiresAt,
      scopes,
      connected_at: now,
      updated_at: now,
    },
    { onConflict: 'user_id,mailbox_kind' },
  );

  if (error) {
    throw new Error(error.message);
  }

  return { connectionId };
}

export async function getConnectionByUserMailbox(
  userId: string,
  mailboxKind: MailboxKind = 'business',
): Promise<GoogleConnectionRow | null> {
  const { data, error } = await googleConnectionsTable()
    .select(
      'id, user_id, mailbox_kind, google_email, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes',
    )
    .eq('user_id', userId)
    .eq('mailbox_kind', mailboxKind)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as GoogleConnectionRow | null) ?? null;
}

export async function getValidAccessToken(
  userId: string,
  mailboxKind: MailboxKind = 'business',
): Promise<string> {
  const row = await getConnectionByUserMailbox(userId, mailboxKind);

  if (!row) {
    throw new Error('Google account is not connected');
  }

  let accessToken = decrypt(row.access_token_encrypted);
  let refreshToken = row.refresh_token_encrypted
    ? decrypt(row.refresh_token_encrypted)
    : null;

  if (!tokenExpiresSoon(row.token_expires_at)) {
    return accessToken;
  }

  if (!refreshToken) {
    throw new Error(
      'Google refresh token is missing; reconnect Google account',
    );
  }

  const refreshed = await refreshAccessToken(refreshToken);
  accessToken = refreshed.access_token;
  refreshToken = refreshed.refresh_token ?? refreshToken;

  await upsertConnection(
    userId,
    {
      googleEmail: row.google_email,
      access: accessToken,
      refresh: refreshToken,
      expiresAt: expiresAtFromToken(refreshed.expires_in),
    },
    row.scopes ?? [],
    mailboxKind,
  );

  return accessToken;
}
