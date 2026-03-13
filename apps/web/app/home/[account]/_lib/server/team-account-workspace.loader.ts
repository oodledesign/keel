import 'server-only';

import { cache } from 'react';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export type TeamAccountWorkspace = Awaited<
  ReturnType<typeof loadTeamWorkspace>
>;

/**
 * Load the account workspace data.
 * We place this function into a separate file so it can be reused in multiple places across the server components.
 *
 * This function is used in the layout component for the account workspace.
 * It is cached so that the data is only fetched once per request.
 *
 * @param accountSlug
 */
export const loadTeamWorkspace = cache(workspaceLoader);

async function workspaceLoader(accountSlug: string) {
  const client = getSupabaseServerClient();
  const api = createTeamAccountsApi(client);

  const [workspace, user] = await Promise.all([
    api.getAccountWorkspace(accountSlug),
    requireUserInServerComponent(),
  ]);

  // we cannot find any record for the selected account
  // so we redirect the user to the home page
  if (!workspace.data?.account) {
    return redirect(pathsConfig.app.home);
  }

  const account = workspace.data.account as {
    id: string;
    onboarding_completed?: boolean;
    company_role?: string | null;
    subscription_status?: string | null;
  };
  const onboardingCompleted = account.onboarding_completed !== false;
  const isAdminPersona = account.company_role === 'admin';
  const hasActiveSubscription =
    account.subscription_status === 'active' ||
    account.subscription_status === 'trialing';

  // If onboarding not completed, redirect to onboarding for this account at their current step (saves progress)
  if (!onboardingCompleted) {
    const { data: membership } = await client
      .from('accounts_memberships')
      .select('onboarding_step')
      .eq('account_id', account.id)
      .eq('user_id', user.id)
      .maybeSingle();
    // Never send to step 1 (Create business) when they already have an account
    const step = Math.max(2, membership?.onboarding_step ?? 2);
    redirect(
      `${pathsConfig.app.onboarding}?account_id=${account.id}&step=${step}`,
    );
  }

  // Admin persona must have active subscription to access dashboard
  if (isAdminPersona && !hasActiveSubscription) {
    redirect(
      `${pathsConfig.app.onboarding}?account_id=${account.id}&step=5`,
    );
  }

  return {
    ...workspace.data,
    user,
  };
}
