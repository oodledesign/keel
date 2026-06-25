import { WorkspaceTopBar } from '~/components/workspace-shell/workspace-top-bar';
import { getTeamAccountAccess } from '~/home/[account]/_lib/role-access';
import { spaceTypeFromProfile } from '~/home/[account]/_lib/server/workspace-profile';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';

export async function TeamWorkspaceTopBarSlot(props: { account: string }) {
  const workspace = await loadTeamWorkspace(props.account);
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
      user={workspace.user}
      accountId={workspace.account.id}
      accountSlug={props.account}
      spaceType={spaceType}
      showNewMenu={access.canUseQuickCreate}
    />
  );
}
