import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadPageOptimizeReportByJobId } from '~/lib/page-optimize/db';
import { createJobSseResponse } from '~/lib/rankly/create-job-sse-response';
import { jsonErr } from '~/lib/rankly/api-response';
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

    return createJobSseResponse(async () => {
      const { data: job, error } = await supabaseCustomSchema(client, 'rankly')
        .from('page_optimization_jobs')
        .select('id, status, error_msg, target_keyword, credits_used')
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
        const report = await loadPageOptimizeReportByJobId(jobId);
        reportId = (report?.id as string | undefined) ?? null;
      }

      return {
        status: job.status as string,
        error_msg: job.error_msg as string | null,
        target_keyword: job.target_keyword as string | null,
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
