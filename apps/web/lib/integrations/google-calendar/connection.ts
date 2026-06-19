import type { SupabaseClient } from '@supabase/supabase-js';

import {
  decryptGoogleSecret,
  encryptGoogleSecret,
} from './crypto';
import { getOptionalGoogleCalendarEnv } from './env';
import type {
  GoogleCalendarConnection,
  GoogleCalendarConnectionStatus,
  GoogleTokenResponse,
} from './types';

type GoogleCalendarConnectionRow = {
  user_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  calendar_id: string | null;
  planner_calendar_id: string | null;
  busy_calendar_ids: string[] | null;
  personal_calendar_ids: string[] | null;
  scopes: string | null;
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
  update: (values: Record<string, unknown>) => DynamicQuery;
  upsert: (
    values: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>;
};

function table(client: SupabaseClient) {
  return (client as unknown as { from: (name: string) => DynamicTable }).from(
    'google_calendar_connections',
  );
}

export async function getGoogleCalendarConnectionStatus(
  client: SupabaseClient,
  userId: string,
): Promise<GoogleCalendarConnectionStatus> {
  const { data } = await table(client)
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    connected: Boolean(data),
    configured: Boolean(getOptionalGoogleCalendarEnv()),
  };
}

export async function loadGoogleCalendarConnection(
  client: SupabaseClient,
  userId: string,
): Promise<GoogleCalendarConnection | null> {
  const { data, error } = await table(client)
    .select(
      'user_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, calendar_id, planner_calendar_id, busy_calendar_ids, personal_calendar_ids, scopes',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  const row = data as GoogleCalendarConnectionRow;
  return {
    userId: row.user_id,
    accessToken: decryptGoogleSecret(row.access_token_encrypted),
    refreshToken: row.refresh_token_encrypted
      ? decryptGoogleSecret(row.refresh_token_encrypted)
      : null,
    tokenExpiresAt: row.token_expires_at,
    calendarId: row.calendar_id || 'primary',
    plannerCalendarId: row.planner_calendar_id,
    busyCalendarIds: normalizeCalendarIdList(row.busy_calendar_ids),
    personalCalendarIds: normalizeCalendarIdList(row.personal_calendar_ids),
    scopes: row.scopes,
  };
}

function normalizeCalendarIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function saveGoogleCalendarConnection(
  client: SupabaseClient,
  input: {
    userId: string;
    tokens: GoogleTokenResponse;
    existingRefreshToken?: string | null;
  },
) {
  const refreshToken =
    input.tokens.refresh_token ?? input.existingRefreshToken ?? null;

  const expiresAt = input.tokens.expires_in
    ? new Date(Date.now() + input.tokens.expires_in * 1000).toISOString()
    : null;

  const { error } = await table(client).upsert(
    {
      user_id: input.userId,
      access_token_encrypted: encryptGoogleSecret(input.tokens.access_token),
      refresh_token_encrypted: refreshToken
        ? encryptGoogleSecret(refreshToken)
        : null,
      token_expires_at: expiresAt,
      calendar_id: 'primary',
      scopes: input.tokens.scope ?? null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateGoogleCalendarAccessToken(
  client: SupabaseClient,
  input: {
    userId: string;
    tokens: GoogleTokenResponse;
    refreshToken: string | null;
  },
) {
  await saveGoogleCalendarConnection(client, {
    userId: input.userId,
    tokens: input.tokens,
    existingRefreshToken: input.refreshToken,
  });
}

export async function updatePlannerCalendarId(
  client: SupabaseClient,
  userId: string,
  plannerCalendarId: string,
) {
  const { error } = await table(client)
    .update({ planner_calendar_id: plannerCalendarId })
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateGoogleCalendarSelection(
  client: SupabaseClient,
  input: {
    userId: string;
    busyCalendarIds: string[];
    personalCalendarIds: string[];
  },
) {
  const { error } = await table(client)
    .update({
      busy_calendar_ids: input.busyCalendarIds,
      personal_calendar_ids: input.personalCalendarIds,
    })
    .eq('user_id', input.userId);

  if (error) {
    throw new Error(error.message);
  }
}
