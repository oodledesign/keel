import { timingSafeEqual } from 'crypto';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { refreshInstagramAutoreplyToken } from '~/lib/instagram-autoreply/instagram-oauth';
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

/** Refresh Instagram long-lived tokens expiring within 7 days. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const admin = getSupabaseServerAdminClient();
  const threshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: accounts, error } = await admin
    .from('ig_connected_accounts')
    .select('id, access_token, token_expires_at')
    .eq('is_active', true)
    .or(`token_expires_at.is.null,token_expires_at.lte.${threshold}`);

  if (error) {
    return jsonErr('LOAD_FAILED', error.message, 500);
  }

  let refreshed = 0;
  let failed = 0;

  for (const row of accounts ?? []) {
    try {
      const plain = decryptIgToken((row as { access_token: string }).access_token);
      const result = await refreshInstagramAutoreplyToken(plain);
      const enc = encryptIgToken(result.accessToken);
      const expiresAt = new Date(
        Date.now() + Math.max(result.expiresIn, 3600) * 1000,
      ).toISOString();

      const { error: updateError } = await admin
        .from('ig_connected_accounts')
        .update({
          access_token: enc,
          token_expires_at: expiresAt,
        })
        .eq('id', (row as { id: string }).id);

      if (updateError) {
        failed += 1;
      } else {
        refreshed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return jsonOk({ refreshed, failed, scanned: accounts?.length ?? 0 });
}
