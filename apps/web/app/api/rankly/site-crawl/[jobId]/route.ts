import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddon } from '~/lib/rankly/require-rankly-api-access';
import { SITE_CRAWL_WORKER_STALL_MINUTES } from '~/lib/site-crawl/config';
import { getSiteCrawlJob } from '~/lib/site-crawl/db';
import { syncSiteCrawlJobProgress } from '~/lib/site-crawl/runner';
import { triggerSiteCrawlRunDebounced } from '~/lib/site-crawl/trigger-run';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

function maybeRetriggerStalledCrawl(job: {
  id: string;
  status: string;
  updated_at: string;
  urls_crawled: number;
  url_limit: number;
  pending_urls: string[];
}) {
  if (job.status !== 'pending' && job.status !== 'running') return;

  const hasWork =
    job.pending_urls.length > 0 || job.urls_crawled < job.url_limit;
  if (!hasWork) return;

  const ageMs = Date.now() - new Date(job.updated_at).getTime();
  if (Number.isNaN(ageMs) || ageMs < 0) return;

  // Never started, or no progress for a few minutes — kick the worker again.
  const stallMs = SITE_CRAWL_WORKER_STALL_MINUTES * 60 * 1000;
  const neverStarted = job.status === 'pending' && job.urls_crawled === 0;
  if (neverStarted || ageMs >= stallMs) {
    void triggerSiteCrawlRunDebounced(job.id);
  }
}

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

    const job = await getSiteCrawlJob(jobId);

    const { data: project } = await supabaseCustomSchema(client, 'rankly')
      .from('projects')
      .select('account_id')
      .eq('id', job.project_id)
      .maybeSingle();

    if (!project) {
      return jsonErr('NOT_FOUND', 'Project not found', 404);
    }

    const isMember = await userIsAccountMember(
      client,
      user.id,
      project.account_id as string,
    );

    if (!isMember) {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const addonDenied = await denyUnlessRanklyAddon(
      client,
      user.id,
      project.account_id as string,
    );
    if (addonDenied) return addonDenied;

    await syncSiteCrawlJobProgress(jobId);
    const refreshedJob = await getSiteCrawlJob(jobId);
    maybeRetriggerStalledCrawl(refreshedJob);

    return jsonOk({ job: refreshedJob });
  } catch (error) {
    console.error('[rankly] site-crawl job GET', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to load job',
      500,
    );
  }
}
