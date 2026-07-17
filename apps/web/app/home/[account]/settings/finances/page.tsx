import { Suspense } from 'react';

import { redirect } from 'next/navigation';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import {
  isPropertyNavModuleEnabled,
  isWorkNavModuleEnabled,
} from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';
import { spaceTypeFromProfile } from '../../_lib/workspace-profile';
import { loadFinancesSettingsAction } from '../../finances/_lib/server/finances-actions';
import { FinancesSettingsPanel } from './_components/finances-settings-panel';

export const generateMetadata = async () => ({ title: 'Finances settings' });

interface FinancesSettingsPageProps {
  params: Promise<{ account: string }>;
}

export default async function FinancesSettingsPage(
  props: FinancesSettingsPageProps,
) {
  const { account } = await props.params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, BUSINESS_WORKSPACE_SPACE_TYPES);

  const spaceType = spaceTypeFromProfile(workspace.workspaceProfile);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  const financesEnabled =
    spaceType === 'property'
      ? isPropertyNavModuleEnabled(workspace.moduleSettings, 'finances')
      : isWorkNavModuleEnabled(workspace.moduleSettings, 'finances');

  if (!access.canViewSettings || !financesEnabled) {
    redirect(getDefaultAccountPath(account, workspace.account));
  }

  const accountId = workspace.account.id as string;
  const initialData = await loadFinancesSettingsAction({ accountId });

  return (
    <Suspense fallback={null}>
      <FinancesSettingsPanel
        accountId={accountId}
        accountSlug={account}
        initialData={initialData}
      />
    </Suspense>
  );
}
