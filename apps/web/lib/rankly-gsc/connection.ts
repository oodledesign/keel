import 'server-only';

import { decrypt, encrypt } from '@kit/google-auth';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import { isGscConfigured } from './env';
import { refreshGscToken } from './oauth';
import type { GscConnectionRow, GscConnectionStatus, GscTokenResponse } from './types';

const REFRESH_WINDOW_MS = 5 * 60_000;

function expiresAtFromToken(expiresIn?: number): string | null {
  if (!expiresIn) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function tokenExpiresSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() - Date.now() <= REFRESH_WINDOW_MS;
}

function db(client: unknown) {
  return supabaseCustomSchema(client, 'rankly');
}

export async function loadGscConnection(
  client: unknown,
  projectId: string,
): Promise<GscConnectionRow | null> {
  const { data, error } = await db(client)
    .from('gsc_connections')
    .select(
      'id, project_id, account_id, google_email, property_uri, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes, connected_by, last_sync_at, last_sync_error, sync_from_date',
    )
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as GscConnectionRow | null) ?? null;
}

export function toGscConnectionStatus(
  row: GscConnectionRow | null,
): GscConnectionStatus {
  return {
    connected: Boolean(row),
    googleEmail: row?.google_email ?? null,
    propertyUri: row?.property_uri ?? null,
    lastSyncAt: row?.last_sync_at ?? null,
    lastSyncError: row?.last_sync_error ?? null,
    configured: isGscConfigured(),
  };
}

export async function saveGscConnection(
  client: unknown,
  input: {
    projectId: string;
    accountId: string;
    connectedBy: string;
    googleEmail: string | null;
    tokens: GscTokenResponse;
    scopes: string[];
    existingRefreshToken?: string | null;
    propertyUri?: string | null;
  },
) {
  const refreshToken =
    input.tokens.refresh_token ?? input.existingRefreshToken ?? null;

  if (!refreshToken) {
    throw new Error(
      'Google did not return a refresh token. Disconnect and reconnect Search Console.',
    );
  }

  const payload = {
    project_id: input.projectId,
    account_id: input.accountId,
    google_email: input.googleEmail,
    property_uri: input.propertyUri ?? null,
    access_token_encrypted: encrypt(input.tokens.access_token),
    refresh_token_encrypted: encrypt(refreshToken),
    token_expires_at: expiresAtFromToken(input.tokens.expires_in),
    scopes: input.scopes,
    connected_by: input.connectedBy,
    last_sync_error: null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db(client).from('gsc_connections').upsert(payload, {
    onConflict: 'project_id',
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateGscProperty(
  client: unknown,
  projectId: string,
  propertyUri: string,
) {
  const { error } = await db(client)
    .from('gsc_connections')
    .update({
      property_uri: propertyUri,
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('project_id', projectId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteGscConnection(client: unknown, projectId: string) {
  const { error } = await db(client)
    .from('gsc_connections')
    .delete()
    .eq('project_id', projectId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getValidGscAccessToken(
  client: unknown,
  row: GscConnectionRow,
): Promise<string> {
  const accessToken = decrypt(row.access_token_encrypted);

  if (!tokenExpiresSoon(row.token_expires_at)) {
    return accessToken;
  }

  if (!row.refresh_token_encrypted) {
    throw new Error('Search Console connection is missing a refresh token');
  }

  const refreshToken = decrypt(row.refresh_token_encrypted);
  const refreshed = await refreshGscToken(refreshToken);

  const { error } = await db(client)
    .from('gsc_connections')
    .update({
      access_token_encrypted: encrypt(refreshed.access_token),
      token_expires_at: expiresAtFromToken(refreshed.expires_in),
      refresh_token_encrypted: refreshed.refresh_token
        ? encrypt(refreshed.refresh_token)
        : row.refresh_token_encrypted,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  if (error) {
    throw new Error(error.message);
  }

  return refreshed.access_token;
}

export async function markGscSyncResult(
  client: unknown,
  connectionId: string,
  result: {
    ok: boolean;
    error?: string | null;
    syncFromDate?: string | null;
  },
) {
  const payload: Record<string, unknown> = {
    last_sync_error: result.ok ? null : (result.error ?? 'Sync failed'),
    updated_at: new Date().toISOString(),
  };

  if (result.ok) {
    payload.last_sync_at = new Date().toISOString();
  }

  if (result.syncFromDate != null) {
    payload.sync_from_date = result.syncFromDate;
  }

  const { error } = await db(client)
    .from('gsc_connections')
    .update(payload)
    .eq('id', connectionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function listGscConnectionsDueForSync(
  client: unknown,
  limit = 20,
): Promise<GscConnectionRow[]> {
  const staleBefore = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db(client)
    .from('gsc_connections')
    .select(
      'id, project_id, account_id, google_email, property_uri, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes, connected_by, last_sync_at, last_sync_error, sync_from_date',
    )
    .not('property_uri', 'is', null)
    .or(`last_sync_at.is.null,last_sync_at.lt.${staleBefore}`)
    .order('last_sync_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data as GscConnectionRow[] | null) ?? [];
}
