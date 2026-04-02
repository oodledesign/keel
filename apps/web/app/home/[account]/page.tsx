import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { DashboardPageContent } from './_components/dashboard-page-content';
import { TeamAccountLayoutPageHeader } from './_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from './_lib/role-access';
import { getSpaceTypeFromAccount } from './_lib/server/account-modules';
import { loadDashboardPageData } from './_lib/server/dashboard-page.loader';
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
    return (
      <>
        <TeamAccountLayoutPageHeader
          account={account}
          title={accountLabel}
          description="Shared calendar, shopping, and meal planning for your household."
        />
        <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-8 text-[var(--workspace-shell-text)] lg:px-6">
          <p className="text-muted-foreground max-w-xl text-sm">
            Use the sidebar to open Calendar, Shopping, or Meal plan. Work tools
            (jobs, invoices, clients) are only available in business spaces.
          </p>
        </PageBody>
      </>
    );
  }

  if (spaceType === 'community') {
    return (
      <>
        <TeamAccountLayoutPageHeader
          account={account}
          title={accountLabel}
          description="Schedule, tasks, and notes for your group."
        />
        <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-8 text-[var(--workspace-shell-text)] lg:px-6">
          <p className="text-muted-foreground max-w-xl text-sm">
            Open Schedule, Tasks, or Notes from the sidebar. Business modules
            stay in work spaces.
          </p>
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
