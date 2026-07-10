import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  ConferencingNotConnectedError,
  ConferencingReconnectRequiredError,
} from './errors';
import {
  decryptConferencingSecret,
  encryptConferencingSecret,
} from './crypto';
import { refreshTeamsAccessToken } from './teams/refresh';
import type {
  ConferencingConnectionCredentials,
  ConferencingProviderId,
} from './types';
import { refreshZoomAccessToken } from './zoom/refresh';

const REFRESH_WINDOW_MS = 60_000;

type ConnectionRow = {
  account_id: string;
  provider: ConferencingProviderId;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  provider_account_email: string | null;
};

type DynamicQuery = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}> & {
  select: (columns: string) => DynamicQuery;
  eq: (column: string, value: string) => DynamicQuery;
  update: (values: Record<string, unknown>) => DynamicQuery;
  maybeSingle: () => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

type DynamicTable = {
  select: (columns: string) => DynamicQuery;
  update: (values: Record<string, unknown>) => DynamicQuery;
};

function conferencingConnectionsTable() {
  return (
    getSupabaseServerAdminClient() as unknown as {
      from: (name: string) => DynamicTable;
    }
  ).from('conferencing_connections');
}

function tokenExpiresSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() - Date.now() <= REFRESH_WINDOW_MS;
}

async function persistTokens(input: {
  accountId: string;
  provider: ConferencingProviderId;
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}) {
  const expiresAt = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
    : null;

  const { error } = await conferencingConnectionsTable()
    .update({
      access_token: encryptConferencingSecret(input.accessToken),
      refresh_token: encryptConferencingSecret(input.refreshToken),
      expires_at: expiresAt,
    })
    .eq('account_id', input.accountId)
    .eq('provider', input.provider);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Loads a workspace Zoom/Teams connection, refreshes when near expiry, and
 * returns decrypted credentials for `ConferencingProvider` calls.
 *
 * Token acquisition lives here (not on the provider) so Composio AgentAuth
 * can replace this loader without changing Zoom/Teams meeting APIs.
 */
export async function getConferencingConnectionForWorkspace(
  accountId: string,
  provider: ConferencingProviderId,
): Promise<ConferencingConnectionCredentials> {
  const { data, error } = await conferencingConnectionsTable()
    .select(
      'account_id, provider, access_token, refresh_token, expires_at, provider_account_email',
    )
    .eq('account_id', accountId)
    .eq('provider', provider)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new ConferencingNotConnectedError({ accountId, provider });
  }

  const row = data as ConnectionRow;
  let accessToken = decryptConferencingSecret(row.access_token);
  const refreshToken = row.refresh_token
    ? decryptConferencingSecret(row.refresh_token)
    : null;

  if (tokenExpiresSoon(row.expires_at)) {
    if (!refreshToken) {
      throw new ConferencingReconnectRequiredError({
        accountId,
        provider,
        message: `${provider} refresh token is missing. Reconnect under Connected accounts.`,
      });
    }

    try {
      if (provider === 'zoom') {
        const tokens = await refreshZoomAccessToken(refreshToken);
        accessToken = tokens.access_token;
        await persistTokens({
          accountId,
          provider,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? refreshToken,
          expiresIn: tokens.expires_in,
        });
      } else {
        const tokens = await refreshTeamsAccessToken(refreshToken);
        accessToken = tokens.access_token;
        await persistTokens({
          accountId,
          provider,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? refreshToken,
          expiresIn: tokens.expires_in,
        });
      }
    } catch (err) {
      throw new ConferencingReconnectRequiredError({
        accountId,
        provider,
        message:
          err instanceof Error
            ? err.message
            : `${provider} token refresh failed; reconnect required.`,
      });
    }
  }

  return {
    accountId,
    provider,
    accessToken,
    refreshToken,
    expiresAt: row.expires_at,
    providerAccountEmail: row.provider_account_email,
  };
}
