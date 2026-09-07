import { type NextRequest, after } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import {
  kickRightmoveBulkWorker,
  loadRightmoveBulkJobById,
  processRightmoveBulkJobBatch,
} from '~/lib/commercial/rightmove-bulk-job';

export const runtime = 'nodejs';
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

function authorizeRun(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

async function continueInBackground(jobId: string): Promise<void> {
  try {
    const admin = getSupabaseServerAdminClient();
    const second = await processRightmoveBulkJobBatch({
      client: admin as never,
      jobId,
    });
    if (second.completed || !second.claimed) return;
  } catch (error) {
    console.error('[rightmove-bulk] after batch failed', jobId, error);
  }

  await kickRightmoveBulkWorker(jobId);
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!authorizeRun(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid run secret', 401);
  }

  try {
    const { jobId } = await context.params;
    const admin = getSupabaseServerAdminClient();
    const job = await loadRightmoveBulkJobById(admin as never, jobId);

    if (!job) {
      return jsonErr('NOT_FOUND', 'Rightmove bulk job not found', 404);
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return jsonOk({
        jobId,
        status: job.status,
        alreadyDone: true,
        completed: true,
      });
    }

    const result = await processRightmoveBulkJobBatch({
      client: admin as never,
      jobId,
    });

    if (!result.completed) {
      void kickRightmoveBulkWorker(jobId);
      after(() => {
        void continueInBackground(jobId);
      });
    }

    const refreshed = await loadRightmoveBulkJobById(admin as never, jobId);
    return jsonOk({
      jobId,
      status: refreshed?.status ?? job.status,
      completed: result.completed,
      processed: result.processed,
      claimed: result.claimed,
    });
  } catch (error) {
    console.error('[rightmove-bulk] run POST', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Rightmove bulk run failed',
      500,
    );
  }
}
