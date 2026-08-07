import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type ClientCreditSourceType =
  | 'retainer_grant'
  | 'topup_purchase'
  | 'manual_adjustment';

export type GrantClientCreditsResult = {
  ok: boolean;
  batch_id?: string;
  granted?: number;
  expires_at?: string | null;
  idempotent?: boolean;
  error?: string;
};

export type ConsumeClientCreditsResult = {
  ok: boolean;
  consumed?: number;
  allocations?: Array<{ batch_id: string; amount: number }>;
  error?: 'insufficient_balance' | string;
  available?: number;
  requested?: number;
};

function adminDb() {
  return getSupabaseServerAdminClient() as any;
}

export async function grantClientCredits(input: {
  clientOrgId: string;
  accountId: string;
  amount: number;
  sourceType: ClientCreditSourceType;
  expiresAt?: Date | string | null;
  relatedInvoiceId?: string | null;
}): Promise<GrantClientCreditsResult> {
  const { data, error } = await adminDb().rpc('grant_client_credits', {
    p_client_org_id: input.clientOrgId,
    p_account_id: input.accountId,
    p_amount: input.amount,
    p_source_type: input.sourceType,
    p_expires_at: input.expiresAt
      ? typeof input.expiresAt === 'string'
        ? input.expiresAt
        : input.expiresAt.toISOString()
      : null,
    p_related_invoice_id: input.relatedInvoiceId ?? null,
  });

  if (error) {
    throw new Error(error.message || 'grant_client_credits failed');
  }

  return (data ?? {
    ok: false,
    error: 'empty_response',
  }) as GrantClientCreditsResult;
}

export async function consumeClientCredits(input: {
  clientOrgId: string;
  amount: number;
  relatedTicketId?: string | null;
  actorId?: string | null;
}): Promise<ConsumeClientCreditsResult> {
  const { data, error } = await adminDb().rpc('consume_client_credits', {
    p_client_org_id: input.clientOrgId,
    p_amount: input.amount,
    p_related_ticket_id: input.relatedTicketId ?? null,
    p_actor_id: input.actorId ?? null,
  });

  if (error) {
    throw new Error(error.message || 'consume_client_credits failed');
  }

  return (data ?? {
    ok: false,
    error: 'empty_response',
  }) as ConsumeClientCreditsResult;
}

export async function refundClientCredits(input: {
  relatedTicketId: string;
  actorId?: string | null;
  reason?: string | null;
}): Promise<{ ok: boolean; refunded: number; reason?: string }> {
  const { data, error } = await adminDb().rpc('refund_client_credits', {
    p_related_ticket_id: input.relatedTicketId,
    p_actor_id: input.actorId ?? null,
    p_reason: input.reason ?? null,
  });

  if (error) {
    throw new Error(error.message || 'refund_client_credits failed');
  }

  return (data ?? { ok: false, refunded: 0 }) as {
    ok: boolean;
    refunded: number;
    reason?: string;
  };
}

export async function clampClientCreditBalance(input: {
  clientOrgId: string;
  cap: number;
}): Promise<number> {
  const { data, error } = await adminDb().rpc('clamp_client_credit_balance', {
    p_client_org_id: input.clientOrgId,
    p_cap: input.cap,
  });

  if (error) {
    throw new Error(error.message || 'clamp_client_credit_balance failed');
  }

  return Number(data ?? 0);
}
