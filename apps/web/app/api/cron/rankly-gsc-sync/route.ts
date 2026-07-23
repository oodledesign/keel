import { type NextRequest } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  CRON_KILL_SWITCH,
  cronSkippedResponse,
  isCronDisabled,
} from '~/lib/cron/cron-guards';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { listGscConnectionsDueForSync } from '~/lib/rankly-gsc/connection';
import { syncGscConnection } from '~/lib/rankly-gsc/sync';

export const runtime = 'nodejs';
export const maxDuration = 300;

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  if (isCronDisabled(CRON_KILL_SWITCH.RANKLY)) {
    return cronSkippedResponse('DISABLE_RANKLY_CRONS');
  }

  try {
    const client = getSupabaseServerAdminClient();
    const due = await listGscConnectionsDueForSync(client, 10);
    const results: Array<{
      projectId: string;
      ok: boolean;
      rows?: number;
      error?: string;
    }> = [];

    for (const connection of due) {
      try {
        const synced = await syncGscConnection(client, connection);
        results.push({
          projectId: connection.project_id,
          ok: true,
          rows: synced.rowsUpserted,
        });
      } catch (error) {
        results.push({
          projectId: connection.project_id,
          ok: false,
          error: error instanceof Error ? error.message : 'Sync failed',
        });
      }
    }

    return jsonOk({
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('[rankly] gsc cron', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Cron failed',
      500,
    );
  }
}
