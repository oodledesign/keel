import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { assertWorkspaceMember } from './assert-workspace-member';
import { generateKeelApiToken, hashKeelApiToken } from './token';
import type { ApiTokenListItem, ValidatedApiToken } from './types';

const TOKEN_LIST_COLUMNS =
  'id, name, created_at, last_used_at, expires_at, revoked_at';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function apiTokensTable(client: { from: (table: string) => any }) {
  return client.from('api_tokens');
}

export async function listApiTokensForWorkspace(input: {
  accountId: string;
  userId: string;
}): Promise<ApiTokenListItem[]> {
  const client = getSupabaseServerClient();
  await assertWorkspaceMember(client, input.accountId, input.userId);

  const { data, error } = await apiTokensTable(client)
    .select(TOKEN_LIST_COLUMNS)
    .eq('account_id', input.accountId)
    .eq('user_id', input.userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ApiTokenListItem[];
}

export async function createApiToken(input: {
  accountId: string;
  userId: string;
  name: string;
}): Promise<{ token: ApiTokenListItem; rawToken: string }> {
  const client = getSupabaseServerClient();
  await assertWorkspaceMember(client, input.accountId, input.userId);

  const rawToken = generateKeelApiToken();
  const tokenHash = hashKeelApiToken(rawToken);

  const { data, error } = await apiTokensTable(client)
    .insert({
      account_id: input.accountId,
      user_id: input.userId,
      name: input.name.trim(),
      token_hash: tokenHash,
    })
    .select(TOKEN_LIST_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create API token');
  }

  return { token: data as ApiTokenListItem, rawToken };
}

export async function revokeApiToken(input: {
  accountId: string;
  userId: string;
  tokenId: string;
}): Promise<void> {
  const client = getSupabaseServerClient();
  await assertWorkspaceMember(client, input.accountId, input.userId);

  const { data: existing, error: lookupError } = await apiTokensTable(client)
    .select('id')
    .eq('id', input.tokenId)
    .eq('account_id', input.accountId)
    .eq('user_id', input.userId)
    .is('revoked_at', null)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!existing) {
    throw new Error('Token not found');
  }

  const admin = getSupabaseServerAdminClient();
  const { error } = await apiTokensTable(admin)
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', input.tokenId)
    .eq('user_id', input.userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function validateApiTokenForAuth(
  rawToken: string,
): Promise<ValidatedApiToken | null> {
  const tokenHash = hashKeelApiToken(rawToken);
  const now = new Date().toISOString();
  const admin = getSupabaseServerAdminClient();

  const { data, error } = await apiTokensTable(admin)
    .select('id, account_id, user_id, name, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as {
    id: string;
    account_id: string;
    user_id: string;
    name: string;
    expires_at: string | null;
    revoked_at: string | null;
  };

  if (row.revoked_at) {
    return null;
  }

  if (row.expires_at && row.expires_at <= now) {
    return null;
  }

  return {
    id: row.id,
    account_id: row.account_id,
    user_id: row.user_id,
    name: row.name,
  };
}

export function touchApiTokenLastUsed(tokenId: string) {
  const admin = getSupabaseServerAdminClient();
  void apiTokensTable(admin)
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', tokenId)
    .then(() => undefined)
    .catch(() => undefined);
}
