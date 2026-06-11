import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type AdminDashboardStats = {
  subscriptions: number;
  trials: number;
  accounts: number;
  teamAccounts: number;
  pastDue: number;
};

export const loadAdminDashboardStats = cache(
  async (): Promise<AdminDashboardStats> => {
    const client = getSupabaseServerClient();
    const selectParams = { count: 'exact' as const, head: true };

    const [subscriptions, trials, accounts, teamAccounts, pastDue] = await Promise.all([
      client
        .from('subscriptions')
        .select('*', selectParams)
        .eq('status', 'active')
        .then((r) => r.count ?? 0),
      client
        .from('subscriptions')
        .select('*', selectParams)
        .eq('status', 'trialing')
        .then((r) => r.count ?? 0),
      client
        .from('accounts')
        .select('*', selectParams)
        .eq('is_personal_account', true)
        .then((r) => r.count ?? 0),
      client
        .from('accounts')
        .select('*', selectParams)
        .eq('is_personal_account', false)
        .then((r) => r.count ?? 0),
      client
        .from('subscriptions')
        .select('*', selectParams)
        .in('status', ['past_due', 'unpaid'])
        .then((r) => r.count ?? 0),
    ]);

    return {
      subscriptions,
      trials,
      accounts,
      teamAccounts,
      pastDue,
    };
  },
);
