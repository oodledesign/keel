import 'server-only';

import { getValidAccessToken as refreshGoogleAccessToken } from '@kit/google-auth/connection';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { GMAIL_OAUTH_SCOPES } from '~/lib/email-assistant/constants';

const VACATION_URL =
  'https://gmail.googleapis.com/gmail/v1/users/me/settings/vacation';

export const GMAIL_SETTINGS_BASIC_SCOPE =
  'https://www.googleapis.com/auth/gmail.settings.basic';

export interface GmailVacationSettings {
  enableAutoReply: boolean;
  responseSubject?: string;
  responseBodyPlainText?: string;
  responseBodyHtml?: string;
  restrictToContacts?: boolean;
  restrictToDomain?: boolean;
  startTime?: string;
  endTime?: string;
}

export interface VacationSyncResult {
  success: boolean;
  error?: string;
  errorCode?: 'SCOPE_MISSING' | 'NOT_CONNECTED';
}

type GoogleConnectionMeta = {
  scopes: string[];
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
};

function googleConnectionsTable() {
  return (
    getSupabaseServerAdminClient() as unknown as {
      from: (name: string) => DynamicTable;
    }
  ).from('google_connections');
}

export async function loadGoogleConnectionMeta(
  userId: string,
): Promise<GoogleConnectionMeta | null> {
  const { data, error } = await googleConnectionsTable()
    .select('scopes')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as { scopes?: string[] | null };
  return { scopes: row.scopes ?? [] };
}

export function hasGmailVacationScope(scopes: string[] | null | undefined): boolean {
  return (scopes ?? []).includes(GMAIL_SETTINGS_BASIC_SCOPE);
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const connection = await loadGoogleConnectionMeta(userId);

  if (!connection) {
    throw new Error('Google account is not connected');
  }

  if (!hasGmailVacationScope(connection.scopes)) {
    const error = new Error('SCOPE_MISSING');
    (error as Error & { code: string }).code = 'SCOPE_MISSING';
    throw error;
  }

  return refreshGoogleAccessToken(userId);
}

function isScopeMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message === 'SCOPE_MISSING' ||
    (error as Error & { code?: string }).code === 'SCOPE_MISSING'
  );
}

function isNotConnectedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('Google account is not connected')
  );
}

function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const paragraphs = escaped
    .split(/\n\n+/)
    .map((paragraph) => {
      const withBreaks = paragraph.replace(/\n/g, '<br>');
      return `<p>${withBreaks}</p>`;
    })
    .join('');

  return `<div style="font-family: sans-serif;">${paragraphs}</div>`;
}

async function gmailVacationRequest(
  userId: string,
  init: RequestInit,
): Promise<Response> {
  const accessToken = await getValidAccessToken(userId);

  return fetch(VACATION_URL, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

function mapVacationApiError(
  status: number,
  body: string,
): VacationSyncResult {
  if (status === 403) {
    return {
      success: false,
      error:
        'Gmail vacation settings permission is missing. Reconnect Google to grant access.',
      errorCode: 'SCOPE_MISSING',
    };
  }

  return {
    success: false,
    error: `Gmail API error (${status}): ${body.slice(0, 300)}`,
  };
}

export async function getGmailVacationSettings(
  userId: string,
): Promise<GmailVacationSettings | null> {
  const connection = await loadGoogleConnectionMeta(userId);

  if (!connection) {
    return null;
  }

  if (!hasGmailVacationScope(connection.scopes)) {
    return null;
  }

  try {
    const response = await gmailVacationRequest(userId, { method: 'GET' });

    if (!response.ok) {
      console.error(
        '[gmail-vacation] GET failed:',
        response.status,
        (await response.text()).slice(0, 200),
      );
      return null;
    }

    return (await response.json()) as GmailVacationSettings;
  } catch (error) {
    console.error('[gmail-vacation] GET error:', error);
    return null;
  }
}

export async function setGmailVacationOn(
  userId: string,
  message: string,
  subject?: string,
  endDate?: Date | null,
  senderName?: string | null,
): Promise<VacationSyncResult> {
  try {
    const signedMessage = senderName?.trim()
      ? `${message.trim()}\n\n${senderName.trim()}`
      : message.trim();

    const payload: GmailVacationSettings = {
      enableAutoReply: true,
      responseBodyPlainText: signedMessage,
      responseBodyHtml: plainTextToHtml(signedMessage),
      responseSubject: subject ?? "Out of Office: I'm currently away",
      startTime: Date.now().toString(),
      endTime: endDate ? endDate.getTime().toString() : undefined,
    };

    const response = await gmailVacationRequest(userId, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return mapVacationApiError(response.status, await response.text());
    }

    return { success: true };
  } catch (error) {
    if (isScopeMissingError(error)) {
      return {
        success: false,
        error:
          'Gmail vacation settings permission is missing. Reconnect Google to grant access.',
        errorCode: 'SCOPE_MISSING',
      };
    }

    if (isNotConnectedError(error)) {
      return {
        success: false,
        error: 'Google account is not connected',
        errorCode: 'NOT_CONNECTED',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gmail sync failed',
    };
  }
}

export async function setGmailVacationOff(
  userId: string,
): Promise<VacationSyncResult> {
  try {
    const existing = await getGmailVacationSettings(userId);

    const payload: GmailVacationSettings = {
      ...(existing ?? {}),
      enableAutoReply: false,
    };

    const response = await gmailVacationRequest(userId, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return mapVacationApiError(response.status, await response.text());
    }

    return { success: true };
  } catch (error) {
    if (isScopeMissingError(error)) {
      return {
        success: false,
        error:
          'Gmail vacation settings permission is missing. Reconnect Google to grant access.',
        errorCode: 'SCOPE_MISSING',
      };
    }

    if (isNotConnectedError(error)) {
      return {
        success: false,
        error: 'Google account is not connected',
        errorCode: 'NOT_CONNECTED',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gmail sync failed',
    };
  }
}

export function requiredGmailOAuthScopes(): readonly string[] {
  return GMAIL_OAUTH_SCOPES;
}
