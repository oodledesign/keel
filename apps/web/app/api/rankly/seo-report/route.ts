import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  createSeoReportSnapshot,
  loadLatestSeoReportForProject,
} from '~/lib/rankly-seo-report/db';
import { buildPublicSeoReportUrl } from '~/lib/rankly-seo-report/public-url';
import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddon } from '~/lib/rankly/require-rankly-api-access';
import { rateLimitApiRequest } from '~/lib/rate-limit/api-rate-limit';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const runtime = 'nodejs';
export const maxDuration = 60;

const createSchema = z.object({
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
  enableShare: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const projectId = request.nextUrl.searchParams.get('projectId');
    if (!projectId || !z.string().uuid().safeParse(projectId).success) {
      return jsonErr('VALIDATION', 'projectId is required', 400);
    }

    const addonDenied = await denyUnlessRanklyAddonForProjectSafe(
      client,
      user.id,
      projectId,
    );
    if (addonDenied) return addonDenied;

    const latest = await loadLatestSeoReportForProject(projectId);
    if (!latest) {
      return jsonOk({ report: null });
    }

    return jsonOk({
      report: {
        id: latest.id,
        title: latest.title,
        targetDomain: latest.target_domain,
        createdAt: latest.created_at,
        publicShareEnabled: latest.public_share_enabled,
        token: latest.public_share_token,
        publicUrl:
          latest.public_share_enabled && latest.public_share_token
            ? buildPublicSeoReportUrl(latest.public_share_token)
            : null,
        overallScore: latest.snapshot.overallScore,
      },
    });
  } catch (error) {
    return jsonErr(
      'UNKNOWN',
      error instanceof Error ? error.message : 'Failed to load report',
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

    const limited = rateLimitApiRequest(request, {
      scope: 'rankly-seo-report',
      limit: 20,
      subject: user.id,
    });
    if (limited) return limited;

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400, parsed.error.flatten());
    }

    const { projectId, accountId, enableShare } = parsed.data;

    const isMember = await userIsAccountMember(client, user.id, accountId);
    if (!isMember) {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const addonDenied = await denyUnlessRanklyAddon(client, user.id, accountId);
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

    const report = await createSeoReportSnapshot({
      projectId,
      accountId,
      userId: user.id,
      enableShare: enableShare ?? true,
    });

    return jsonOk({
      id: report.id,
      title: report.title,
      targetDomain: report.target_domain,
      createdAt: report.created_at,
      publicShareEnabled: report.public_share_enabled,
      publicUrl:
        report.public_share_enabled && report.public_share_token
          ? buildPublicSeoReportUrl(report.public_share_token)
          : null,
      token: report.public_share_token,
      overallScore: report.snapshot.overallScore,
    });
  } catch (error) {
    console.error('[rankly] seo-report POST', error);
    return jsonErr(
      'UNKNOWN',
      error instanceof Error ? error.message : 'Failed to create report',
      500,
    );
  }
}

async function denyUnlessRanklyAddonForProjectSafe(
  client: SupabaseClient,
  userId: string,
  projectId: string,
) {
  const { data: project } = await supabaseCustomSchema(client, 'rankly')
    .from('projects')
    .select('account_id')
    .eq('id', projectId)
    .maybeSingle();

  if (!project?.account_id) {
    return jsonErr('NOT_FOUND', 'Project not found', 404);
  }

  return denyUnlessRanklyAddon(client, userId, project.account_id as string);
}
