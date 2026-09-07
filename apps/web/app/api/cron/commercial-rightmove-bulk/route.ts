import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import {
  kickRightmoveBulkWorker,
  listStaleRightmoveBulkJobs,
  processRightmoveBulkJobBatch,
} from '~/lib/commercial/rightmove-bulk-job';

export const runtime = 'nodejs';
export const maxDuration = 120;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Resume Rightmove bulk jobs whose worker chain dropped. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const admin = getSupabaseServerAdminClient();
  const stale = await listStaleRightmoveBulkJobs(admin as never, 15);
  const resumed: Array<{ jobId: string; kicked: boolean }> = [];

  for (const job of stale) {
    const kicked = await kickRightmoveBulkWorker(job.id);
    if (!kicked) {
      await processRightmoveBulkJobBatch({
        client: admin as never,
        jobId: job.id,
      });
    }
    resumed.push({ jobId: job.id, kicked });
  }

  return jsonOk({ stale: stale.length, resumed });
}
