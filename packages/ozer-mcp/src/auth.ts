import { createRemoteJWKSet, jwtVerify } from 'jose';

import { SUPABASE_AUTH_SERVER, SUPABASE_JWKS_URL } from './config';
import type { McpRequestContext } from './context';
import { withMcpCors } from './cors';
import { getOAuthWwwAuthenticateHeader } from './metadata';
import { createOzerMcpSupabaseClient } from './supabase';

export type AuthResult =
  | { ok: true; context: McpRequestContext }
  | { ok: false; response: Response };

type VerifiedMcpToken = {
  sub: string;
  clientId: string;
};

const jwks = createRemoteJWKSet(new URL(SUPABASE_JWKS_URL));

function unauthorized(message = 'Unauthorized'): Response {
  return withMcpCors(
    new Response(JSON.stringify({ error: message }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': getOAuthWwwAuthenticateHeader(),
      },
    }),
  );
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')?.trim();
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() ?? null;
}

function readClientId(payload: Record<string, unknown>): string | null {
  if (typeof payload.client_id === 'string' && payload.client_id.trim()) {
    return payload.client_id.trim();
  }

  return null;
}

async function verifyAccessToken(token: string): Promise<VerifiedMcpToken> {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: SUPABASE_AUTH_SERVER,
  });

  const sub = typeof payload.sub === 'string' ? payload.sub : null;
  if (!sub) {
    throw new Error('Token is missing subject');
  }

  const clientId = readClientId(payload as Record<string, unknown>);
  if (!clientId) {
    throw new Error('Token is not an OAuth client token');
  }

  return { sub, clientId };
}

export async function authenticateMcpRequest(
  request: Request,
): Promise<AuthResult> {
  const token = extractBearerToken(request);

  if (!token) {
    return { ok: false, response: unauthorized('Missing Bearer token') };
  }

  try {
    const verified = await verifyAccessToken(token);

    return {
      ok: true,
      context: {
        userId: verified.sub,
        clientId: verified.clientId,
        accessToken: token,
        supabase: createOzerMcpSupabaseClient(token),
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    console.error('[ozer-mcp] Failed to validate OAuth access token', {
      reason,
    });
    return { ok: false, response: unauthorized('Invalid or expired token') };
  }
}
