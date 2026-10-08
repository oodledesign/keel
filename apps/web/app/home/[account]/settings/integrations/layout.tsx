import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { canUseWorkspaceIntegrations } from '../_lib/workspace-settings-nav';

type Props = React.PropsWithChildren<{
  params: Promise<{ account: string }>;
}>;

export default async function IntegrationsSettingsLayout({
  children,
  params,
}: Props) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);

  if (
    !canUseWorkspaceIntegrations(
      workspace.workspaceProfile,
      workspace.moduleSettings,
    )
  ) {
    redirect(pathsConfig.app.accountSettings.replace('[account]', account));
  }

  return children;
}
