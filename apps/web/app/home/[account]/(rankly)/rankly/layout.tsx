import { redirectIfAddonNotAllowed } from '~/lib/billing/require-addon-access';

import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';

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
  redirectIfSpaceNotIn(workspace, account, ADDON_APPS_SPACE_TYPES);

  await redirectIfAddonNotAllowed(
    account,
    workspace.account.id as string,
    'addon_rankly',
  );

  return children;
}
