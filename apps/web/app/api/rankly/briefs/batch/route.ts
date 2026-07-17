import { type NextRequest } from 'next/server';
import { after } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { runBriefJob } from '~/lib/briefs/runner';
import { estimateBriefCredits } from '~/lib/briefs/types';
import { loadClusterJobBundle } from '~/lib/clusters/db';
import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddon } from '~/lib/rankly/require-rankly-api-access';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const runtime = 'nodejs';
export const maxDuration = 300;

const batchSchema = z.object({
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
  clusterJobId: z.string().uuid(),
  clusterId: z.string().uuid().optional(),
  spokeIds: z.array(z.string().uuid()).optional(),
  country: z.string().trim().min(2).optional(),
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
    .select('id, domain, target_country')
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
    const parsed = batchSchema.safeParse(body);
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

    const { data: project, error: projectError } = await supabaseCustomSchema(
      client,
      'rankly',
    )
      .from('projects')
      .select('domain, target_country')
      .eq('id', parsed.data.projectId)
      .eq('account_id', parsed.data.accountId)
      .single();

    if (projectError || !project) {
      return jsonErr('NOT_FOUND', 'Project not found', 404);
    }

    const bundle = await loadClusterJobBundle(parsed.data.clusterJobId);
    if (bundle.job.project_id !== parsed.data.projectId) {
      return jsonErr('NOT_FOUND', 'Cluster job not found for project', 404);
    }

    if (bundle.job.status !== 'done') {
      return jsonErr('VALIDATION', 'Cluster plan must be complete', 400);
    }

    const spokeIdSet = parsed.data.spokeIds
      ? new Set(parsed.data.spokeIds)
      : null;

    const spokes = bundle.clusters
      .filter((cluster: { id: string }) =>
        parsed.data.clusterId ? cluster.id === parsed.data.clusterId : true,
      )
      .flatMap(
        (cluster: { spokes: Array<Record<string, unknown>> }) => cluster.spokes,
      )
      .filter((spoke: Record<string, unknown>) =>
        spokeIdSet ? spokeIdSet.has(spoke.id as string) : true,
      )
      .map((spoke: Record<string, unknown>) => ({
        id: spoke.id as string,
        target_keyword: spoke.target_keyword as string,
      }));

    if (!spokes.length) {
      return jsonErr('VALIDATION', 'No spokes matched for batch briefs', 400);
    }

    const country =
      parsed.data.country?.toLowerCase() ??
      (bundle.job.country as string) ??
      (project.target_country as string) ??
      'gb';

    const jobIds: string[] = [];

    for (const spoke of spokes) {
      const { data: job, error } = await supabaseCustomSchema(client, 'rankly')
        .from('content_brief_jobs')
        .insert({
          project_id: parsed.data.projectId,
          user_id: user.id,
          spoke_id: spoke.id,
          target_domain: project.domain as string,
          target_keyword: spoke.target_keyword,
          country,
          mode: 'quick',
          status: 'pending',
          credits_used: estimateBriefCredits('quick'),
        })
        .select('id')
        .single();

      if (error || !job) {
        return jsonErr(
          'DB_ERROR',
          error?.message ?? 'Failed to create job',
          500,
        );
      }

      const jobId = job.id as string;
      jobIds.push(jobId);

      after(() => {
        void runBriefJob(jobId).catch(console.error);
      });
    }

    return jsonOk({
      jobIds,
      count: jobIds.length,
    });
  } catch (error) {
    return jsonErr(
      'UNKNOWN',
      error instanceof Error ? error.message : 'Error',
      500,
    );
  }
}
