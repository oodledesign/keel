import { cache } from 'react';

import { redirect } from 'next/navigation';

import { createAccountsApi } from '@kit/accounts/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createAccountCreationPolicyEvaluator } from '@kit/team-accounts/policies';

import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

const shouldLoadAccounts = featureFlagsConfig.enableTeamAccounts;

export type UserWorkspace = Awaited<ReturnType<typeof loadUserWorkspace>>;

/**
 * @name loadUserWorkspace
 * @description
 * Load the user workspace data. It's a cached per-request function that fetches the user workspace data.
 * It can be used across the server components to load the user workspace data.
 */
export const loadUserWorkspace = cache(workspaceLoader);

async function workspaceLoader() {
  const client = getSupabaseServerClient();
  const api = createAccountsApi(client);

  const user = await requireUserInServerComponent();

  let accounts: Awaited<ReturnType<typeof api.loadUserAccounts>> | [] = [];
  let workspace: Awaited<
    ReturnType<typeof api.getAccountWorkspace>
  > | null = null;

  if (shouldLoadAccounts) {
    try {
      accounts = await api.loadUserAccounts();
    } catch {
      accounts = [];
    }
  }

  try {
    workspace = await api.getAccountWorkspace();
  } catch {
    workspace = null;
  }

  // If the user is not found, redirect home – but don't block on missing workspace
  if (!user) {
    redirect('/');
  }

  // If user has at least one completed team, send them to /home (they can continue incomplete onboarding from there if needed).
  // Only redirect to onboarding when they have zero completed teams and either in-progress or no accounts.
  if (shouldLoadAccounts) {
    const { data: hasCompleted } = await client
      .from('accounts_memberships')
      .select('account_id')
      .eq('user_id', user.id)
      .eq('onboarding_completed', true)
      .limit(1)
      .maybeSingle();
    if (hasCompleted?.account_id) {
      // User has a completed team — do not redirect to onboarding; let them land on /home
    } else {
      const { data: incomplete } = await client
        .from('accounts_memberships')
        .select('account_id, onboarding_step')
        .eq('user_id', user.id)
        .eq('onboarding_completed', false)
        .limit(1)
        .maybeSingle();
      if (incomplete?.account_id) {
        const step = Math.max(2, incomplete.onboarding_step ?? 2);
        redirect(
          `${pathsConfig.app.onboarding}?account_id=${incomplete.account_id}&step=${step}`,
        );
      }
      if (Array.isArray(accounts) && accounts.length === 0) {
        redirect(pathsConfig.app.onboarding);
      }
    }
    // Single-team redirect is done only on the root /home page (see (user)/page.tsx), not here,
    // so that /home/settings and other personal routes remain accessible.
  }

  // Check if user can create team accounts (policy check)
  const canCreateTeamAccount = shouldLoadAccounts
    ? await checkCanCreateTeamAccount(user.id)
    : { allowed: false, reason: undefined };

  return {
    accounts,
    workspace,
    user,
    canCreateTeamAccount,
  };
}

/**
 * Check if the user can create a team account based on policies.
 * Preliminary checks run without account name - name validation happens during submission.
 */
async function checkCanCreateTeamAccount(userId: string) {
  const evaluator = createAccountCreationPolicyEvaluator();
  const hasPolicies = await evaluator.hasPoliciesForStage('preliminary');

  if (!hasPolicies) {
    return { allowed: true, reason: undefined };
  }

  const context = {
    timestamp: new Date().toISOString(),
    userId,
    accountName: '',
  };

  const result = await evaluator.canCreateAccount(context, 'preliminary');

  return {
    allowed: result.allowed,
    reason: result.reasons[0],
  };
}
