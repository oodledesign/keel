import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { CampaignCreditPool } from '~/lib/campaigns/campaign.types';

export type { CampaignCreditPool } from '~/lib/campaigns/campaign.types';

export type CampaignCreditSourceType = 'monthly_grant' | 'admin_grant';

export type CampaignCreditBatch = {
  id: string;
  account_id: string;
  source_type: CampaignCreditSourceType;
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
  allocations: Array<{ batch_id: string; amount: number }>;
};

export class InsufficientCampaignCreditsError extends Error {
  readonly balance: number;
  readonly required: number;

  constructor(payload: { balance: number; required: number }) {
    super(
      `Insufficient campaign send units: need ${payload.required}, have ${payload.balance}`,
    );
    this.name = 'InsufficientCampaignCreditsError';
    this.balance = payload.balance;
    this.required = payload.required;
  }
}

export function isInsufficientCampaignCreditsError(
  error: unknown,
): error is InsufficientCampaignCreditsError {
  return error instanceof InsufficientCampaignCreditsError;
}

function db() {
  return getSupabaseServerAdminClient();
}

function fromTable(table: string) {
  // Tables land after typegen; keep the ledger usable before then.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db() as any).from(table);
}

function rpc(name: string, args: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db() as any).rpc(name, args);
}

function parseInsufficientError(
  message: string,
): InsufficientCampaignCreditsError | null {
  const match = /INSUFFICIENT_CAMPAIGN_CREDITS:(\d+):(\d+)/.exec(message);
  if (!match) return null;
  return new InsufficientCampaignCreditsError({
    balance: Number(match[1]),
    required: Number(match[2]),
  });
}

export async function getCampaignUsage(accountId: string): Promise<{
  pool: CampaignCreditPool;
}> {
  await rpc('ensure_campaign_credit_pool', {
    p_account_id: accountId,
  });

  const { data, error } = await fromTable('campaign_credit_pools')
    .select(
      'account_id, balance, monthly_allowance, max_contacts, plan_tier, cycle_start, cycle_end',
    )
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as CampaignCreditPool | null;
  return {
    pool: row ?? {
      account_id: accountId,
      balance: 0,
      monthly_allowance: 0,
      max_contacts: 0,
      plan_tier: 'none',
      cycle_start: null,
      cycle_end: null,
    },
  };
}

export async function debitCampaignCredits(
  accountId: string,
  amount: number,
  campaignId: string,
): Promise<DebitResult> {
  const { data, error } = await rpc('debit_campaign_credits', {
    p_account_id: accountId,
    p_amount: amount,
    p_campaign_id: campaignId,
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

export async function refundCampaignCredits(
  campaignId: string,
  amount: number,
  reason?: string,
): Promise<{ refunded: number }> {
  if (amount <= 0) return { refunded: 0 };

  const { data, error } = await rpc('refund_campaign_credits', {
    p_campaign_id: campaignId,
    p_amount: amount,
    p_reason: reason ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as { refunded: number };
}

export async function grantCampaignCredits(
  accountId: string,
  amount: number,
  sourceType: CampaignCreditSourceType,
  expiresAt: Date | string,
  stripeEventId?: string | null,
): Promise<CampaignCreditBatch> {
  const expiresAtIso =
    typeof expiresAt === 'string' ? expiresAt : expiresAt.toISOString();

  const { data, error } = await rpc('grant_campaign_credits', {
    p_account_id: accountId,
    p_amount: amount,
    p_source_type: sourceType,
    p_expires_at: expiresAtIso,
    p_stripe_event_id: stripeEventId ?? null,
  });

  if (error) {
    if (stripeEventId && /unique|duplicate/i.test(error.message)) {
      const { data: existing, error: selectError } = await fromTable(
        'campaign_credit_batches',
      )
        .select('*')
        .eq('stripe_event_id', stripeEventId)
        .maybeSingle();

      if (selectError) throw new Error(selectError.message);
      if (existing) return existing as CampaignCreditBatch;
    }
    throw new Error(error.message);
  }

  return data as CampaignCreditBatch;
}

export async function updateCampaignCreditPoolMetadata(
  accountId: string,
  values: {
    monthly_allowance: number;
    max_contacts: number;
    plan_tier: string;
    cycle_start: string;
    cycle_end: string;
  },
): Promise<void> {
  await rpc('ensure_campaign_credit_pool', {
    p_account_id: accountId,
  });

  const { error } = await fromTable('campaign_credit_pools')
    .update({
      monthly_allowance: values.monthly_allowance,
      max_contacts: values.max_contacts,
      plan_tier: values.plan_tier,
      cycle_start: values.cycle_start,
      cycle_end: values.cycle_end,
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', accountId);

  if (error) {
    throw new Error(error.message);
  }
}
