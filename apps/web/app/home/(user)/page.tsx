import { Suspense } from 'react';

import { PageBody } from '@kit/ui/page';

import featureFlagsConfig from '~/config/feature-flags.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { DashboardWorkspaceBanner } from './_components/dashboard/dashboard-workspace-banner';
import { OzerDashboard } from './_components/dashboard/ozer-dashboard';
import { DashboardSkeleton } from './_components/dashboard/dashboard-skeleton';
import { loadOzerDashboard } from './_lib/server/ozer-dashboard.loader';
import { loadUserWorkspace } from './_lib/server/load-user-workspace';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('account:homePage');
  return { title };
};

async function DashboardContent() {
  const data = await loadOzerDashboard();
  return <OzerDashboard data={data} />;
}

async function UserHomePage() {
  const userWorkspace = await loadUserWorkspace();
  const teamCount = Array.isArray(userWorkspace.accounts)
    ? userWorkspace.accounts.length
    : 0;
  const showWorkspaceBanner =
    featureFlagsConfig.enableTeamAccounts &&
    teamCount === 0 &&
    featureFlagsConfig.enableTeamCreation;

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)]">
      {showWorkspaceBanner ? (
        <DashboardWorkspaceBanner
          canCreateTeamAccount={userWorkspace.canCreateTeamAccount}
        />
      ) : null}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </PageBody>
  );
}

export default withI18n(UserHomePage);
