import { type NextRequest } from 'next/server';
import { after } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadClusterJobBundle } from '~/lib/clusters/db';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddonForProject } from '~/lib/rankly/require-rankly-api-access';
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
      .from('keyword_cluster_jobs')
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

    const addonDenied = await denyUnlessRanklyAddonForProject(
      client,
      user.id,
      job.project_id as string,
    );
    if (addonDenied) return addonDenied;

    if (job.status !== 'done') {
      return jsonOk({ job, clusters: [], qualityGates: [], links: [] });
    }

    const bundle = await loadClusterJobBundle(jobId);
    return jsonOk(bundle);
  } catch (error) {
    return jsonErr(
      'UNKNOWN',
      error instanceof Error ? error.message : 'Error',
      500,
    );
  }
}

export async function POST(_request: NextRequest, context: RouteContext) {
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
      .from('keyword_cluster_jobs')
      .select('id, status, project_id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return jsonErr('DB_ERROR', error.message, 500);
    }

    if (!job) {
      return jsonErr('NOT_FOUND', 'Job not found', 404);
    }

    const addonDenied = await denyUnlessRanklyAddonForProject(
      client,
      user.id,
      job.project_id as string,
    );
    if (addonDenied) return addonDenied;

    if (job.status !== 'awaiting_confirmation') {
      return jsonErr(
        'INVALID_STATE',
        `Job is ${job.status}, expected awaiting_confirmation`,
        400,
      );
    }

    const { runClusterSerpAndSave } = await import('~/lib/clusters/runner');

    after(() => {
      void runClusterSerpAndSave(jobId).catch(console.error);
    });

    await supabaseCustomSchema(client, 'rankly')
      .from('keyword_cluster_jobs')
      .update({ status: 'fetching_serps' })
      .eq('id', jobId);

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonErr(
      'UNKNOWN',
      error instanceof Error ? error.message : 'Error',
      500,
    );
  }
}
