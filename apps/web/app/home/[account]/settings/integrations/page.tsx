import { redirect } from 'next/navigation';

import { withI18n } from '~/lib/i18n/with-i18n';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { WorkspaceIntegrationsHome } from './_components/workspace-integrations-home';
import { loadDynamicsConnection } from './_lib/server/dynamics.loader';

interface IntegrationsSettingsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Integrations',
});

async function IntegrationsSettingsPage({
  params,
}: IntegrationsSettingsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const accountAccess = workspace.account as {
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
  };
  const access = getTeamAccountAccess(accountAccess);

  if (!access.canViewSettings) {
    redirect(getDefaultAccountPath(accountSlug, accountAccess));
  }

  const dynamics = await loadDynamicsConnection(workspace.account.id);

  return (
    <WorkspaceIntegrationsHome accountSlug={accountSlug} dynamics={dynamics} />
  );
}

export default withI18n(IntegrationsSettingsPage);
