import { type NextRequest } from 'next/server';
import { after } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { runClusterJob } from '~/lib/clusters/runner';
import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddon } from '~/lib/rankly/require-rankly-api-access';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const runtime = 'nodejs';
export const maxDuration = 300;

const createClusterSchema = z.object({
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
  seeds: z.array(z.string().trim().min(1)).min(3).max(20),
  country: z.string().trim().min(2).default('gb'),
  minVolume: z.number().int().min(0).default(100),
  maxKD: z.number().int().min(0).max(100).default(60),
});

async function assertProjectAccess(
  client: SupabaseClient,
  userId: string,
  projectId: string,
  accountId: string,
) {
  const isMember = await userIsAccountMember(client, userId, accountId);

  if (!isMember) {
    return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
  }

  const addonDenied = await denyUnlessRanklyAddon(client, userId, accountId);
  if (addonDenied) return addonDenied;

  const { data: project } = await supabaseCustomSchema(client, 'rankly')
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (!project) {
    return jsonErr('NOT_FOUND', 'Project not found', 404);
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const body = await request.json();
    const parsed = createClusterSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400, parsed.error.flatten());
    }

    const accessError = await assertProjectAccess(
      client,
      user.id,
      parsed.data.projectId,
      parsed.data.accountId,
    );
    if (accessError) return accessError;

    const { data: job, error } = await supabaseCustomSchema(client, 'rankly')
      .from('keyword_cluster_jobs')
      .insert({
        project_id: parsed.data.projectId,
        user_id: user.id,
        seeds: parsed.data.seeds,
        country: parsed.data.country.toLowerCase(),
        min_volume: parsed.data.minVolume,
        max_kd: parsed.data.maxKD,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error || !job) {
      return jsonErr('DB_ERROR', error?.message ?? 'Failed to create job', 500);
    }

    after(() => {
      void runClusterJob(job.id as string).catch(console.error);
    });

    return jsonOk({ jobId: job.id, job });
  } catch (error) {
    return jsonErr(
      'UNKNOWN',
      error instanceof Error ? error.message : 'Error',
      500,
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const projectId = request.nextUrl.searchParams.get('project_id');
    if (!projectId) {
      return jsonErr('VALIDATION', 'project_id query param required', 400);
    }

    const { data, error } = await supabaseCustomSchema(client, 'rankly')
      .from('keyword_cluster_jobs')
      .select(
        'id, status, seeds, country, credits_used, candidate_count, error_msg, created_at, updated_at',
      )
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return jsonErr('DB_ERROR', error.message, 500);
    }

    return jsonOk(data ?? []);
  } catch (error) {
    return jsonErr(
      'UNKNOWN',
      error instanceof Error ? error.message : 'Error',
      500,
    );
  }
}
