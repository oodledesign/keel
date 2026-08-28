import 'server-only';

import { cache } from 'react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { loadUserTeamMemberships } from '~/home/_lib/server/user-team-memberships.loader';

/**
 * True when the user still needs the initial /setup flow (create a workspace).
 * Skip when they already belong to a team, explicitly continued personal-only,
 * or only need guest / client-portal access.
 */
export const userRequiresWorkspaceSetup = cache(
  async (userId: string): Promise<boolean> => {
    const client = getSupabaseServerClient();
    const teamMemberships = await loadUserTeamMemberships(userId, client);

    // Already on a team (invite or create). /setup is only for people with no
    // team yet — incomplete per-workspace onboarding is handled by /onboarding.
    // (Previously commercial invitees could get stuck here when businesses /
    // entitlement checks failed under RLS.)
    if (teamMemberships.length > 0) {
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

    // Client portal contacts only need access to their portal(s) — don't
    // force them through workspace creation either.
    const { data: portalRow } = await admin
      .from('client_members')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (portalRow) {
      return false;
    }

    return true;
  },
);

export function workspaceSetupPath(): string {
  return pathsConfig.app.workspaceSetup;
}
