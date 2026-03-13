import { Suspense } from 'react';

import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadKeelDashboard } from './_lib/server/keel-dashboard.loader';
import { KeelDashboard } from './_components/dashboard/keel-dashboard';
import { DashboardSkeleton } from './_components/dashboard/dashboard-skeleton';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('account:homePage');
  return { title };
};

async function DashboardContent() {
  const data = await loadKeelDashboard();
  return <KeelDashboard data={data} />;
}

async function UserHomePage() {
  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)]">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </PageBody>
  );
}

export default withI18n(UserHomePage);
