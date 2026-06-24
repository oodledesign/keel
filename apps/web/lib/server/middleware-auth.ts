import type { NextRequest, NextResponse } from 'next/server';

import type { User } from '@supabase/supabase-js';

import { createMiddlewareClient } from '@kit/supabase/middleware-client';
import type { JWTUserData } from '@kit/supabase/types';

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

function mapSessionUser(user: User): JWTUserData {
  return {
    is_anonymous: user.is_anonymous ?? false,
    aal: 'aal1',
    email: user.email ?? '',
    phone: user.phone ?? '',
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

async function readSession(request: NextRequest, response: NextResponse) {
  const supabase = createMiddlewareClient(request, response);

  setSuppressGetSessionWarning(supabase, true);

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error && isRefreshTokenError(error)) {
      await supabase.auth.signOut();
      return { supabase, session: null };
    }

    return { supabase, session: data.session };
  } catch (error) {
    if (isRefreshTokenError(error)) {
      await supabase.auth.signOut();
      return { supabase, session: null };
    }

    throw error;
  } finally {
    setSuppressGetSessionWarning(supabase, false);
  }
}

export async function clearInvalidMiddlewareSession(
  request: NextRequest,
  response: NextResponse,
) {
  const supabase = createMiddlewareClient(request, response);
  await supabase.auth.signOut();
}

/**
 * Read auth from cookies only — no token refresh. Safe for /auth routes and
 * parallel requests (manifest, sw.js, sign-in page assets).
 */
export async function getMiddlewareSessionUser(
  request: NextRequest,
  response: NextResponse,
): Promise<JWTUserData | null> {
  const { session } = await readSession(request, response);
  return session?.user ? mapSessionUser(session.user) : null;
}

/**
 * Validate session for protected routes. Refreshes only when the access token
 * is near expiry. Clears cookies when refresh tokens are invalid/reused.
 */
export async function getMiddlewareAuthenticatedUser(
  request: NextRequest,
  response: NextResponse,
): Promise<
  | { user: JWTUserData; supabase: ReturnType<typeof createMiddlewareClient> }
  | { user: null; supabase: ReturnType<typeof createMiddlewareClient> }
> {
  const { supabase, session } = await readSession(request, response);

  if (!session?.user) {
    return { user: null, supabase };
  }

  const expiresAt = session.expires_at ?? 0;
  const now = Math.floor(Date.now() / 1000);
  const shouldValidateWithServer = expiresAt - now < 120;

  if (!shouldValidateWithServer) {
    return { user: mapSessionUser(session.user), supabase };
  }

  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      if (isRefreshTokenError(error)) {
        await clearInvalidMiddlewareSession(request, response);
        return { user: null, supabase };
      }

      throw error;
    }

    if (!data.user) {
      return { user: null, supabase };
    }

    return { user: mapSessionUser(data.user), supabase };
  } catch (error) {
    if (isRefreshTokenError(error)) {
      await clearInvalidMiddlewareSession(request, response);
      return { user: null, supabase };
    }

    console.warn('[middleware] Auth fetch failed (is Supabase running?):', error);
    return { user: null, supabase };
  }
}

/**
 * Confirm the cookie session with Supabase Auth before redirecting away from
 * sign-in/sign-up. Clears cookies when refresh tokens are invalid.
 */
export async function validateMiddlewareSessionUser(
  request: NextRequest,
  response: NextResponse,
  supabase: ReturnType<typeof createMiddlewareClient>,
): Promise<JWTUserData | null> {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      if (isRefreshTokenError(error)) {
        await clearInvalidMiddlewareSession(request, response);
      }

      return null;
    }

    return data.user ? mapSessionUser(data.user) : null;
  } catch (error) {
    if (isRefreshTokenError(error)) {
      await clearInvalidMiddlewareSession(request, response);
      return null;
    }

    console.warn('[middleware] Auth validation failed:', error);
    return null;
  }
}

export { isRefreshTokenError };
