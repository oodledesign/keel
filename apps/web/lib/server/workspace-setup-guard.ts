import 'server-only';

import { cache } from 'react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { loadUserTeamMemberships } from '~/home/_lib/server/user-team-memberships.loader';

/**
 * True when the user still needs the initial /setup flow.
 * Requires at least one team workspace with onboarding_completed = true
 * (duplicate workspaces from failed retries must not force another trip to /setup).
 *
 * Project guests and users who explicitly continue with personal-only can skip.
 */
export const userRequiresWorkspaceSetup = cache(
  async (userId: string): Promise<boolean> => {
    const client = getSupabaseServerClient();
    const teamMemberships = await loadUserTeamMemberships(userId, client);

    if (teamMemberships.some((row) => row.onboarding_completed === true)) {
      return false;
    }

    const { data: settings } = await client
      .from('user_settings')
      .select('workspace_setup_skipped_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (
      (settings as { workspace_setup_skipped_at?: string | null } | null)
        ?.workspace_setup_skipped_at
    ) {
      return false;
    }

    // Project guests only need personal access — don't force workspace creation.
    const admin = getSupabaseServerAdminClient();
    const { data: guestRow } = await admin
      .from('project_guests')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle();

    if (guestRow) {
      return false;
    }

    if (teamMemberships.length === 0) {
      return true;
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
      console.error(
        '[workspace-setup-guard] businesses:',
        businessError.message,
      );
      return true;
    }

    return !businessRow;
  },
);

export function workspaceSetupPath(): string {
  return pathsConfig.app.workspaceSetup;
}
