import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddon } from '~/lib/rankly/require-rankly-api-access';
import {
  loadLatestSiteCrawlJob,
  loadSiteCrawlPages,
} from '~/lib/site-crawl/db';
import { projectDomainToStartUrl } from '~/lib/site-crawl/domain';
import { seedSiteCrawlJob } from '~/lib/site-crawl/runner';
import {
  triggerSiteCrawlRun,
  triggerSiteCrawlRunDebounced,
} from '~/lib/site-crawl/trigger-run';
import {
  DEFAULT_SITE_CRAWL_URL_LIMIT,
  SITE_CRAWL_URL_LIMIT_OPTIONS,
} from '~/lib/site-crawl/types';
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
  urlLimit: z
    .number()
    .int()
    .refine(
      (value) =>
        SITE_CRAWL_URL_LIMIT_OPTIONS.includes(
          value as (typeof SITE_CRAWL_URL_LIMIT_OPTIONS)[number],
        ),
      'Invalid URL limit',
    )
    .optional(),
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
    .select('id, domain')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (!project) {
    return jsonErr('NOT_FOUND', 'Project not found', 404);
  }

  return project;
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

    const access = await assertProjectAccess(
      client,
      user.id,
      parsed.data.projectId,
      parsed.data.accountId,
    );
    if (access instanceof Response) return access;

    const latestJob = await loadLatestSiteCrawlJob(parsed.data.projectId);
    const pages =
      latestJob && latestJob.status === 'done'
        ? await loadSiteCrawlPages(latestJob.id)
        : latestJob &&
            (latestJob.status === 'running' || latestJob.status === 'pending')
          ? await loadSiteCrawlPages(latestJob.id, 200)
          : [];

    return jsonOk({
      latestJob,
      pages,
      defaultUrlLimit: DEFAULT_SITE_CRAWL_URL_LIMIT,
      urlLimitOptions: SITE_CRAWL_URL_LIMIT_OPTIONS,
    });
  } catch (error) {
    console.error('[rankly] site-crawl GET', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to load site crawl',
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

    const access = await assertProjectAccess(
      client,
      user.id,
      parsed.data.projectId,
      parsed.data.accountId,
    );
    if (access instanceof Response) return access;

    const project = access;
    const urlLimit = parsed.data.urlLimit ?? DEFAULT_SITE_CRAWL_URL_LIMIT;

    const { data: runningJob } = await supabaseCustomSchema(client, 'rankly')
      .from('site_crawl_jobs')
      .select('id, status')
      .eq('project_id', parsed.data.projectId)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runningJob) {
      await triggerSiteCrawlRunDebounced(runningJob.id as string);
      return jsonOk({ jobId: runningJob.id as string, alreadyRunning: true });
    }

    const startUrl = projectDomainToStartUrl(String(project.domain));

    const { data: job, error } = await supabaseCustomSchema(client, 'rankly')
      .from('site_crawl_jobs')
      .insert({
        project_id: parsed.data.projectId,
        user_id: user.id,
        status: 'pending',
        trigger_source: 'manual',
        start_url: startUrl,
        url_limit: urlLimit,
      })
      .select('id')
      .single();

    if (error || !job) {
      return jsonErr('INTERNAL', error?.message ?? 'Failed to create job', 500);
    }

    const jobId = job.id as string;
    await seedSiteCrawlJob({
      jobId,
      domain: String(project.domain),
      urlLimit,
    });
    triggerSiteCrawlRun(jobId);

    return jsonOk({ jobId, alreadyRunning: false, urlLimit });
  } catch (error) {
    console.error('[rankly] site-crawl POST', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to start site crawl',
      500,
    );
  }
}
