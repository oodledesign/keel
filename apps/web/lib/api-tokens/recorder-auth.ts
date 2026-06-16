import 'server-only';

import { NextResponse } from 'next/server';

import {
  touchApiTokenLastUsed,
  validateApiTokenForAuth,
} from '~/lib/api-tokens/api-tokens.service';
import { isKeelApiTokenFormat } from '~/lib/api-tokens/token';
import type { ValidatedApiToken } from '~/lib/api-tokens/types';

export function recorderUnauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function parseBearerToken(request: Request) {
  const header = request.headers.get('authorization');
  if (!header) return null;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

export async function authenticateRecorderRequest(
  request: Request,
  options?: { touchLastUsed?: boolean },
): Promise<ValidatedApiToken | NextResponse> {
  const rawToken = parseBearerToken(request);
  if (!rawToken || !isKeelApiTokenFormat(rawToken)) {
    return recorderUnauthorized();
  }

  const token = await validateApiTokenForAuth(rawToken);
  if (!token) {
    return recorderUnauthorized();
  }

  if (options?.touchLastUsed) {
    touchApiTokenLastUsed(token.id);
  }

  return token;
}
