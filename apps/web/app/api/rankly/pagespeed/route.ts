import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  loadLatestPagespeedCheckJob,
  loadPagespeedSettings,
  loadPagespeedSnapshots,
  updatePagespeedRefreshInterval,
} from '~/lib/pagespeed/db';
import { triggerPagespeedRun } from '~/lib/pagespeed/trigger-run';
import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddon } from '~/lib/rankly/require-rankly-api-access';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
  pagespeedRefreshInterval: z.enum(['manual', 'daily', 'weekly', 'monthly']),
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

    const [settings, snapshots, latestJob] = await Promise.all([
      loadPagespeedSettings(parsed.data.projectId),
      loadPagespeedSnapshots(parsed.data.projectId),
      loadLatestPagespeedCheckJob(parsed.data.projectId),
    ]);

    return jsonOk({ settings, snapshots, latestJob });
  } catch (error) {
    console.error('[rankly] pagespeed GET', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to load PageSpeed data',
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
      .from('pagespeed_check_jobs')
      .select('id, status')
      .eq('project_id', parsed.data.projectId)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runningJob) {
      triggerPagespeedRun(runningJob.id as string);
      return jsonOk({ jobId: runningJob.id as string, alreadyRunning: true });
    }

    const { data: job, error } = await supabaseCustomSchema(client, 'rankly')
      .from('pagespeed_check_jobs')
      .insert({
        project_id: parsed.data.projectId,
        user_id: user.id,
        status: 'pending',
        trigger_source: 'manual',
      })
      .select('id')
      .single();

    if (error || !job) {
      return jsonErr('INTERNAL', error?.message ?? 'Failed to create job', 500);
    }

    const jobId = job.id as string;
    triggerPagespeedRun(jobId);

    return jsonOk({ jobId, alreadyRunning: false });
  } catch (error) {
    console.error('[rankly] pagespeed POST', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error
        ? error.message
        : 'Failed to start PageSpeed check',
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

    await updatePagespeedRefreshInterval(
      parsed.data.projectId,
      parsed.data.pagespeedRefreshInterval,
    );

    const settings = await loadPagespeedSettings(parsed.data.projectId);
    return jsonOk({ settings });
  } catch (error) {
    console.error('[rankly] pagespeed PATCH', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to update settings',
      500,
    );
  }
}
