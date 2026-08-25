import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type Stripe from 'stripe';

import { getLogger } from '@kit/shared/logger';

import type { Database } from '~/lib/database.types';

import { getRewardsStripeClient } from './stripe-client';

type AdminClient = SupabaseClient<Database>;

export type ApplyBalanceCreditParams = {
  admin: AdminClient;
  userId: string;
  amountPence: number;
  source: 'referral' | 'content';
  description: string;
  sourceReferralId?: string;
  sourceContentSubmissionId?: string;
  metadata?: Record<string, string>;
  stripe?: Stripe;
};

export async function applyStripeCustomerBalanceCredit(
  params: ApplyBalanceCreditParams,
): Promise<{ applied: boolean; stripeBalanceTransactionId?: string }> {
  const logger = await getLogger();
  const stripe = params.stripe ?? getRewardsStripeClient();
  const { resolveRewardStripeCustomer } =
    await import('./resolve-reward-stripe-customer');

  if (params.amountPence <= 0) {
    return { applied: false };
  }

  const idempotencyKey = params.sourceReferralId
    ? `referral:${params.sourceReferralId}:${params.metadata?.kind ?? 'default'}`
    : params.sourceContentSubmissionId
      ? `content:${params.sourceContentSubmissionId}`
      : `manual:${params.userId}:${Date.now()}`;

  const { data: existingLog } = await params.admin
    .from('balance_transactions_log')
    .select('stripe_balance_transaction_id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existingLog?.stripe_balance_transaction_id) {
    return {
      applied: false,
      stripeBalanceTransactionId: existingLog.stripe_balance_transaction_id,
    };
  }

  const { targetAccountId, stripeCustomerId } =
    await resolveRewardStripeCustomer({
      admin: params.admin,
      userId: params.userId,
      stripe,
    });

  const logMetadata = {
    ...(params.metadata ?? {}),
    idempotencyKey,
  };

  const pendingStripeId = `pending:${idempotencyKey}`;

  const { error: reserveError } = await params.admin
    .from('balance_transactions_log')
    .insert({
      user_id: params.userId,
      target_account_id: targetAccountId,
      stripe_customer_id: stripeCustomerId,
      stripe_balance_transaction_id: pendingStripeId,
      amount_pence: params.amountPence,
      currency: 'gbp',
      source: params.source,
      source_referral_id: params.sourceReferralId ?? null,
      source_content_submission_id: params.sourceContentSubmissionId ?? null,
      metadata: logMetadata,
      idempotency_key: idempotencyKey,
    });

  if (reserveError) {
    if (reserveError.code === '23505') {
      const { data: raced } = await params.admin
        .from('balance_transactions_log')
        .select('stripe_balance_transaction_id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      return {
        applied: false,
        stripeBalanceTransactionId: raced?.stripe_balance_transaction_id,
      };
    }

    throw new Error(
      `Failed to reserve balance transaction log: ${reserveError.message}`,
    );
  }

  const balanceTx = await stripe.customers.createBalanceTransaction(
    stripeCustomerId,
    {
      amount: -params.amountPence,
      currency: 'gbp',
      description: params.description,
      metadata: {
        source: params.source,
        userId: params.userId,
        accountId: targetAccountId,
        idempotencyKey,
        ...(params.sourceReferralId
          ? { referralId: params.sourceReferralId }
          : {}),
        ...(params.sourceContentSubmissionId
          ? { contentSubmissionId: params.sourceContentSubmissionId }
          : {}),
        ...(params.metadata ?? {}),
      },
    },
  );

  const { error: finalizeError } = await params.admin
    .from('balance_transactions_log')
    .update({
      stripe_balance_transaction_id: balanceTx.id,
    })
    .eq('idempotency_key', idempotencyKey);

  if (finalizeError) {
    logger.error(
      { error: finalizeError, balanceTxId: balanceTx.id, idempotencyKey },
      '[rewards] failed to finalize balance_transactions_log',
    );
    throw new Error(finalizeError.message);
  }

  return { applied: true, stripeBalanceTransactionId: balanceTx.id };
}
