import 'server-only';

import { type SupabaseClient, createClient } from '@supabase/supabase-js';

import { createRemoteJWKSet, jwtVerify } from 'jose';

import { nativeJsonError } from './http';

export type NativeAuthContext = {
  userId: string;
  email: string | null;
  accessToken: string;
  supabase: SupabaseClient;
};

export type NativeAuthResult =
  | { ok: true; context: NativeAuthContext }
  | { ok: false; response: ReturnType<typeof nativeJsonError> };

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    ''
  );
}

function getSupabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim() ??
    ''
  );
}

function getSupabaseJwksUrl() {
  const base = getSupabaseUrl().replace(/\/+$/, '');
  if (!base) {
    throw new Error(
      'Native API requires SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.',
    );
  }

  return `${base}/auth/v1/.well-known/jwks.json`;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  jwks ??= createRemoteJWKSet(new URL(getSupabaseJwksUrl()));
  return jwks;
}

export function extractNativeBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')?.trim();
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

export function looksLikeJwt(token: string) {
  return token.split('.').length === 3;
}

export function createNativeSupabaseClient(
  accessToken: string,
): SupabaseClient {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error(
      'Native API requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and NEXT_PUBLIC_SUPABASE_PUBLIC_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).',
    );
  }

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function unauthorized(message = 'Unauthorized') {
  return nativeJsonError(401, message);
}

async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, getJwks());
  const sub = typeof payload.sub === 'string' ? payload.sub : null;

  if (!sub) {
    throw new Error('Token is missing subject');
  }

  const email = typeof payload.email === 'string' ? payload.email : null;

  return { sub, email };
}

/**
 * Cookie-free JWT auth for the iPhone client.
 * Accepts `Authorization: Bearer <supabase access token>` only.
 * Do not use Makerkit cookies or `keel_` recorder device tokens here.
 */
export async function authenticateNativeRequest(
  request: Request,
): Promise<NativeAuthResult> {
  const token = extractNativeBearerToken(request);

  if (!token) {
    return { ok: false, response: unauthorized('Missing Bearer token') };
  }

  if (!looksLikeJwt(token)) {
    return { ok: false, response: unauthorized('Invalid or expired token') };
  }

  try {
    const verified = await verifyAccessToken(token);

    return {
      ok: true,
      context: {
        userId: verified.sub,
        email: verified.email,
        accessToken: token,
        supabase: createNativeSupabaseClient(token),
      },
    };
  } catch (error) {
    console.error('[native] Failed to validate access token:', error);
    return { ok: false, response: unauthorized('Invalid or expired token') };
  }
}
