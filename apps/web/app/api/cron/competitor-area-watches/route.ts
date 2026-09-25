import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { processCompetitorAreaWatches } from '~/lib/commercial/competitor-tracker';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 120;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * Hourly: match ingested competitor listings to area watches and create
 * new / price_changed notifications. Does not scrape Rightmove search.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  try {
    const admin = getSupabaseServerAdminClient();
    const result = await processCompetitorAreaWatches({
      client: admin,
      sinceHours: 6,
    });
    return jsonOk(result);
  } catch (error) {
    console.error('[competitor-area-watches cron]', error);
    return jsonErr(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Unknown error',
      500,
    );
  }
}
