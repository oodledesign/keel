import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../_lib/role-access';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import {
  getSpaceTypeFromAccount,
  isPropertyNavModuleEnabled,
  isWorkNavModuleEnabled,
} from '../_lib/server/account-modules';

interface FinancesPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Finances',
});

async function FinancesPage({ params }: FinancesPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(
    workspace,
    accountSlug,
    BUSINESS_WORKSPACE_SPACE_TYPES,
  );

  const spaceType = getSpaceTypeFromAccount(
    workspace.account as { space_type?: string | null },
  );

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

  if (!access.canViewDashboard || !financesEnabled) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Finances"
        description="Revenue, expenses, and financial overview."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-8 text-white lg:px-8">
        <p className="max-w-xl text-sm text-zinc-400">
          Finances overview is coming soon. Use Invoices for billing in the
          meantime.
        </p>
      </PageBody>
    </>
  );
}

export default withI18n(FinancesPage);
