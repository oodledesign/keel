import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { runCommercialAutoCirculation } from '~/lib/commercial/circulation/auto-circulate';
import { runCommercialMatchDigest } from '~/lib/commercial/commercial-match-digest';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 120;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Daily: desk digest of commercial listing ↔ requirement suggestions. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const admin = getSupabaseServerAdminClient();
  const digest = await runCommercialMatchDigest(admin);
  const circulation = await runCommercialAutoCirculation(admin);

  return jsonOk({ digest, circulation });
}
