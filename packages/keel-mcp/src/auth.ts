import { timingSafeEqual } from 'node:crypto';

import type { McpRequestContext } from './context.js';
import { getKeelMcpSupabaseAdmin } from './supabase.js';

export type AuthResult =
  | { ok: true; context: McpRequestContext }
  | { ok: false; response: Response };

function unauthorized(message = 'Unauthorized'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer realm="keel-mcp"',
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

function tokenMatches(candidate: string, stored: string): boolean {
  const left = Buffer.from(candidate);
  const right = Buffer.from(stored);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function normalizeApiKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
}

export async function authenticateMcpRequest(
  request: Request,
): Promise<AuthResult> {
  const token = extractBearerToken(request);

  if (!token) {
    return { ok: false, response: unauthorized('Missing Bearer token') };
  }

  const supabase = getKeelMcpSupabaseAdmin();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, api_keys')
    .contains('api_keys', [token])
    .maybeSingle();

  if (error) {
    // Fall back to in-memory scan when contains() isn't supported for the column type.
    if (error.code === '42883' || error.message.includes('operator does not exist')) {
      return authenticateMcpRequestByScan(request, token, supabase);
    }

    console.error('[keel-mcp] Failed to validate API key:', error.message);
    return {
      ok: false,
      response: unauthorized('Invalid API key'),
    };
  }

  if (!profile?.id) {
    return { ok: false, response: unauthorized('Invalid API key') };
  }

  return {
    ok: true,
    context: {
      userId: profile.id as string,
      supabase,
    },
  };
}

async function authenticateMcpRequestByScan(
  request: Request,
  token: string,
  supabase: ReturnType<typeof getKeelMcpSupabaseAdmin>,
): Promise<AuthResult> {
  void request;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, api_keys')
    .not('api_keys', 'is', null);

  if (error) {
    console.error('[keel-mcp] Failed to validate API key:', error.message);
    return {
      ok: false,
      response: unauthorized('Invalid API key'),
    };
  }

  const profile = (data ?? []).find((row) => {
    const keys = normalizeApiKeys((row as { api_keys?: unknown }).api_keys);
    return keys.some((stored) => tokenMatches(token, stored));
  });

  if (!profile?.id) {
    return { ok: false, response: unauthorized('Invalid API key') };
  }

  return {
    ok: true,
    context: {
      userId: profile.id as string,
      supabase,
    },
  };
}
