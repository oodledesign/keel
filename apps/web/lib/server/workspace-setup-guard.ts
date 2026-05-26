import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

/**
 * True when the user still needs the initial /setup flow.
 * Requires at least one team workspace with onboarding_completed = true
 * (duplicate workspaces from failed retries must not force another trip to /setup).
 */
export const userRequiresWorkspaceSetup = cache(
  async (userId: string): Promise<boolean> => {
    const client = getSupabaseServerClient();

    const { data, error } = await client
      .from('accounts_memberships')
      .select(
        'onboarding_completed, account:accounts!inner(id, is_personal_account)',
      )
      .eq('user_id', userId);

    if (error) {
      console.error('[workspace-setup-guard]', error.message);
      return false;
    }

    const rows = (data ?? []) as Array<{
      onboarding_completed?: boolean | null;
      account: { id: string; is_personal_account: boolean | null } | null;
    }>;

    const teamMemberships = rows.filter(
      (r) => r.account && r.account.is_personal_account !== true,
    );

    if (teamMemberships.length === 0) {
      return true;
    }

    if (teamMemberships.some((r) => r.onboarding_completed === true)) {
      return false;
    }

    const teamAccountIds = teamMemberships
      .map((r) => r.account?.id)
      .filter((id): id is string => Boolean(id));

    if (teamAccountIds.length === 0) {
      return true;
    }

    // Workspaces created before onboarding_completed was wired still have businesses.
    const { data: businessRow, error: businessError } = await client
      .from('businesses')
      .select('id')
      .in('account_id', teamAccountIds)
      .limit(1)
      .maybeSingle();

    if (businessError) {
      console.error('[workspace-setup-guard] businesses:', businessError.message);
      return true;
    }

    return !businessRow;
  },
);

export function workspaceSetupPath(): string {
  return pathsConfig.app.workspaceSetup;
}
