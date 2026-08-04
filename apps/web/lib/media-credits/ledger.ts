import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  type DebitAllocation,
  InsufficientMediaCreditsError,
  isInsufficientMediaCreditsError,
} from './allocate';

export type { DebitAllocation };
export {
  InsufficientMediaCreditsError,
  allocateDebitAcrossBatches,
  isInsufficientMediaCreditsError,
} from './allocate';

export type MediaCreditSourceType = 'monthly_grant' | 'topup_purchase';

export type MediaCreditBatch = {
  id: string;
  account_id: string;
  source_type: MediaCreditSourceType;
  units_granted: number;
  units_remaining: number;
  granted_at: string;
  expires_at: string;
  swept_at: string | null;
  stripe_event_id: string | null;
  created_at: string;
};

export type DebitResult = {
  debited: number;
  allocations: DebitAllocation[];
};

export type RefundResult = {
  refunded: number;
  reason?: string;
  expired_batch_edge_case?: boolean;
};

function mediaCreditsDb() {
  return getSupabaseServerAdminClient();
}

function parseInsufficientError(
  message: string,
): InsufficientMediaCreditsError | null {
  const match = /INSUFFICIENT_MEDIA_CREDITS:(\d+):(\d+)/.exec(message);
  if (!match) return null;
  return new InsufficientMediaCreditsError({
    balance: Number(match[1]),
    required: Number(match[2]),
  });
}

export async function getMediaBalance(accountId: string): Promise<number> {
  const supabase = mediaCreditsDb();
  await supabase.rpc('ensure_media_credit_pool', {
    p_account_id: accountId,
  });

  const { data, error } = await supabase
    .from('media_credit_pools')
    .select('balance')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Math.max(0, (data as { balance?: number } | null)?.balance ?? 0);
}

export async function debitMediaCredits(
  accountId: string,
  amount: number,
  jobId: string,
): Promise<DebitResult> {
  const supabase = mediaCreditsDb();
  const { data, error } = await supabase.rpc('debit_media_credits', {
    p_account_id: accountId,
    p_amount: amount,
    p_job_id: jobId,
  });

  if (error) {
    const insufficient = parseInsufficientError(error.message);
    if (insufficient) throw insufficient;
    throw new Error(error.message);
  }

  const result = data as DebitResult;
  return {
    debited: result.debited,
    allocations: result.allocations ?? [],
  };
}

export async function refundMediaCredits(
  jobId: string,
  reason?: string,
): Promise<RefundResult> {
  const supabase = mediaCreditsDb();
  const { data, error } = await supabase.rpc('refund_media_credits', {
    p_job_id: jobId,
    p_reason: reason ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as RefundResult;
}

export async function grantMediaCredits(
  accountId: string,
  amount: number,
  sourceType: MediaCreditSourceType,
  expiresAt: Date | string,
  stripeEventId?: string | null,
): Promise<MediaCreditBatch> {
  const supabase = mediaCreditsDb();
  const expiresAtIso =
    typeof expiresAt === 'string' ? expiresAt : expiresAt.toISOString();

  const { data, error } = await supabase.rpc('grant_media_credits', {
    p_account_id: accountId,
    p_amount: amount,
    p_source_type: sourceType,
    p_expires_at: expiresAtIso,
    p_stripe_event_id: stripeEventId ?? null,
  });

  if (error) {
    if (stripeEventId && /unique|duplicate/i.test(error.message)) {
      const { data: existing, error: selectError } = await supabase
        .from('media_credit_batches')
        .select('*')
        .eq('stripe_event_id', stripeEventId)
        .maybeSingle();

      if (selectError) throw new Error(selectError.message);
      if (existing) return existing as MediaCreditBatch;
    }
    throw new Error(error.message);
  }

  return data as MediaCreditBatch;
}

export async function expireStaleBatches(): Promise<number> {
  const supabase = mediaCreditsDb();
  const { data, error } = await supabase.rpc(
    'expire_stale_media_credit_batches',
  );

  if (error) {
    throw new Error(error.message);
  }

  return typeof data === 'number' ? data : Number(data ?? 0);
}

export async function forfeitMediaCreditsOnClosure(
  accountId: string,
): Promise<number> {
  const supabase = mediaCreditsDb();
  const { data, error } = await supabase.rpc(
    'forfeit_media_credits_on_closure',
    { p_account_id: accountId },
  );

  if (error) {
    throw new Error(error.message);
  }

  return typeof data === 'number' ? data : Number(data ?? 0);
}
