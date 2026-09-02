import { timingSafeEqual } from 'crypto';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { refreshLinkedInToken } from '~/lib/commercial/linkedin-publishing/linkedin-api';
import {
  decryptIgToken,
  encryptIgToken,
} from '~/lib/instagram-autoreply/token-crypto';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 120;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const incoming = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(incoming);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Refresh LinkedIn org tokens expiring within 7 days when a refresh token exists. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const admin = getSupabaseServerAdminClient();
  const threshold = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: rows, error } = await admin
    .from('linkedin_org_connections')
    .select('id, access_token, refresh_token, token_expires_at, status')
    .eq('status', 'connected')
    .not('refresh_token', 'is', null)
    .or(`token_expires_at.is.null,token_expires_at.lte.${threshold}`);

  if (error) {
    return jsonErr('LOAD_FAILED', error.message, 500);
  }

  let refreshed = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    const refreshCipher = (row as { refresh_token: string | null })
      .refresh_token;
    if (!refreshCipher) {
      skipped += 1;
      continue;
    }

    try {
      const refreshToken = decryptIgToken(refreshCipher);
      const result = await refreshLinkedInToken(refreshToken);
      const expiresAt = new Date(
        Date.now() + Math.max(result.expiresIn, 3600) * 1000,
      ).toISOString();

      const { error: updateError } = await admin
        .from('linkedin_org_connections')
        .update({
          access_token: encryptIgToken(result.accessToken),
          refresh_token: result.refreshToken
            ? encryptIgToken(result.refreshToken)
            : refreshCipher,
          token_expires_at: expiresAt,
          status: 'connected',
        })
        .eq('id', (row as { id: string }).id);

      if (updateError) {
        failed += 1;
      } else {
        refreshed += 1;
      }
    } catch {
      await admin
        .from('linkedin_org_connections')
        .update({ status: 'needs_reconnect' })
        .eq('id', (row as { id: string }).id);
      failed += 1;
    }
  }

  return jsonOk({
    refreshed,
    failed,
    skipped,
    scanned: rows?.length ?? 0,
  });
}
