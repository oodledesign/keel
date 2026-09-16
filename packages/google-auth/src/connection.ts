import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { decrypt, encrypt } from './crypto';
import { refreshAccessToken } from './oauth';
import type { GoogleConnectionTokens } from './types';

const REFRESH_WINDOW_MS = 5 * 60_000;

export type MailboxKind = 'business' | 'personal';

export type GoogleMailboxScope = {
  accountId?: string | null;
  connectionId?: string | null;
};

type GoogleConnectionRow = {
  id: string;
  user_id: string;
  account_id: string | null;
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

function resolveBusinessAccountId(
  mailboxKind: MailboxKind,
  scope?: GoogleMailboxScope,
): string | null {
  if (mailboxKind !== 'business') {
    return null;
  }

  return scope?.accountId?.trim() || null;
}

function applyMailboxLookup(
  query: DynamicQuery,
  userId: string,
  mailboxKind: MailboxKind,
  scope?: GoogleMailboxScope,
): DynamicQuery | null {
  if (scope?.connectionId?.trim()) {
    return query.eq('id', scope.connectionId.trim()).eq('user_id', userId);
  }

  let next = query.eq('user_id', userId).eq('mailbox_kind', mailboxKind);

  if (mailboxKind === 'business') {
    const accountId = resolveBusinessAccountId(mailboxKind, scope);
    if (!accountId) {
      return null;
    }
    next = next.eq('account_id', accountId);
  }

  return next;
}

export async function getConnectionByUserMailbox(
  userId: string,
  mailboxKind: MailboxKind = 'business',
  scope?: GoogleMailboxScope,
): Promise<GoogleConnectionRow | null> {
  const query = applyMailboxLookup(
    googleConnectionsTable().select(
      'id, user_id, account_id, mailbox_kind, google_email, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes',
    ),
    userId,
    mailboxKind,
    scope,
  );

  if (!query) {
    return null;
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as GoogleConnectionRow | null) ?? null;
}

export async function upsertConnection(
  userId: string,
  tokens: GoogleConnectionTokens,
  scopes: string[],
  mailboxKind: MailboxKind = 'business',
  scope?: GoogleMailboxScope,
): Promise<{ connectionId: string }> {
  const accountId = resolveBusinessAccountId(mailboxKind, scope);

  if (mailboxKind === 'business' && !accountId) {
    throw new Error(
      'Connect Gmail from a workspace Emails page so the inbox is bound to that workspace',
    );
  }

  const existing = await getConnectionByUserMailbox(userId, mailboxKind, {
    accountId,
    connectionId: scope?.connectionId,
  });

  const connectionId =
    existing?.id ?? scope?.connectionId?.trim() ?? crypto.randomUUID();
  const now = new Date().toISOString();

  const { error } = await googleConnectionsTable().upsert(
    {
      id: connectionId,
      user_id: userId,
      account_id: mailboxKind === 'business' ? accountId : null,
      mailbox_kind: mailboxKind,
      google_email: tokens.googleEmail,
      access_token_encrypted: encrypt(tokens.access),
      refresh_token_encrypted: tokens.refresh ? encrypt(tokens.refresh) : null,
      token_expires_at: tokens.expiresAt,
      scopes,
      ...(existing ? {} : { connected_at: now }),
      updated_at: now,
    },
    { onConflict: 'id' },
  );

  if (error) {
    throw new Error(error.message);
  }

  return { connectionId };
}

export async function getValidAccessToken(
  userId: string,
  mailboxKind: MailboxKind = 'business',
  scope?: GoogleMailboxScope,
): Promise<string> {
  const row = await getConnectionByUserMailbox(userId, mailboxKind, scope);

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
    row.mailbox_kind,
    {
      accountId: row.account_id,
      connectionId: row.id,
    },
  );

  return accessToken;
}
