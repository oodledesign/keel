import { createRemoteJWKSet, jwtVerify } from 'jose';

import type { McpRequestContext } from './context';
import {
  getOAuthProtectedResourceMetadataUrl,
  SUPABASE_JWKS_URL,
} from './config';
import { createKeelMcpSupabaseClient } from './supabase';

export type AuthResult =
  | { ok: true; context: McpRequestContext }
  | { ok: false; response: Response };

type VerifiedMcpToken = {
  sub: string;
  clientId: string | null;
};

const jwks = createRemoteJWKSet(new URL(SUPABASE_JWKS_URL));

function unauthorized(message = 'Unauthorized'): Response {
  const resourceMetadata = getOAuthProtectedResourceMetadataUrl();

  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadata}"`,
    },
  });
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')?.trim();
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() ?? null;
}

async function verifyAccessToken(token: string): Promise<VerifiedMcpToken> {
  const { payload } = await jwtVerify(token, jwks);

  const sub = typeof payload.sub === 'string' ? payload.sub : null;
  if (!sub) {
    throw new Error('Token is missing subject');
  }

  const clientId =
    typeof payload.client_id === 'string'
      ? payload.client_id
      : typeof payload.azp === 'string'
        ? payload.azp
        : null;

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
        supabase: createKeelMcpSupabaseClient(token),
      },
    };
  } catch (error) {
    console.error('[keel-mcp] Failed to validate OAuth access token:', error);
    return { ok: false, response: unauthorized('Invalid or expired token') };
  }
}
