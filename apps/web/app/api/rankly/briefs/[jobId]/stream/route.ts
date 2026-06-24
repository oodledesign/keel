import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

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
      .from('content_brief_jobs')
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
        .from('content_brief_jobs')
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

      let briefId: string | null = null;
      if (job.status === 'done') {
        const { data: brief } = await supabaseCustomSchema(client, 'rankly')
          .from('content_briefs')
          .select('id')
          .eq('job_id', jobId)
          .maybeSingle();
        briefId = (brief?.id as string | undefined) ?? null;
      }

      return {
        status: job.status as string,
        error_msg: job.error_msg as string | null,
        target_keyword: job.target_keyword as string | null,
        credits_used: job.credits_used as number | null,
        briefId,
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
