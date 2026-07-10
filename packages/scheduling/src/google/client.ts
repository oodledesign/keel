import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  GoogleCalendarNotConnectedError,
  GoogleCalendarReconnectRequiredError,
} from '../errors';
import type { GoogleCalendarClient } from '../types';
import {
  decryptGoogleCalendarSecret,
  encryptGoogleCalendarSecret,
} from './crypto';
import {
  refreshGoogleCalendarAccessToken,
  type GoogleTokenResponse,
} from './refresh';

const REFRESH_WINDOW_MS = 60_000;

type ConnectionRow = {
  user_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  calendar_id: string | null;
  busy_calendar_ids: string[] | null;
  personal_calendar_ids: string[] | null;
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

function calendarConnectionsTable() {
  return (
    getSupabaseServerAdminClient() as unknown as {
      from: (name: string) => DynamicTable;
    }
  ).from('google_calendar_connections');
}

function accountsTable() {
  return (
    getSupabaseServerAdminClient() as unknown as {
      from: (name: string) => DynamicTable;
    }
  ).from('accounts');
}

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function tokenExpiresSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() - Date.now() <= REFRESH_WINDOW_MS;
}

async function resolveHostUserId(
  workspaceId: string,
  hostUserId?: string,
): Promise<string> {
  if (hostUserId) {
    return hostUserId;
  }

  const { data, error } = await accountsTable()
    .select('primary_owner_user_id')
    .eq('id', workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as { primary_owner_user_id?: string } | null;
  if (!row?.primary_owner_user_id) {
    throw new GoogleCalendarNotConnectedError({
      workspaceId,
      message: 'Workspace host could not be resolved for Google Calendar.',
    });
  }

  return row.primary_owner_user_id;
}

async function persistAccessToken(input: {
  userId: string;
  tokens: GoogleTokenResponse;
  refreshToken: string;
}) {
  const expiresAt = input.tokens.expires_in
    ? new Date(Date.now() + input.tokens.expires_in * 1000).toISOString()
    : null;

  const refreshToken = input.tokens.refresh_token ?? input.refreshToken;

  const { error } = await calendarConnectionsTable()
    .update({
      access_token_encrypted: encryptGoogleCalendarSecret(
        input.tokens.access_token,
      ),
      refresh_token_encrypted: encryptGoogleCalendarSecret(refreshToken),
      token_expires_at: expiresAt,
    })
    .eq('user_id', input.userId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Loads the workspace host's Google Calendar connection, refreshes the access
 * token when expired, and persists the new token.
 *
 * Connections are user-scoped (`google_calendar_connections.user_id`). The
 * workspace host defaults to `accounts.primary_owner_user_id`; pass
 * `hostUserId` (e.g. `booking_pages.host_user_id`) when the page host differs.
 */
export async function getGoogleClientForWorkspace(
  workspaceId: string,
  options?: { hostUserId?: string },
): Promise<GoogleCalendarClient> {
  const userId = await resolveHostUserId(workspaceId, options?.hostUserId);

  const { data, error } = await calendarConnectionsTable()
    .select(
      'user_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, calendar_id, busy_calendar_ids, personal_calendar_ids',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new GoogleCalendarNotConnectedError({ workspaceId, userId });
  }

  const row = data as ConnectionRow;
  let accessToken = decryptGoogleCalendarSecret(row.access_token_encrypted);
  const refreshToken = row.refresh_token_encrypted
    ? decryptGoogleCalendarSecret(row.refresh_token_encrypted)
    : null;

  if (tokenExpiresSoon(row.token_expires_at)) {
    if (!refreshToken) {
      throw new GoogleCalendarReconnectRequiredError({
        workspaceId,
        userId,
        message:
          'Google Calendar refresh token is missing. Reconnect Google Calendar in settings.',
      });
    }

    try {
      const tokens = await refreshGoogleCalendarAccessToken(refreshToken);
      accessToken = tokens.access_token;
      await persistAccessToken({
        userId,
        tokens,
        refreshToken,
      });
    } catch (err) {
      throw new GoogleCalendarReconnectRequiredError({
        workspaceId,
        userId,
        message:
          err instanceof Error
            ? err.message
            : 'Google Calendar token refresh failed; reconnect required.',
      });
    }
  }

  return {
    workspaceId,
    userId,
    accessToken,
    calendarId: row.calendar_id || 'primary',
    busyCalendarIds: normalizeIdList(row.busy_calendar_ids),
    personalCalendarIds: normalizeIdList(row.personal_calendar_ids),
  };
}
