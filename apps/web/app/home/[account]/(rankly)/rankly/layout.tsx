import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { redirectIfAddonNotAllowed } from '~/lib/billing/require-addon-access';

type RanklyLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ account: string }>;
};

export default async function RanklyModuleLayout({
  children,
  params,
}: RanklyLayoutProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  await redirectIfAddonNotAllowed(
    account,
    workspace.account.id as string,
    'addon_rankly',
  );

  return children;
}
