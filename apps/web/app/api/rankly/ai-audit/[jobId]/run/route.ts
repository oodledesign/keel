import { type NextRequest } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { getAuditJob, updateAuditJobStatus } from '~/lib/ai-audit/db';
import { runAuditJob } from '~/lib/ai-audit/runner';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

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

export async function POST(request: NextRequest, context: RouteContext) {
  if (!authorizeRun(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid run secret', 401);
  }

  try {
    const { jobId } = await context.params;
    const job = await getAuditJob(jobId);

    if (job.status === 'done') {
      return jsonOk({ jobId, status: 'done', alreadyDone: true });
    }

    if (job.status === 'error') {
      return jsonOk({ jobId, status: 'error', alreadyDone: true });
    }

    const admin = getSupabaseServerAdminClient();
    const { data: project } = await supabaseCustomSchema(admin, 'rankly')
      .from('projects')
      .select('locale')
      .eq('id', job.project_id)
      .maybeSingle();

    await runAuditJob(jobId, (project?.locale as string | null) ?? null);

    const refreshed = await getAuditJob(jobId);
    return jsonOk({ jobId, status: refreshed.status });
  } catch (error) {
    console.error('[rankly] ai-audit run POST', error);
    try {
      const { jobId } = await context.params;
      await updateAuditJobStatus(jobId, 'error', {
        error_msg: error instanceof Error ? error.message : 'Audit run failed',
      });
    } catch {
      // ignore secondary failure
    }
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'AI audit run failed',
      500,
    );
  }
}
