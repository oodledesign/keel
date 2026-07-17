import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  estimateProjectRankCheckCost,
  loadKeywordRankSnapshots,
  loadLatestRankCheckJob,
  loadRankTrackingSettings,
} from '~/lib/rank-tracking/db';
import {
  triggerRankCheckRun,
  triggerRankCheckRunDebounced,
} from '~/lib/rank-tracking/trigger-run';
import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddon } from '~/lib/rankly/require-rankly-api-access';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const runtime = 'nodejs';
export const maxDuration = 300;

const querySchema = z.object({
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
});

const startSchema = z.object({
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
});

const settingsSchema = z.object({
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
  rankRefreshInterval: z
    .enum(['manual', 'daily', 'weekly', 'monthly'])
    .optional(),
  trackDesktop: z.boolean().optional(),
  trackMobile: z.boolean().optional(),
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

export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const parsed = querySchema.safeParse({
      projectId: request.nextUrl.searchParams.get('projectId'),
      accountId: request.nextUrl.searchParams.get('accountId'),
    });

    if (!parsed.success) {
      return jsonErr(
        'VALIDATION',
        'Invalid query',
        400,
        parsed.error.flatten(),
      );
    }

    const accessError = await assertProjectAccess(
      client,
      user.id,
      parsed.data.projectId,
      parsed.data.accountId,
    );
    if (accessError) return accessError;

    const [settings, latestJob] = await Promise.all([
      loadRankTrackingSettings(parsed.data.projectId),
      loadLatestRankCheckJob(parsed.data.projectId),
    ]);

    const snapshots = await loadKeywordRankSnapshots(
      parsed.data.projectId,
      settings,
    );

    const { count } = await supabaseCustomSchema(client, 'rankly')
      .from('keywords')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', parsed.data.projectId);

    const keywordCount = count ?? 0;
    const estimatedCostUsd =
      settings != null
        ? estimateProjectRankCheckCost(keywordCount, settings)
        : 0;

    return jsonOk({
      settings,
      latestJob,
      snapshots,
      keywordCount,
      estimatedCostUsd,
    });
  } catch (error) {
    console.error('[rankly] rank-check GET', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to load rank tracking',
      500,
    );
  }
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
    const parsed = startSchema.safeParse(body);
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

    const { data: runningJob } = await supabaseCustomSchema(client, 'rankly')
      .from('rank_check_jobs')
      .select('id, status')
      .eq('project_id', parsed.data.projectId)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runningJob) {
      await triggerRankCheckRunDebounced(runningJob.id as string);
      return jsonOk({ jobId: runningJob.id as string, alreadyRunning: true });
    }

    const { count } = await supabaseCustomSchema(client, 'rankly')
      .from('keywords')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', parsed.data.projectId);

    if (!count) {
      return jsonErr(
        'VALIDATION',
        'Add keywords before running a rank check',
        400,
      );
    }

    const settings = await loadRankTrackingSettings(parsed.data.projectId);
    const estimatedCostUsd =
      settings != null ? estimateProjectRankCheckCost(count, settings) : 0;

    const { data: job, error } = await supabaseCustomSchema(client, 'rankly')
      .from('rank_check_jobs')
      .insert({
        project_id: parsed.data.projectId,
        user_id: user.id,
        status: 'pending',
        trigger_source: 'manual',
        keyword_count: count,
        estimated_cost_usd: estimatedCostUsd,
      })
      .select('id')
      .single();

    if (error || !job) {
      return jsonErr('INTERNAL', error?.message ?? 'Failed to create job', 500);
    }

    const jobId = job.id as string;
    triggerRankCheckRun(jobId);

    return jsonOk({ jobId, alreadyRunning: false, estimatedCostUsd });
  } catch (error) {
    console.error('[rankly] rank-check POST', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to start rank check',
      500,
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);
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

    const { updateRankRefreshInterval, updateRankTrackingDevices } =
      await import('~/lib/rank-tracking/db');

    if (parsed.data.rankRefreshInterval != null) {
      await updateRankRefreshInterval(
        parsed.data.projectId,
        parsed.data.rankRefreshInterval,
      );
    }

    if (parsed.data.trackDesktop != null || parsed.data.trackMobile != null) {
      const settings = await loadRankTrackingSettings(parsed.data.projectId);
      if (!settings) {
        return jsonErr('NOT_FOUND', 'Project not found', 404);
      }

      await updateRankTrackingDevices(parsed.data.projectId, {
        trackDesktop: parsed.data.trackDesktop ?? settings.trackDesktop,
        trackMobile: parsed.data.trackMobile ?? settings.trackMobile,
      });
    }

    const settings = await loadRankTrackingSettings(parsed.data.projectId);
    return jsonOk({ settings });
  } catch (error) {
    console.error('[rankly] rank-check PATCH', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to update settings',
      500,
    );
  }
}
