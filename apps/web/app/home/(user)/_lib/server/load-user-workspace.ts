import { cache } from 'react';

import { redirect } from 'next/navigation';

import { createAccountsApi } from '@kit/accounts/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createAccountCreationPolicyEvaluator } from '@kit/team-accounts/policies';

import featureFlagsConfig from '~/config/feature-flags.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

const shouldLoadAccounts = featureFlagsConfig.enableTeamAccounts;

export type UserWorkspace = Awaited<ReturnType<typeof loadUserWorkspace>>;

type TeamAccountOption = {
  label: string;
  value: string;
  image: string | null;
};

/**
 * When `user_accounts` returns nothing (view/RLS drift) but the user is still a
 * member of team accounts, load slugs from `accounts_memberships` + `accounts`.
 */
async function loadTeamAccountsFromMemberships(
  client: ReturnType<typeof getSupabaseServerClient>,
  userId: string,
): Promise<TeamAccountOption[]> {
  const { data: memberships, error: memErr } = await client
    .from('accounts_memberships')
    .select('account_id')
    .eq('user_id', userId);

  if (memErr) {
    console.error(
      '[loadUserWorkspace] loadTeamAccountsFromMemberships memberships:',
      memErr.message,
    );
    return [];
  }

  const ids = [
    ...new Set(
      (memberships ?? [])
        .map((m: { account_id: string }) => m.account_id)
        .filter(Boolean),
    ),
  ];

  if (ids.length === 0) {
    return [];
  }

  const { data: rows, error: accErr } = await client
    .from('accounts')
    .select('id, name, slug, picture_url, is_personal_account')
    .in('id', ids)
    .eq('is_personal_account', false);

  if (accErr) {
    console.error(
      '[loadUserWorkspace] loadTeamAccountsFromMemberships accounts:',
      accErr.message,
    );
    return [];
  }

  const seen = new Set<string>();
  const out: TeamAccountOption[] = [];

  for (const row of rows ?? []) {
    const r = row as {
      name: string | null;
      slug: string | null;
      picture_url: string | null;
      is_personal_account: boolean | null;
    };
    if (r.is_personal_account) continue;
    const slug = r.slug?.trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({
      label: r.name?.trim() || slug,
      value: slug,
      image: r.picture_url ?? null,
    });
  }

  return out;
}

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
  let workspace: Awaited<ReturnType<typeof api.getAccountWorkspace>> | null =
    null;

  if (shouldLoadAccounts) {
    try {
      accounts = await api.loadUserAccounts();
    } catch (err) {
      console.error(
        '[loadUserWorkspace] loadUserAccounts failed:',
        err instanceof Error ? err.message : err,
      );
      accounts = [];
    }

    accounts = (Array.isArray(accounts) ? accounts : []).filter(
      (a): a is { label: string; value: string; image: string | null } =>
        typeof a.value === 'string' && a.value.length > 0,
    );

    if (accounts.length === 0) {
      accounts = await loadTeamAccountsFromMemberships(client, user.id);
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

  // Onboarding is optional: users reach /home without being sent to /onboarding (create workspaces from the dashboard).

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
