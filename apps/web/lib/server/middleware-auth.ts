import type { NextRequest, NextResponse } from 'next/server';

import type { Session, User } from '@supabase/supabase-js';

import { createMiddlewareClient } from '@kit/supabase/middleware-client';
import { getSupabaseAuthCookieOptions } from '@kit/supabase/get-supabase-auth-cookie-options';
import type { JWTUserData } from '@kit/supabase/types';

import {
  isAuthRetryableFetchError,
  isTransientSupabaseError,
} from '~/lib/supabase/transient-errors';

const AUTH_COOKIE_RE = /^sb-[a-z0-9-]+-auth-token(\.\d+)?$/i;
const AUTH_GET_USER_RETRY_DELAYS_MS = [0, 300, 1000];

function isRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const authError = error as { code?: string; message?: string };

  return (
    authError.code === 'refresh_token_already_used' ||
    authError.code === 'refresh_token_not_found' ||
    authError.message?.includes('Invalid Refresh Token') === true
  );
}

function isRetryableAuthError(error: unknown): boolean {
  return isAuthRetryableFetchError(error) || isTransientSupabaseError(error);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getUserWithBackoff(
  supabase: ReturnType<typeof createMiddlewareClient>,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < AUTH_GET_USER_RETRY_DELAYS_MS.length; attempt++) {
    const delayMs = AUTH_GET_USER_RETRY_DELAYS_MS[attempt] ?? 0;
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const result = await supabase.auth.getUser();
    if (!result.error) {
      return result;
    }

    lastError = result.error;

    if (isRefreshTokenError(result.error)) {
      return result;
    }

    if (!isRetryableAuthError(result.error)) {
      return result;
    }
  }

  return { data: { user: null }, error: lastError };
}

async function readSessionFromLocalClaims(
  supabase: ReturnType<typeof createMiddlewareClient>,
): Promise<Session | null> {
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims) {
    return null;
  }

  const claims = claimsData.claims as { exp?: number };
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= now) {
    return null;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session ?? null;
}

function mapSessionUser(user: User): JWTUserData {
  return {
    is_anonymous: user.is_anonymous ?? false,
    aal: 'aal1',
    email: user.email ?? '',
    phone: user.phone ?? '',
    email_confirmed_at: user.email_confirmed_at ?? null,
    app_metadata: user.app_metadata ?? {},
    user_metadata: user.user_metadata ?? {},
    id: user.id,
    amr: [],
  };
}

function setSuppressGetSessionWarning(
  supabase: ReturnType<typeof createMiddlewareClient>,
  value: boolean,
) {
  // Suppress the getSession warning. Remove when the issue is fixed.
  // https://github.com/supabase/auth-js/issues/873
  // @ts-expect-error: suppressGetSessionWarning is not part of the public API
  supabase.auth.suppressGetSessionWarning = value;
}

function hasSupabaseAuthCookies(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => AUTH_COOKIE_RE.test(cookie.name));
}

function readStoredSessionExpiry(request: NextRequest): number | null {
  const chunks = request.cookies
    .getAll()
    .filter((cookie) => AUTH_COOKIE_RE.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (chunks.length === 0) {
    return null;
  }

  const raw = chunks.map((chunk) => chunk.value).join('');

  try {
    const decoded = raw.startsWith('base64-')
      ? Buffer.from(raw.slice('base64-'.length), 'base64').toString('utf8')
      : raw;
    const session = JSON.parse(decoded) as { expires_at?: number };
    return typeof session.expires_at === 'number' ? session.expires_at : null;
  } catch {
    return null;
  }
}

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  const sharedOptions = getSupabaseAuthCookieOptions();
  const domain = sharedOptions?.domain;

  for (const cookie of request.cookies.getAll()) {
    if (!AUTH_COOKIE_RE.test(cookie.name)) {
      continue;
    }

    response.cookies.set(cookie.name, '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });

    if (domain) {
      response.cookies.set(cookie.name, '', {
        path: '/',
        domain,
        maxAge: 0,
        expires: new Date(0),
      });
    }
  }
}

export async function clearInvalidMiddlewareSession(
  request: NextRequest,
  response: NextResponse,
) {
  const supabase = createMiddlewareClient(request, response);

  try {
    await supabase.auth.signOut();
  } catch {
    // Refresh token may already be invalid — still clear cookies below.
  }

  clearSupabaseAuthCookies(request, response);
}

async function readSession(
  request: NextRequest,
  response: NextResponse,
  options?: { allowRefresh?: boolean },
) {
  const allowRefresh = options?.allowRefresh ?? true;
  const supabase = createMiddlewareClient(request, response);

  if (!hasSupabaseAuthCookies(request)) {
    return { supabase, session: null as Session | null };
  }

  const storedExpiry = readStoredSessionExpiry(request);
  const now = Math.floor(Date.now() / 1000);

  // On auth pages we skip refresh and treat expired tokens as logged out.
  // Do not clear cookies here — Set-Cookie deletions cause a visible page
  // re-fetch on /auth/sign-in. Invalid refresh tokens are cleared below
  // when getUser() returns an explicit refresh error.
  if (!allowRefresh && (storedExpiry === null || storedExpiry <= now)) {
    return { supabase, session: null };
  }

  setSuppressGetSessionWarning(supabase, true);

  try {
    const { data, error } = allowRefresh
      ? await getUserWithBackoff(supabase)
      : await supabase.auth.getUser();

    if (error || !data.user) {
      if (error && isRefreshTokenError(error)) {
        await clearInvalidMiddlewareSession(request, response);
        return { supabase, session: null };
      }

      if (allowRefresh && error && isRetryableAuthError(error)) {
        const fallbackSession = await readSessionFromLocalClaims(supabase);
        if (fallbackSession?.user) {
          return { supabase, session: fallbackSession };
        }
      }

      return { supabase, session: null };
    }

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError && isRefreshTokenError(sessionError)) {
      await clearInvalidMiddlewareSession(request, response);
      return { supabase, session: null };
    }

    if (sessionError && isRetryableAuthError(sessionError)) {
      const fallbackSession = await readSessionFromLocalClaims(supabase);
      if (fallbackSession?.user) {
        return { supabase, session: fallbackSession };
      }
    }

    return { supabase, session: sessionData.session };
  } catch (error) {
    if (isRefreshTokenError(error)) {
      await clearInvalidMiddlewareSession(request, response);
      return { supabase, session: null };
    }

    if (allowRefresh && isRetryableAuthError(error)) {
      const fallbackSession = await readSessionFromLocalClaims(supabase);
      if (fallbackSession?.user) {
        return { supabase, session: fallbackSession };
      }
    }

    return { supabase, session: null };
  } finally {
    setSuppressGetSessionWarning(supabase, false);
  }
}

/**
 * Read auth from cookies without forcing a refresh on expired tokens.
 * Safe for /auth routes and parallel asset requests.
 */
export async function getMiddlewareSessionUser(
  request: NextRequest,
  response: NextResponse,
): Promise<JWTUserData | null> {
  const { session } = await readSession(request, response, {
    allowRefresh: false,
  });
  return session?.user ? mapSessionUser(session.user) : null;
}

/**
 * Validate session for protected routes. Refreshes when the access token
 * is expired. Clears cookies when refresh tokens are invalid or reused.
 */
export async function getMiddlewareAuthenticatedUser(
  request: NextRequest,
  response: NextResponse,
): Promise<
  | { user: JWTUserData; supabase: ReturnType<typeof createMiddlewareClient> }
  | { user: null; supabase: ReturnType<typeof createMiddlewareClient> }
> {
  const { supabase, session } = await readSession(request, response, {
    allowRefresh: true,
  });

  if (!session?.user) {
    return { user: null, supabase };
  }

  return { user: mapSessionUser(session.user), supabase };
}

/**
 * @deprecated Prefer getMiddlewareSessionUser on auth pages or
 * getMiddlewareAuthenticatedUser on protected routes.
 */
export async function validateMiddlewareSessionUser(
  request: NextRequest,
  response: NextResponse,
  _supabase: ReturnType<typeof createMiddlewareClient>,
): Promise<JWTUserData | null> {
  return getMiddlewareSessionUser(request, response);
}

export { isRefreshTokenError };
