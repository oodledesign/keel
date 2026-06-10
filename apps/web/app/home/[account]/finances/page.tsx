import { Suspense } from 'react';
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
import { FinancesPageContent } from './_components/finances-page-content';
import { FinancesDashboardSkeleton } from './_components/finances-dashboard-skeleton';

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

  const accountId = workspace.account.id as string;

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Finances"
        description="Income, expenses, forecasts, and bank imports — with optional FreeAgent sync."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-white">
        <Suspense fallback={<FinancesDashboardSkeleton />}>
          <FinancesPageContent accountId={accountId} accountSlug={accountSlug} />
        </Suspense>
      </PageBody>
    </>
  );
}

export default withI18n(FinancesPage);
