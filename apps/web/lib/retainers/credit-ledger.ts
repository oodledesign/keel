import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type AdjustProjectRetainerResult = {
  ok: boolean;
  balance?: number;
  delta?: number;
  error?: string;
  available?: number;
  requested?: number;
};

export type ConsumeProjectRetainerResult = {
  ok: boolean;
  consumed?: number;
  balance?: number;
  idempotent?: boolean;
  error?: string;
  available?: number;
  requested?: number;
};

export type RestoreProjectRetainerResult = {
  ok: boolean;
  refunded?: number;
  balance?: number;
  idempotent?: boolean;
  error?: string;
};

function adminDb() {
  return getSupabaseServerAdminClient() as any;
}

export async function ensureProjectRetainer(input: {
  projectId: string;
  accountId: string;
}) {
  const { data, error } = await adminDb().rpc('ensure_project_retainer', {
    p_project_id: input.projectId,
    p_account_id: input.accountId,
  });

  if (error) {
    throw new Error(error.message || 'ensure_project_retainer failed');
  }

  return data as {
    project_id: string;
    account_id: string;
    credit_balance: number;
    auto_match_enabled: boolean;
    weekly_digest_enabled: boolean;
  };
}

export async function adjustProjectRetainerCredits(input: {
  projectId: string;
  accountId: string;
  delta: number;
  actorId?: string | null;
  reason?: string | null;
}): Promise<AdjustProjectRetainerResult> {
  const { data, error } = await adminDb().rpc(
    'adjust_project_retainer_credits',
    {
      p_project_id: input.projectId,
      p_account_id: input.accountId,
      p_delta: input.delta,
      p_actor_id: input.actorId ?? null,
      p_reason: input.reason ?? null,
    },
  );

  if (error) {
    throw new Error(error.message || 'adjust_project_retainer_credits failed');
  }

  return (data ?? {
    ok: false,
    error: 'empty_response',
  }) as AdjustProjectRetainerResult;
}

export async function consumeProjectRetainerCredits(input: {
  projectId: string;
  accountId: string;
  amount: number;
  serviceId?: string | null;
  taskId?: string | null;
  suggestionId?: string | null;
  actorId?: string | null;
  reason?: string | null;
}): Promise<ConsumeProjectRetainerResult> {
  const { data, error } = await adminDb().rpc(
    'consume_project_retainer_credits',
    {
      p_project_id: input.projectId,
      p_account_id: input.accountId,
      p_amount: input.amount,
      p_service_id: input.serviceId ?? null,
      p_task_id: input.taskId ?? null,
      p_suggestion_id: input.suggestionId ?? null,
      p_actor_id: input.actorId ?? null,
      p_reason: input.reason ?? null,
    },
  );

  if (error) {
    throw new Error(error.message || 'consume_project_retainer_credits failed');
  }

  return (data ?? {
    ok: false,
    error: 'empty_response',
  }) as ConsumeProjectRetainerResult;
}

export async function restoreProjectRetainerCredits(input: {
  taskId: string;
  actorId?: string | null;
  reason?: string | null;
}): Promise<RestoreProjectRetainerResult> {
  const { data, error } = await adminDb().rpc(
    'restore_project_retainer_credits',
    {
      p_task_id: input.taskId,
      p_actor_id: input.actorId ?? null,
      p_reason: input.reason ?? 'undo',
    },
  );

  if (error) {
    throw new Error(error.message || 'restore_project_retainer_credits failed');
  }

  return (data ?? { ok: false, refunded: 0 }) as RestoreProjectRetainerResult;
}
