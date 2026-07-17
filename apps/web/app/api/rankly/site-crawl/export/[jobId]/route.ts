import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { jsonErr } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddon } from '~/lib/rankly/require-rankly-api-access';
import {
  getSiteCrawlJob,
  loadSiteCrawlPagesForExport,
} from '~/lib/site-crawl/db';
import { siteCrawlPagesToCsv } from '~/lib/site-crawl/export';
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

    const job = await getSiteCrawlJob(jobId);

    const { data: project } = await supabaseCustomSchema(client, 'rankly')
      .from('projects')
      .select('account_id, domain')
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

    const pages = await loadSiteCrawlPagesForExport(jobId);
    const csv = siteCrawlPagesToCsv(pages);
    const filename = `rankly-site-crawl-${String(project.domain).replace(/\./g, '-')}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[rankly] site-crawl export GET', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to export crawl',
      500,
    );
  }
}
