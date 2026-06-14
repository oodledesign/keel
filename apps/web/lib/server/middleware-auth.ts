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

async function readSession(request: NextRequest, response: NextResponse) {
  const supabase = createMiddlewareClient(request, response);

  // Suppress the getSession warning. Remove when the issue is fixed.
  // https://github.com/supabase/auth-js/issues/873
  // @ts-expect-error: suppressGetSessionWarning is not part of the public API
  supabase.auth.suppressGetSessionWarning = true;

  const { data } = await supabase.auth.getSession();

  // @ts-expect-error: suppressGetSessionWarning is not part of the public API
  supabase.auth.suppressGetSessionWarning = false;

  return { supabase, session: data.session };
}

async function clearInvalidSession(
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
        await clearInvalidSession(request, response);
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
      await clearInvalidSession(request, response);
      return { user: null, supabase };
    }

    console.warn('[middleware] Auth fetch failed (is Supabase running?):', error);
    return { user: null, supabase };
  }
}

export { isRefreshTokenError };
