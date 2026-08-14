import 'server-only';

import { cookies } from 'next/headers';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

import {
  type ImpersonationRestoreTokens,
  decryptImpersonationPayload,
  encryptImpersonationPayload,
  signImpersonationCookieValue,
  verifyImpersonationCookieValue,
} from './impersonation-crypto';

export const IMPERSONATION_RESTORE_COOKIE = 'ozer-impersonation-restore';
export const IMPERSONATION_SESSION_TTL_MS = 60 * 60 * 1000;

type AdminClient = SupabaseClient<Database>;

export type ImpersonationSessionRow = {
  id: string;
  actor_user_id: string;
  target_user_id: string;
  encrypted_payload: string;
  reason: string;
  support_ticket_id: string | null;
  expires_at: string;
  ended_at: string | null;
  created_at: string;
};

type ImpersonationTable = {
  insert: (values: Record<string, unknown>) => PromiseLike<{
    error: { message: string } | null;
  }>;
  update: (values: Record<string, unknown>) => {
    eq: (
      column: string,
      value: string,
    ) => {
      eq: (
        column: string,
        value: string,
      ) => {
        is: (
          column: string,
          value: null,
        ) => {
          gt: (
            column: string,
            value: string,
          ) => {
            select: (columns: string) => {
              maybeSingle: () => PromiseLike<{
                data: ImpersonationSessionRow | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
    };
  };
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => {
      maybeSingle: () => PromiseLike<{
        data: ImpersonationSessionRow | null;
        error: { message: string } | null;
      }>;
    };
  };
};

/**
 * Typed access to admin_impersonation_sessions before/after generated Database types
 * include the table. Always used with the service-role admin client.
 */
function impersonationSessions(adminClient: AdminClient): ImpersonationTable {
  return (
    adminClient as unknown as {
      from: (table: 'admin_impersonation_sessions') => ImpersonationTable;
    }
  ).from('admin_impersonation_sessions');
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Lax so the restore cookie is reliably present on same-site navigations
    // after the admin session swap (Strict can drop it in edge cases).
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export async function setImpersonationRestoreCookie(sessionId: string) {
  const store = await cookies();
  store.set(
    IMPERSONATION_RESTORE_COOKIE,
    signImpersonationCookieValue(sessionId),
    cookieOptions(Math.floor(IMPERSONATION_SESSION_TTL_MS / 1000)),
  );
}

export async function clearImpersonationRestoreCookie() {
  const store = await cookies();
  store.set(IMPERSONATION_RESTORE_COOKIE, '', cookieOptions(0));
}

export async function readImpersonationSessionIdFromCookie(): Promise<
  string | null
> {
  const store = await cookies();
  return verifyImpersonationCookieValue(
    store.get(IMPERSONATION_RESTORE_COOKIE)?.value,
  );
}

export async function createImpersonationRestoreSession(params: {
  adminClient: AdminClient;
  actorUserId: string;
  targetUserId: string;
  adminTokens: ImpersonationRestoreTokens;
  reason: string;
  supportTicketId?: string | null;
}): Promise<{ sessionId: string; expiresAt: string }> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + IMPERSONATION_SESSION_TTL_MS,
  ).toISOString();
  const encryptedPayload = encryptImpersonationPayload(params.adminTokens);

  const { error } = await impersonationSessions(params.adminClient).insert({
    id: sessionId,
    actor_user_id: params.actorUserId,
    target_user_id: params.targetUserId,
    encrypted_payload: encryptedPayload,
    reason: params.reason.trim(),
    support_ticket_id: params.supportTicketId ?? null,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error('Failed to stash admin session for impersonation restore');
  }

  await setImpersonationRestoreCookie(sessionId);

  return { sessionId, expiresAt };
}

export async function loadActiveImpersonationSession(params: {
  adminClient: AdminClient;
  sessionId: string;
  targetUserId: string;
}): Promise<ImpersonationSessionRow | null> {
  const { data, error } = await impersonationSessions(params.adminClient)
    .select(
      'id, actor_user_id, target_user_id, encrypted_payload, reason, support_ticket_id, expires_at, ended_at, created_at',
    )
    .eq('id', params.sessionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  if (data.target_user_id !== params.targetUserId) {
    return null;
  }

  if (data.ended_at) {
    return null;
  }

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    return null;
  }

  return data;
}

/**
 * Atomically marks the session ended and returns the payload once.
 * Concurrent callers lose the race when `ended_at IS NULL` no longer matches.
 */
export async function consumeImpersonationRestoreSession(params: {
  adminClient: AdminClient;
  sessionId: string;
  targetUserId: string;
}): Promise<{
  tokens: ImpersonationRestoreTokens;
  actorUserId: string;
  reason: string;
  supportTicketId: string | null;
} | null> {
  const nowIso = new Date().toISOString();

  const { data, error } = await impersonationSessions(params.adminClient)
    .update({ ended_at: nowIso })
    .eq('id', params.sessionId)
    .eq('target_user_id', params.targetUserId)
    .is('ended_at', null)
    .gt('expires_at', nowIso)
    .select(
      'id, actor_user_id, target_user_id, encrypted_payload, reason, support_ticket_id, expires_at, ended_at, created_at',
    )
    .maybeSingle();

  if (error) {
    throw new Error('Failed to end impersonation session');
  }

  if (!data) {
    await clearImpersonationRestoreCookie();
    return null;
  }

  const tokens = decryptImpersonationPayload(data.encrypted_payload);

  await clearImpersonationRestoreCookie();

  return {
    tokens,
    actorUserId: data.actor_user_id,
    reason: data.reason,
    supportTicketId: data.support_ticket_id,
  };
}

export async function getImpersonationExitState(params: {
  adminClient: AdminClient;
  currentUserId: string;
  viewingAsEmail: string | null;
}): Promise<
  { active: true; viewingAsEmail: string | null } | { active: false }
> {
  const sessionId = await readImpersonationSessionIdFromCookie();

  if (!sessionId) {
    return { active: false };
  }

  const row = await loadActiveImpersonationSession({
    adminClient: params.adminClient,
    sessionId,
    targetUserId: params.currentUserId,
  });

  if (!row) {
    // Do not clear the cookie here — this runs during RSC render, and Next.js
    // throws if cookies are mutated outside a Server Action / Route Handler.
    // Stale cookies are cleared by AdminClearStaleImpersonationCookie instead.
    return { active: false };
  }

  return {
    active: true,
    viewingAsEmail: params.viewingAsEmail,
  };
}
