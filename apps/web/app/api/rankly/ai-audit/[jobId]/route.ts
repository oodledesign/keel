import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  AUDIT_ACTIVE_LOCK_MS,
  AUDIT_STALE_RUNNING_MS,
  loadReportByJobId,
} from '~/lib/ai-audit/db';
import { triggerAiAuditRunDebounced } from '~/lib/ai-audit/trigger-run';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddonForProject } from '~/lib/rankly/require-rankly-api-access';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

const STALE_PENDING_MS = 45_000;

function maybeRetriggerStuckAudit(job: {
  id: string;
  status: string;
  updated_at?: string | null;
  created_at?: string | null;
}) {
  const terminal = job.status === 'done' || job.status === 'error';
  if (terminal) return;

  const stamp = job.updated_at ?? job.created_at;
  if (!stamp) return;
  const ageMs = Date.now() - new Date(stamp).getTime();
  if (Number.isNaN(ageMs) || ageMs < 0) return;

  // Never kick a worker that is still heartbeating.
  if (ageMs < AUDIT_ACTIVE_LOCK_MS) return;

  if (job.status === 'pending' && ageMs >= STALE_PENDING_MS) {
    void triggerAiAuditRunDebounced(job.id);
    return;
  }

  // Worker may have been killed mid-flight. Only reclaim after a long stall;
  // /run resumes from checkpoint instead of restarting from scratch.
  if (ageMs >= AUDIT_STALE_RUNNING_MS) {
    void triggerAiAuditRunDebounced(job.id);
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

    const { data: job, error } = await supabaseCustomSchema(client, 'rankly')
      .from('ai_audit_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return jsonErr('DB_ERROR', error.message, 500);
    }

    if (!job) {
      return jsonErr('NOT_FOUND', 'Job not found', 404);
    }

    const addonDenied = await denyUnlessRanklyAddonForProject(
      client,
      user.id,
      job.project_id as string,
    );
    if (addonDenied) return addonDenied;

    maybeRetriggerStuckAudit({
      id: job.id as string,
      status: job.status as string,
      updated_at: (job.updated_at as string | null) ?? null,
      created_at: (job.created_at as string | null) ?? null,
    });

    if (job.status !== 'done') {
      return jsonOk({ job, reportId: null });
    }

    const report = await loadReportByJobId(jobId);
    return jsonOk({
      job,
      reportId: report?.reportId ?? null,
    });
  } catch (error) {
    return jsonErr(
      'UNKNOWN',
      error instanceof Error ? error.message : 'Error',
      500,
    );
  }
}
