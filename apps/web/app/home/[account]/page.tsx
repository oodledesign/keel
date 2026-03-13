import { use } from 'react';

import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { DashboardPageContent } from './_components/dashboard-page-content';
import { TeamAccountLayoutPageHeader } from './_components/team-account-layout-page-header';
import { loadDashboardPageData } from './_lib/server/dashboard-page.loader';
import { getDefaultAccountPath, getTeamAccountAccess } from './_lib/role-access';
import { loadTeamWorkspace } from './_lib/server/team-account-workspace.loader';

interface TeamAccountHomePageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:home.pageTitle');

  return {
    title,
  };
};

function TeamAccountHomePage({ params }: TeamAccountHomePageProps) {
  const { account } = use(params);
  const workspace = use(loadTeamWorkspace(account));
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewDashboard) {
    redirect(getDefaultAccountPath(account, workspace.account));
  }

  const data = use(loadDashboardPageData(account));

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={data.accountSlug}
        title={
          data.userFirstName
            ? `Welcome back, ${data.userFirstName}`
            : data.accountSlug
        }
        description="Your business overview for this month."
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)]">
        <DashboardPageContent
          accountName={data.userFirstName ?? data.accountSlug}
          metrics={data.metrics}
          statusSummary={data.statusSummary}
          activeJobs={data.activeJobsList}
          recentInvoices={data.recentInvoices}
          teamMembers={data.teamMembers}
        />
      </PageBody>
    </>
  );
}

export default withI18n(TeamAccountHomePage);
