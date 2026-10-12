'use client';

import { useTeamAccountWorkspace } from '@kit/team-accounts/hooks/use-team-account-workspace';

import { WorkspaceTopBar } from '~/components/workspace-shell/workspace-top-bar';
import { getTeamAccountAccess } from '~/home/[account]/_lib/role-access';
import {
  type WorkspaceProfile,
  spaceTypeFromProfile,
} from '~/home/[account]/_lib/workspace-profile';

type TeamShellWorkspace = ReturnType<typeof useTeamAccountWorkspace> & {
  workspaceProfile: WorkspaceProfile;
  canMutateCommercial?: boolean;
};

export function TeamWorkspaceTopBarClient({
  accountSlug,
}: {
  accountSlug: string;
}) {
  // The team layout provides the full `loadTeamWorkspace` result, which extends the kit context type.
  const workspace = useTeamAccountWorkspace() as TeamShellWorkspace;
  const access = getTeamAccountAccess(workspace.account);
  const spaceType = spaceTypeFromProfile(workspace.workspaceProfile);
  const canMutateCommercial = workspace.canMutateCommercial ?? true;

  return (
    <WorkspaceTopBar
      variant="team"
      userId={workspace.user.id}
      user={workspace.user}
      accountId={workspace.account.id}
      accountSlug={accountSlug}
      spaceType={spaceType}
      showNewMenu={access.canUseQuickCreate}
      canMutateCommercial={canMutateCommercial}
    />
  );
}
