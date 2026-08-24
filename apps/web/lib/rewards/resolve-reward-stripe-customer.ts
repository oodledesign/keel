import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import Stripe from 'stripe';

import { getLogger } from '@kit/shared/logger';

import type { Database } from '~/lib/database.types';

import { getRewardsStripeClient } from './stripe-client';

type AdminClient = SupabaseClient<Database>;

export type RewardCreditTarget = {
  targetAccountId: string;
  rewardCreditTarget: 'personal' | 'workspace';
};

export async function loadRewardCreditTarget(
  admin: AdminClient,
  userId: string,
): Promise<RewardCreditTarget> {
  const { data: settings, error } = await admin
    .from('user_settings')
    .select('reward_credit_target, reward_credit_workspace_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load reward credit target: ${error.message}`);
  }

  const target = settings?.reward_credit_target ?? 'personal';

  if (target === 'workspace' && settings?.reward_credit_workspace_id) {
    const workspaceId = settings.reward_credit_workspace_id;
    const { data: membership } = await admin
      .from('accounts_memberships')
      .select('account_id')
      .eq('account_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();

    const { data: account } = await admin
      .from('accounts')
      .select('primary_owner_user_id, is_personal_account')
      .eq('id', workspaceId)
      .maybeSingle();

    const isOwner = account?.primary_owner_user_id === userId;
    if (!membership && !isOwner) {
      return { targetAccountId: userId, rewardCreditTarget: 'personal' };
    }

    return {
      targetAccountId: workspaceId,
      rewardCreditTarget: 'workspace',
    };
  }

  return { targetAccountId: userId, rewardCreditTarget: 'personal' };
}

export async function resolveRewardStripeCustomer(params: {
  admin: AdminClient;
  userId: string;
  stripe?: Stripe;
}): Promise<{
  targetAccountId: string;
  stripeCustomerId: string;
  customerEmail: string | null;
}> {
  const { admin, userId } = params;
  const stripe = params.stripe ?? getRewardsStripeClient();
  const logger = await getLogger();

  const { targetAccountId } = await loadRewardCreditTarget(admin, userId);

  const { data: existingCustomer } = await admin
    .from('billing_customers')
    .select('customer_id')
    .eq('account_id', targetAccountId)
    .eq('provider', 'stripe')
    .maybeSingle();

  if (existingCustomer?.customer_id) {
    return {
      targetAccountId,
      stripeCustomerId: existingCustomer.customer_id,
      customerEmail: null,
    };
  }

  const [{ data: account }, { data: authUser }] = await Promise.all([
    admin
      .from('accounts')
      .select('email, name')
      .eq('id', targetAccountId)
      .maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);

  const email = account?.email ?? authUser.user?.email ?? undefined;
  const name = account?.name ?? undefined;

  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: {
      accountId: targetAccountId,
      rewardCreditUserId: userId,
    },
  });

  const { error: insertError } = await admin.from('billing_customers').insert({
    account_id: targetAccountId,
    customer_id: customer.id,
    provider: 'stripe',
    email: email ?? null,
  });

  if (insertError) {
    logger.warn(
      { error: insertError, targetAccountId, customerId: customer.id },
      '[rewards] billing_customers insert failed (may already exist)',
    );

    const { data: racedCustomer } = await admin
      .from('billing_customers')
      .select('customer_id')
      .eq('account_id', targetAccountId)
      .eq('provider', 'stripe')
      .maybeSingle();

    if (racedCustomer?.customer_id) {
      return {
        targetAccountId,
        stripeCustomerId: racedCustomer.customer_id,
        customerEmail: email ?? null,
      };
    }
  }

  return {
    targetAccountId,
    stripeCustomerId: customer.id,
    customerEmail: email ?? null,
  };
}
