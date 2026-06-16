import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

import { getSignaturesSupabaseClient } from './graph';

export type SignaturesIntegrationProvider = 'microsoft' | 'google';

export type IntegrationConnectInvite = {
  id: string;
  account_id: string;
  provider: SignaturesIntegrationProvider;
  label: string | null;
  created_by: string | null;
  expires_at: string;
  used_at: string | null;
  used_by_email: string | null;
  revoked_at: string | null;
  created_at: string;
};

export function hashIntegrationInviteToken(token: string) {
  return createHash('sha256').update(token.trim()).digest('hex');
}

export function generateIntegrationInviteToken() {
  return randomBytes(32).toString('hex');
}

function isInviteActive(row: IntegrationConnectInvite, now = Date.now()) {
  if (row.revoked_at) return false;
  if (row.used_at) return false;
  return new Date(row.expires_at).getTime() > now;
}

export async function createIntegrationConnectInvite(input: {
  accountId: string;
  provider: SignaturesIntegrationProvider;
  createdBy: string;
  label?: string | null;
  expiresInDays?: number;
}) {
  const token = generateIntegrationInviteToken();
  const tokenHash = hashIntegrationInviteToken(token);
  const days = Math.min(Math.max(input.expiresInDays ?? 7, 1), 30);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const db = getSignaturesSupabaseClient();
  const { data, error } = await db
    .from('integration_connect_invites')
    .insert({
      account_id: input.accountId,
      provider: input.provider,
      token_hash: tokenHash,
      label: input.label?.trim() || null,
      created_by: input.createdBy,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create integration link');
  }

  return {
    invite: data as IntegrationConnectInvite,
    token,
  };
}

export async function listIntegrationConnectInvites(accountId: string) {
  const db = getSignaturesSupabaseClient();
  const { data, error } = await db
    .from('integration_connect_invites')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as IntegrationConnectInvite[];
}

export async function revokeIntegrationConnectInvite(input: {
  accountId: string;
  inviteId: string;
}) {
  const db = getSignaturesSupabaseClient();
  const { error } = await db
    .from('integration_connect_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', input.inviteId)
    .eq('account_id', input.accountId)
    .is('used_at', null)
    .is('revoked_at', null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function loadIntegrationInviteByToken(token: string) {
  const trimmed = token.trim();
  if (!/^[0-9a-f]{64}$/i.test(trimmed)) {
    return null;
  }

  const db = getSignaturesSupabaseClient();
  const { data, error } = await db
    .from('integration_connect_invites')
    .select('*')
    .eq('token_hash', hashIntegrationInviteToken(trimmed))
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const invite = data as IntegrationConnectInvite;
  if (!isInviteActive(invite)) {
    return null;
  }

  return invite;
}

export async function loadIntegrationInviteById(inviteId: string) {
  const db = getSignaturesSupabaseClient();
  const { data, error } = await db
    .from('integration_connect_invites')
    .select('*')
    .eq('id', inviteId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const invite = data as IntegrationConnectInvite;
  if (!isInviteActive(invite)) {
    return null;
  }

  return invite;
}

export async function markIntegrationInviteUsed(input: {
  inviteId: string;
  accountId: string;
  usedByEmail?: string | null;
}) {
  const db = getSignaturesSupabaseClient();
  const { error } = await db
    .from('integration_connect_invites')
    .update({
      used_at: new Date().toISOString(),
      used_by_email: input.usedByEmail?.trim().toLowerCase() || null,
    })
    .eq('id', input.inviteId)
    .eq('account_id', input.accountId)
    .is('used_at', null)
    .is('revoked_at', null);

  if (error) {
    throw new Error(error.message);
  }
}

export function integrationConnectUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}/connect/signatures/${token}`;
}
