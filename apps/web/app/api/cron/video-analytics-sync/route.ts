import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { syncStaleVideoAnalyticsBatch } from '~/lib/videos/server/sync-video-analytics';

export const runtime = 'nodejs';
export const maxDuration = 120;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const logger = await getLogger();

  try {
    const admin = getSupabaseServerAdminClient();
    const result = await syncStaleVideoAnalyticsBatch(admin, {
      limit: 40,
      staleAfterMs: 60 * 60 * 1000,
    });

    logger.info(
      { name: 'videos.analytics.cron', ...result },
      'Video analytics sync complete',
    );

    return jsonOk(result);
  } catch (error) {
    logger.error(
      {
        name: 'videos.analytics.cron',
        error: error instanceof Error ? error.message : String(error),
      },
      'Video analytics sync failed',
    );

    return jsonErr(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Video analytics sync failed',
      500,
    );
  }
}
