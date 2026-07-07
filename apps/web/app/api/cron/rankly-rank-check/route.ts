import { type NextRequest } from 'next/server';

import { loadProjectsDueForRankCheck } from '~/lib/rank-tracking/db';
import { triggerRankCheckRun } from '~/lib/rank-tracking/trigger-run';
import { CRON_KILL_SWITCH, cronSkippedResponse, isCronDisabled } from '~/lib/cron/cron-guards';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

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
    return cronSkippedResponse('rankly-rank-check disabled');
  }

  try {
    const due = await loadProjectsDueForRankCheck(5);
    const started: string[] = [];

    for (const project of due) {
      const db = supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');

      const { data: running } = await db
        .from('rank_check_jobs')
        .select('id')
        .eq('project_id', project.projectId)
        .in('status', ['pending', 'running'])
        .limit(1)
        .maybeSingle();

      if (running) continue;

      const { count } = await db
        .from('keywords')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', project.projectId);

      if (!count) continue;

      const { data: job } = await db
        .from('rank_check_jobs')
        .insert({
          project_id: project.projectId,
          status: 'pending',
          trigger_source: 'cron',
          keyword_count: count,
        })
        .select('id')
        .single();

      if (!job?.id) continue;

      const jobId = job.id as string;
      started.push(jobId);
      triggerRankCheckRun(jobId);
    }

    return jsonOk({ started: started.length, jobIds: started });
  } catch (error) {
    console.error('[rankly] rank-check cron', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Cron failed',
      500,
    );
  }
}
