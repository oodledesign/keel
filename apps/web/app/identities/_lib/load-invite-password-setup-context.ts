import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import {
  DEFAULT_WORKSPACE_NAMES,
  parseAdminUserInviteAccessConfig,
} from '~/lib/admin/user-invites.schema';
import { loadAdminUserInviteByToken } from '~/lib/admin/user-invites.service';

export type InvitePasswordSetupContext = {
  firstName: string | null;
  workspaceName: string | null;
  /** True when joining one or more named workspaces (vs personal-only). */
  hasWorkspaceInvite: boolean;
};

function firstNameFrom(value: string | null | undefined): string | null {
  const first = value?.trim().split(/\s+/).filter(Boolean)[0];
  return first || null;
}

/**
 * Resolve greeting context for the /identities password setup step.
 * Supports super-admin user invites and team workspace invitations.
 */
export async function loadInvitePasswordSetupContext(input: {
  inviteToken?: string | null;
  inviteKind?: string | null;
  fallbackName?: string | null;
}): Promise<InvitePasswordSetupContext> {
  const fallbackFirstName = firstNameFrom(input.fallbackName);
  const token = input.inviteToken?.trim();

  if (!token) {
    return {
      firstName: fallbackFirstName,
      workspaceName: null,
      hasWorkspaceInvite: false,
    };
  }

  const kind = input.inviteKind === 'team' ? 'team' : 'admin';
  const admin = getSupabaseServerAdminClient();

  if (kind === 'team') {
    const client = getSupabaseServerClient();
    const api = createTeamAccountsApi(client);
    const invitation = await api.getInvitation(admin, token);

    return {
      firstName: fallbackFirstName,
      workspaceName: invitation?.account.name?.trim() || null,
      hasWorkspaceInvite: Boolean(invitation?.account.name?.trim()),
    };
  }

  const invite = await loadAdminUserInviteByToken(admin, token);
  if (!invite) {
    return {
      firstName: fallbackFirstName,
      workspaceName: null,
      hasWorkspaceInvite: false,
    };
  }

  const config = parseAdminUserInviteAccessConfig(invite.access_config);
  const firstName = firstNameFrom(config.inviteeName) ?? fallbackFirstName;

  if (config.personalOnly) {
    return {
      firstName,
      workspaceName: null,
      hasWorkspaceInvite: false,
    };
  }

  const workspaceNames = (config.workspaces ?? [])
    .map(
      (workspace) =>
        workspace.name?.trim() || DEFAULT_WORKSPACE_NAMES[workspace.profile],
    )
    .filter(Boolean);

  if (workspaceNames.length === 0) {
    return {
      firstName,
      workspaceName: null,
      hasWorkspaceInvite: false,
    };
  }

  if (workspaceNames.length === 1) {
    return {
      firstName,
      workspaceName: workspaceNames[0]!,
      hasWorkspaceInvite: true,
    };
  }

  return {
    firstName,
    workspaceName: workspaceNames.join(', '),
    hasWorkspaceInvite: true,
  };
}
