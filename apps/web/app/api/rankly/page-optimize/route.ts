import { type NextRequest } from 'next/server';
import { after } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { runPageOptimizeJob } from '~/lib/page-optimize/runner';
import { PAGE_OPTIMIZE_CREDITS_ESTIMATE } from '~/lib/page-optimize/types';
import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddon } from '~/lib/rankly/require-rankly-api-access';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const runtime = 'nodejs';
export const maxDuration = 300;

const createSchema = z.object({
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
  sourceUrl: z.string().url(),
  targetKeyword: z.string().trim().min(1).optional(),
  country: z.string().trim().min(2).default('gb'),
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
    const parsed = createSchema.safeParse(body);
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
      .from('page_optimization_jobs')
      .insert({
        project_id: parsed.data.projectId,
        user_id: user.id,
        source_url: parsed.data.sourceUrl,
        target_keyword: parsed.data.targetKeyword ?? null,
        country: parsed.data.country.toLowerCase(),
        status: 'pending',
        credits_used: PAGE_OPTIMIZE_CREDITS_ESTIMATE,
      })
      .select('*')
      .single();

    if (error || !job) {
      return jsonErr('DB_ERROR', error?.message ?? 'Failed to create job', 500);
    }

    after(() => {
      void runPageOptimizeJob(job.id as string).catch(console.error);
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
