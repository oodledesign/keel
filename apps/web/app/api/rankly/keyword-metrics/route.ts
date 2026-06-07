import { type NextRequest } from 'next/server';
import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { enrichProjectKeywordMetrics } from '~/lib/rank-tracking/keyword-metrics';
import { estimateKeywordOverviewCostUsd } from '~/lib/dataforseo/keywords';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const runtime = 'nodejs';
export const maxDuration = 120;

const bodySchema = z.object({
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
  keywordIds: z.array(z.string().uuid()).optional(),
  force: z.boolean().optional(),
});

const querySchema = z.object({
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
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
      return jsonErr('VALIDATION', 'Invalid query', 400, parsed.error.flatten());
    }

    const accessError = await assertProjectAccess(
      client,
      user.id,
      parsed.data.projectId,
      parsed.data.accountId,
    );
    if (accessError) return accessError;

    const { count: totalCount } = await supabaseCustomSchema(client, 'rankly')
      .from('keywords')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', parsed.data.projectId);

    const { count: missingCount } = await supabaseCustomSchema(client, 'rankly')
      .from('keywords')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', parsed.data.projectId)
      .is('metrics_updated_at', null);

    const keywordCount = totalCount ?? 0;
    const needsMetrics = missingCount ?? 0;

    return jsonOk({
      keywordCount,
      needsMetrics,
      estimatedCostUsd: estimateKeywordOverviewCostUsd(
        needsMetrics || keywordCount,
      ),
    });
  } catch (error) {
    console.error('[rankly] keyword-metrics GET', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to load metrics estimate',
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
    const parsed = bodySchema.safeParse(body);
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

    const result = await enrichProjectKeywordMetrics({
      projectId: parsed.data.projectId,
      keywordIds: parsed.data.keywordIds,
      force: parsed.data.force,
    });

    return jsonOk(result);
  } catch (error) {
    console.error('[rankly] keyword-metrics POST', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to fetch keyword metrics',
      500,
    );
  }
}
