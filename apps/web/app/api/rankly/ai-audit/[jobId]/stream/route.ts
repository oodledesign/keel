import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadReportByJobId } from '~/lib/ai-audit/db';
import { createJobSseResponse } from '~/lib/rankly/create-job-sse-response';
import { jsonErr } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddonForProject } from '~/lib/rankly/require-rankly-api-access';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const runtime = 'nodejs';
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const { data: accessJob, error: accessError } = await supabaseCustomSchema(
      client,
      'rankly',
    )
      .from('ai_audit_jobs')
      .select('project_id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (accessError) {
      return jsonErr('DB_ERROR', accessError.message, 500);
    }

    if (!accessJob) {
      return jsonErr('NOT_FOUND', 'Job not found', 404);
    }

    const addonDenied = await denyUnlessRanklyAddonForProject(
      client,
      user.id,
      accessJob.project_id as string,
    );
    if (addonDenied) return addonDenied;

    return createJobSseResponse(async () => {
      const { data: job, error } = await supabaseCustomSchema(client, 'rankly')
        .from('ai_audit_jobs')
        .select('id, status, error_msg, pages_crawled, credits_used')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!job) {
        return null;
      }

      let reportId: string | null = null;
      if (job.status === 'done') {
        const report = await loadReportByJobId(jobId);
        reportId = report?.reportId ?? null;
      }

      return {
        status: job.status as string,
        error_msg: job.error_msg as string | null,
        pages_crawled: job.pages_crawled as number | null,
        credits_used: job.credits_used as number | null,
        reportId,
        done: job.status === 'done' || job.status === 'error',
      };
    });
  } catch (error) {
    return jsonErr(
      'UNKNOWN',
      error instanceof Error ? error.message : 'Error',
      500,
    );
  }
}
