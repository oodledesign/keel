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
  id: string;
  user_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  calendar_id: string | null;
  planner_calendar_id: string | null;
  busy_calendar_ids: string[] | null;
  personal_calendar_ids: string[] | null;
  scopes: string | null;
  google_account_email: string | null;
  google_account_sub: string;
  is_primary: boolean;
  connected_at?: string | null;
};

type DynamicQuery = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
}> & {
  select: (columns: string, options?: Record<string, unknown>) => DynamicQuery;
  eq: (column: string, value: string | boolean) => DynamicQuery;
  order: (column: string, options?: Record<string, unknown>) => DynamicQuery;
  limit: (count: number) => DynamicQuery;
  update: (values: Record<string, unknown>) => DynamicQuery;
  delete: () => DynamicQuery;
  maybeSingle: () => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

type DynamicTable = {
  select: (columns: string, options?: Record<string, unknown>) => DynamicQuery;
  update: (values: Record<string, unknown>) => DynamicQuery;
  delete: () => DynamicQuery;
  upsert: (
    values: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

function table(client: SupabaseClient) {
  return (client as unknown as { from: (name: string) => DynamicTable }).from(
    'google_calendar_connections',
  );
}

const CONNECTION_SELECT =
  'id, user_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, calendar_id, planner_calendar_id, busy_calendar_ids, personal_calendar_ids, scopes, google_account_email, google_account_sub, is_primary, connected_at';

function normalizeCalendarIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function mapConnectionRow(row: GoogleCalendarConnectionRow): GoogleCalendarConnection {
  return {
    id: row.id,
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
    googleAccountEmail: row.google_account_email?.trim() || null,
    googleAccountSub: row.google_account_sub,
    isPrimary: Boolean(row.is_primary),
    connectedAt: row.connected_at ?? null,
  };
}

export async function getGoogleCalendarConnectionStatus(
  client: SupabaseClient,
  userId: string,
): Promise<GoogleCalendarConnectionStatus> {
  const result = (await table(client)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)) as unknown as {
    count: number | null;
    error: { message: string } | null;
  };

  if (result.error) {
    throw new Error(result.error.message);
  }

  const accountCount = result.count ?? 0;

  return {
    connected: accountCount > 0,
    configured: Boolean(getOptionalGoogleCalendarEnv()),
    accountCount,
  };
}

export async function loadGoogleCalendarConnections(
  client: SupabaseClient,
  userId: string,
): Promise<GoogleCalendarConnection[]> {
  const { data, error } = await table(client)
    .select(CONNECTION_SELECT)
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('connected_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as GoogleCalendarConnectionRow[] | null) ?? []).map(
    mapConnectionRow,
  );
}

/** Primary write account (Meet / planner events). Falls back to first connection. */
export async function loadGoogleCalendarConnection(
  client: SupabaseClient,
  userId: string,
): Promise<GoogleCalendarConnection | null> {
  const { data: primary, error: primaryError } = await table(client)
    .select(CONNECTION_SELECT)
    .eq('user_id', userId)
    .eq('is_primary', true)
    .maybeSingle();

  if (primaryError) {
    throw new Error(primaryError.message);
  }

  if (primary) {
    return mapConnectionRow(primary as GoogleCalendarConnectionRow);
  }

  const { data: first, error: firstError } = await table(client)
    .select(CONNECTION_SELECT)
    .eq('user_id', userId)
    .order('connected_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstError) {
    throw new Error(firstError.message);
  }

  if (!first) return null;
  return mapConnectionRow(first as GoogleCalendarConnectionRow);
}

export async function loadGoogleCalendarConnectionById(
  client: SupabaseClient,
  userId: string,
  connectionId: string,
): Promise<GoogleCalendarConnection | null> {
  const { data, error } = await table(client)
    .select(CONNECTION_SELECT)
    .eq('user_id', userId)
    .eq('id', connectionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;
  return mapConnectionRow(data as GoogleCalendarConnectionRow);
}

export async function saveGoogleCalendarConnection(
  client: SupabaseClient,
  input: {
    userId: string;
    tokens: GoogleTokenResponse;
    googleAccountEmail: string | null;
    googleAccountSub: string;
    existingRefreshToken?: string | null;
    /** When true, mark this account primary for event writes. */
    makePrimary?: boolean;
  },
) {
  const refreshToken =
    input.tokens.refresh_token ?? input.existingRefreshToken ?? null;

  const expiresAt = input.tokens.expires_in
    ? new Date(Date.now() + input.tokens.expires_in * 1000).toISOString()
    : null;

  const existing = await loadGoogleCalendarConnections(client, input.userId);
  const matching = existing.find(
    (row) => row.googleAccountSub === input.googleAccountSub,
  );
  const legacyOnly =
    !matching &&
    existing.length === 1 &&
    existing[0]!.googleAccountSub.startsWith('legacy:');
  const upgradeTarget = matching ?? (legacyOnly ? existing[0]! : null);

  const shouldBePrimary =
    input.makePrimary === true ||
    existing.length === 0 ||
    upgradeTarget?.isPrimary === true ||
    (existing.length > 0 && !existing.some((row) => row.isPrimary));

  if (shouldBePrimary) {
    const { error: clearPrimaryError } = await table(client)
      .update({ is_primary: false })
      .eq('user_id', input.userId);

    if (clearPrimaryError) {
      throw new Error(clearPrimaryError.message);
    }
  }

  if (legacyOnly && upgradeTarget) {
    const { error } = await table(client)
      .update({
        google_account_sub: input.googleAccountSub,
        google_account_email: input.googleAccountEmail,
        access_token_encrypted: encryptGoogleSecret(input.tokens.access_token),
        refresh_token_encrypted: refreshToken
          ? encryptGoogleSecret(refreshToken)
          : null,
        token_expires_at: expiresAt,
        scopes: input.tokens.scope ?? null,
        is_primary: shouldBePrimary,
        connected_at: new Date().toISOString(),
      })
      .eq('id', upgradeTarget.id)
      .eq('user_id', input.userId);

    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const { error } = await table(client).upsert(
    {
      user_id: input.userId,
      google_account_sub: input.googleAccountSub,
      google_account_email: input.googleAccountEmail,
      access_token_encrypted: encryptGoogleSecret(input.tokens.access_token),
      refresh_token_encrypted: refreshToken
        ? encryptGoogleSecret(refreshToken)
        : null,
      token_expires_at: expiresAt,
      calendar_id: upgradeTarget?.calendarId ?? 'primary',
      scopes: input.tokens.scope ?? null,
      is_primary: shouldBePrimary,
      connected_at: new Date().toISOString(),
      ...(upgradeTarget
        ? {}
        : {
            busy_calendar_ids: [],
            personal_calendar_ids: [],
          }),
    },
    { onConflict: 'user_id,google_account_sub' },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateGoogleCalendarAccessToken(
  client: SupabaseClient,
  input: {
    userId: string;
    connectionId?: string;
    tokens: GoogleTokenResponse;
    refreshToken: string | null;
  },
) {
  const refreshToken =
    input.tokens.refresh_token ?? input.refreshToken ?? null;
  const expiresAt = input.tokens.expires_in
    ? new Date(Date.now() + input.tokens.expires_in * 1000).toISOString()
    : null;

  let query = table(client)
    .update({
      access_token_encrypted: encryptGoogleSecret(input.tokens.access_token),
      refresh_token_encrypted: refreshToken
        ? encryptGoogleSecret(refreshToken)
        : null,
      token_expires_at: expiresAt,
    })
    .eq('user_id', input.userId);

  if (input.connectionId) {
    query = query.eq('id', input.connectionId);
  } else {
    query = query.eq('is_primary', true);
  }

  const { error } = await query;
  if (error) {
    throw new Error(error.message);
  }
}

export async function updatePlannerCalendarId(
  client: SupabaseClient,
  userId: string,
  plannerCalendarId: string,
) {
  const { error } = await table(client)
    .update({ planner_calendar_id: plannerCalendarId })
    .eq('user_id', userId)
    .eq('is_primary', true);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateGoogleCalendarSelection(
  client: SupabaseClient,
  input: {
    userId: string;
    connectionId: string;
    busyCalendarIds: string[];
    personalCalendarIds: string[];
  },
) {
  const { error } = await table(client)
    .update({
      busy_calendar_ids: input.busyCalendarIds,
      personal_calendar_ids: input.personalCalendarIds,
    })
    .eq('user_id', input.userId)
    .eq('id', input.connectionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function setPrimaryGoogleCalendarConnection(
  client: SupabaseClient,
  input: { userId: string; connectionId: string },
) {
  const { error: clearError } = await table(client)
    .update({ is_primary: false })
    .eq('user_id', input.userId);

  if (clearError) {
    throw new Error(clearError.message);
  }

  const { error } = await table(client)
    .update({ is_primary: true })
    .eq('user_id', input.userId)
    .eq('id', input.connectionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteGoogleCalendarConnection(
  client: SupabaseClient,
  input: { userId: string; connectionId?: string },
) {
  let query = table(client).delete().eq('user_id', input.userId);
  if (input.connectionId) {
    query = query.eq('id', input.connectionId);
  }

  const { error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  if (!input.connectionId) {
    return;
  }

  // Ensure a primary remains when others are still connected.
  const remaining = await loadGoogleCalendarConnections(client, input.userId);
  if (remaining.length === 0) return;
  if (remaining.some((row) => row.isPrimary)) return;

  await setPrimaryGoogleCalendarConnection(client, {
    userId: input.userId,
    connectionId: remaining[0]!.id,
  });
}
