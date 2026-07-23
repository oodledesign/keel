import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { normaliseDomain } from '~/lib/ai-audit/crawl';
import { triggerAiAuditRun } from '~/lib/ai-audit/trigger-run';
import { AUDIT_CREDITS_ESTIMATE } from '~/lib/ai-audit/types';
import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddon } from '~/lib/rankly/require-rankly-api-access';
import { rateLimitApiRequest } from '~/lib/rate-limit/api-rate-limit';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const runtime = 'nodejs';
export const maxDuration = 60;

const createAuditSchema = z.object({
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
  targetDomain: z.string().trim().min(3),
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
    .select('id, domain, locale')
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

    const limited = rateLimitApiRequest(request, {
      scope: 'rankly-ai-audit',
      limit: 10,
      subject: user.id,
    });
    if (limited) return limited;

    const body = await request.json();
    const parsed = createAuditSchema.safeParse(body);
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

    const { data: projectRow } = await supabaseCustomSchema(client, 'rankly')
      .from('projects')
      .select('domain, locale')
      .eq('id', parsed.data.projectId)
      .single();

    const domain = normaliseDomain(
      parsed.data.targetDomain || String(projectRow?.domain ?? ''),
    );

    const { data: job, error } = await supabaseCustomSchema(client, 'rankly')
      .from('ai_audit_jobs')
      .insert({
        project_id: parsed.data.projectId,
        user_id: user.id,
        target_domain: domain,
        status: 'pending',
        credits_used: AUDIT_CREDITS_ESTIMATE,
      })
      .select('*')
      .single();

    if (error || !job) {
      return jsonErr('DB_ERROR', error?.message ?? 'Failed to create job', 500);
    }

    triggerAiAuditRun(job.id as string);

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

    const { data: jobs } = await supabaseCustomSchema(client, 'rankly')
      .from('ai_audit_jobs')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', user.id);

    const jobIds = (jobs ?? []).map((j: { id: string }) => j.id);
    if (!jobIds.length) {
      return jsonOk([]);
    }

    const { data, error } = await supabaseCustomSchema(client, 'rankly')
      .from('ai_audit_reports')
      .select('id, target_domain, overall_score, created_at, job_id')
      .in('job_id', jobIds)
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
