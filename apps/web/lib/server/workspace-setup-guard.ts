import 'server-only';

import { cache } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import { loadUserTeamMemberships } from '~/home/_lib/server/user-team-memberships.loader';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * True when the user still needs the initial /setup flow.
 * Requires at least one team workspace with onboarding_completed = true
 * (duplicate workspaces from failed retries must not force another trip to /setup).
 */
export const userRequiresWorkspaceSetup = cache(
  async (userId: string): Promise<boolean> => {
    const client = getSupabaseServerClient();
    const teamMemberships = await loadUserTeamMemberships(userId, client);

    if (teamMemberships.length === 0) {
      return true;
    }

    if (teamMemberships.some((row) => row.onboarding_completed === true)) {
      return false;
    }

    const teamAccountIds = teamMemberships.map((row) => row.id);

    const now = new Date().toISOString();
    const [{ data: entitled }, { data: billingExempt }] = await Promise.all([
      client
        .from('account_entitlements')
        .select('id')
        .in('account_id', teamAccountIds)
        .in('entitlement_key', [
          'workspace_business',
          'workspace_business_lite',
          'workspace_property',
          'workspace_community',
        ])
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .limit(1)
        .maybeSingle(),
      client
        .from('account_billing_exempt')
        .select('account_id')
        .in('account_id', teamAccountIds)
        .limit(1)
        .maybeSingle(),
    ]);

    if (entitled || billingExempt) {
      return false;
    }

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
