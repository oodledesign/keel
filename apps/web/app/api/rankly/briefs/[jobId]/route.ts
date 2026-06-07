import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadBriefByJobId } from '~/lib/briefs/db';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const runtime = 'nodejs';

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

    const { data: job, error } = await supabaseCustomSchema(client, 'rankly')
      .from('content_brief_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return jsonErr('DB_ERROR', error.message, 500);
    }

    if (!job) {
      return jsonErr('NOT_FOUND', 'Job not found', 404);
    }

    if (job.status !== 'done') {
      return jsonOk({ job, briefId: null, brief: null });
    }

    const brief = await loadBriefByJobId(jobId);
    return jsonOk({
      job,
      briefId: brief?.id ?? null,
      brief,
    });
  } catch (error) {
    return jsonErr(
      'UNKNOWN',
      error instanceof Error ? error.message : 'Error',
      500,
    );
  }
}
