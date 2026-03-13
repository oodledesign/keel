import { PageHeader } from '@kit/ui/page';

import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { getTeamAccountAccess } from '../_lib/role-access';
import { TeamAccountQuickCreateMenu } from './team-account-quick-create-menu';
import { TeamAccountNotifications } from './team-account-notifications';

export async function TeamAccountLayoutPageHeader(
  props: React.PropsWithChildren<{
    title: string | React.ReactNode;
    description: string | React.ReactNode;
    account: string;
  }>,
) {
  const workspace = await loadTeamWorkspace(props.account);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  return (
    <PageHeader
      description={props.description}
      title={props.title}
      className="sticky top-0 z-20 border-b border-white/6 bg-[var(--workspace-shell-panel)] px-4 py-4 backdrop-blur-xl lg:px-4"
      displaySidebarTrigger={false}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">{props.children}</div>
        <div className="flex items-center gap-2.5">
          <TeamAccountNotifications
            userId={workspace.user.id}
            accountId={workspace.account.id}
          />
          {access.canUseQuickCreate ? (
            <TeamAccountQuickCreateMenu account={props.account} />
          ) : null}
        </div>
      </div>
    </PageHeader>
  );
}
