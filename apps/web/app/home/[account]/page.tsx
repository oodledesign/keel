import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { DashboardPageContent } from './_components/dashboard-page-content';
import { FamilyDashboard } from './_components/family-dashboard';
import { HomegroupDashboard } from './_components/homegroup-dashboard';
import { TeamAccountLayoutPageHeader } from './_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from './_lib/role-access';
import { getSpaceTypeFromAccount } from './_lib/server/account-modules';
import { loadDashboardPageData } from './_lib/server/dashboard-page.loader';
import { loadGroupDashboardData } from './_lib/server/group-dashboard.loader';
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

async function TeamAccountHomePage({ params }: TeamAccountHomePageProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
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

  const spaceType = getSpaceTypeFromAccount(
    workspace.account as { space_type?: string | null },
  );
  const accountLabel =
    (workspace.account as { name?: string | null }).name?.trim() ||
    account;

  if (spaceType === 'family') {
    const groupData = await loadGroupDashboardData(account);
    return (
      <>
        <TeamAccountLayoutPageHeader
          account={account}
          title={accountLabel}
          description="Overview of your family workspace."
        />
        <PageBody className="bg-[var(--workspace-shell-canvas)] p-0">
          <FamilyDashboard
            accountSlug={account}
            accountId={workspace.account.id as string}
            projects={groupData.projects}
            members={groupData.members}
            recentTasks={groupData.recentTasks}
          />
        </PageBody>
      </>
    );
  }

  if (spaceType === 'community') {
    const groupData = await loadGroupDashboardData(account);
    return (
      <>
        <TeamAccountLayoutPageHeader
          account={account}
          title={accountLabel}
          description="Overview of your group workspace."
        />
        <PageBody className="bg-[var(--workspace-shell-canvas)] p-0">
          <HomegroupDashboard
            accountSlug={account}
            accountId={workspace.account.id as string}
            projects={groupData.projects}
            members={groupData.members}
            recentTasks={groupData.recentTasks}
          />
        </PageBody>
      </>
    );
  }

  const data = await loadDashboardPageData(account);

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
