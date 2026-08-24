import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  REWARDS_CONFIG,
  contentTierRewardPence,
  getReferralLink,
} from '~/config/rewards.config';
import { ensureUserReferralCodeAsUser } from '~/lib/rewards/ensure-referral-code';

export async function loadRewardsSettingsData(userId: string) {
  const client = getSupabaseServerClient();

  const referralCode = await ensureUserReferralCodeAsUser(client, userId);

  const [
    { data: settings },
    { data: referrals },
    { data: balanceLogs },
    { data: submissions },
    { data: memberships },
  ] = await Promise.all([
    client
      .from('user_settings')
      .select('reward_credit_target, reward_credit_workspace_id')
      .eq('user_id', userId)
      .maybeSingle(),
    client
      .from('referrals')
      .select(
        'id, status, utm_source, created_at, converted_at, referred_user_id',
      )
      .eq('referrer_user_id', userId)
      .order('created_at', { ascending: false }),
    client
      .from('balance_transactions_log')
      .select('amount_pence, source, created_at')
      .eq('user_id', userId)
      .eq('source', 'referral'),
    client
      .from('content_submissions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    client
      .from('accounts_memberships')
      .select('account_id, accounts!inner(id, name, slug, is_personal_account)')
      .eq('user_id', userId),
  ]);

  const referredUserIds = (referrals ?? []).map((r) => r.referred_user_id);
  const referredEmails = new Map<string, string>();

  if (referredUserIds.length > 0) {
    const { data: referredAccounts } = await client
      .from('accounts')
      .select('id, email')
      .in('id', referredUserIds);

    for (const row of referredAccounts ?? []) {
      if (row.email) {
        referredEmails.set(row.id, row.email);
      }
    }
  }

  const workspaces = (memberships ?? [])
    .map((m) => {
      const account = m.accounts as {
        id: string;
        name: string;
        slug: string | null;
        is_personal_account: boolean;
      } | null;
      if (!account || account.is_personal_account) return null;
      return {
        id: account.id,
        name: account.name,
        slug: account.slug,
      };
    })
    .filter(Boolean) as Array<{ id: string; name: string; slug: string | null }>;

  const totalReferralCreditPence = (balanceLogs ?? []).reduce(
    (sum, row) => sum + (row.amount_pence ?? 0),
    0,
  );

  const { data: monthUsed } = await client.rpc('content_reward_used_month_pence', {
    p_user_id: userId,
  });

  const { data: yearUsed } = await client.rpc('content_reward_used_year_pence', {
    p_user_id: userId,
  });

  return {
    referralCode,
    referralLink: getReferralLink(referralCode),
    rewardCreditTarget: settings?.reward_credit_target ?? 'personal',
    rewardCreditWorkspaceId: settings?.reward_credit_workspace_id ?? null,
    workspaces,
    referrals: (referrals ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      utmSource: r.utm_source,
      createdAt: r.created_at,
      convertedAt: r.converted_at,
      referredEmail: referredEmails.get(r.referred_user_id) ?? null,
    })),
    totalReferralCreditPence,
    contentSubmissions: submissions ?? [],
    contentCaps: {
      monthlyUsedPence: monthUsed ?? 0,
      monthlyCapPence: REWARDS_CONFIG.contentMonthlyCapPence,
      annualUsedPence: yearUsed ?? 0,
      annualCapPence: REWARDS_CONFIG.contentAnnualCapPence,
    },
    contentTiersPence: REWARDS_CONFIG.contentTiersPence,
  };
}

export { contentTierRewardPence, REWARDS_CONFIG };
