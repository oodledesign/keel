import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../_lib/server/workspace-route-guard';
import { redirectIfAddonNotAllowed } from '~/lib/billing/require-addon-access';

type FeedflowLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ account: string }>;
};

export default async function FeedflowModuleLayout({
  children,
  params,
}: FeedflowLayoutProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  redirectIfAddonNotAllowed(
    account,
    workspace.account.id as string,
    'addon_feedflow',
  );

  return children;
}
