'use client';

import { useTeamAccountWorkspace } from '@kit/team-accounts/hooks/use-team-account-workspace';

import { WorkspaceTopBar } from '~/components/workspace-shell/workspace-top-bar';
import { getTeamAccountAccess } from '~/home/[account]/_lib/role-access';
import { spaceTypeFromProfile } from '~/home/[account]/_lib/server/workspace-profile';

export function TeamWorkspaceTopBarClient({ accountSlug }: { accountSlug: string }) {
  const workspace = useTeamAccountWorkspace();
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );
  const spaceType = spaceTypeFromProfile(workspace.workspaceProfile);

  return (
    <WorkspaceTopBar
      variant="team"
      userId={workspace.user.id}
      accountId={workspace.account.id}
      accountSlug={accountSlug}
      spaceType={spaceType}
      showNewMenu={access.canUseQuickCreate}
    />
  );
}
