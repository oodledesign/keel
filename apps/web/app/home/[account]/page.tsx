import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { isBusinessLiteWorkspace } from '~/lib/billing/is-business-lite-workspace';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { BusinessLiteDashboard } from './_components/business-lite-dashboard';
import { DashboardPageContent } from './_components/dashboard-page-content';
import { FamilyDashboard } from './_components/family-dashboard';
import { HomegroupDashboard } from './_components/homegroup-dashboard';
import { PropertyBusinessDashboard } from './_components/property-business-dashboard';
import { TeamAccountLayoutPageHeader } from './_components/team-account-layout-page-header';
import { WorkspaceDashboardShortcutsBar } from './_components/workspace-dashboard-shortcuts-bar';
import { getDefaultAccountPath, getTeamAccountAccess } from './_lib/role-access';
import { buildWorkAppLinks } from '~/config/work-account-navigation.config';
import { spaceTypeFromProfile } from './_lib/workspace-profile';
import { isPropertyNavModuleEnabled } from './_lib/server/account-modules';
import { loadDashboardPageData } from './_lib/server/dashboard-page.loader';
import { loadCommunityDashboardData } from './_lib/server/community-dashboard.loader';
import { loadFamilyDashboardData } from './_lib/server/family-dashboard.loader';
import { loadPropertyDashboardData } from './_lib/server/property-dashboard.loader';
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

  const spaceType = spaceTypeFromProfile(workspace.workspaceProfile);
  const accountLabel =
    (workspace.account as { name?: string | null }).name?.trim() ||
    account;
  const accountId = (workspace.account as { id: string }).id;

  const billingClient = getSupabaseServerClient();
  const isLiteWorkspace =
    spaceType === 'work' &&
    (await isBusinessLiteWorkspace(
      billingClient,
      accountId,
      workspace.businessType,
    ));

  const shortcutsBar = (
    <Suspense fallback={null}>
      <WorkspaceDashboardShortcutsBar
        accountId={accountId}
        accountSlug={account}
        accountName={accountLabel}
      />
    </Suspense>
  );

  if (spaceType === 'property') {
    const propertyData = await loadPropertyDashboardData(account);
    const financesEnabled = isPropertyNavModuleEnabled(
      workspace.moduleSettings,
      'finances',
    );
    return (
      <>
        <TeamAccountLayoutPageHeader
          account={account}
          title={accountLabel}
          description="Overview of your property business."
        />
        <PageBody className="bg-[var(--workspace-shell-canvas)] p-0">
          {shortcutsBar}
          <PropertyBusinessDashboard
            accountSlug={account}
            propertyCounts={propertyData.propertyCounts}
            openMaintenanceJobs={propertyData.openMaintenanceJobs}
            openTasksCount={propertyData.openTasksCount}
            members={propertyData.members}
            recentTasks={propertyData.recentTasks}
            financesEnabled={financesEnabled}
            financeSummary={propertyData.financeSummary}
          />
        </PageBody>
      </>
    );
  }

  if (spaceType === 'family') {
    const familyData = await loadFamilyDashboardData(account);
    return (
      <>
        <TeamAccountLayoutPageHeader
          account={account}
          title={accountLabel}
          description="Overview of your family workspace."
        />
        <PageBody className="bg-[var(--workspace-shell-canvas)] p-0">
          {shortcutsBar}
          <FamilyDashboard
            accountSlug={familyData.accountSlug}
            openTasksCount={familyData.openTasksCount}
            upcomingPlansCount={familyData.upcomingPlansCount}
            familyMembersCount={familyData.familyMembersCount}
            overdueCount={familyData.overdueCount}
            upcomingTasks={familyData.upcomingTasks}
            weekMealPlan={familyData.weekMealPlan}
            upcomingEvents={familyData.upcomingEvents}
          />
        </PageBody>
      </>
    );
  }

  if (spaceType === 'community') {
    const communityData = await loadCommunityDashboardData(account);
    return (
      <>
        <TeamAccountLayoutPageHeader
          account={account}
          title={accountLabel}
          description="Overview of your group workspace."
        />
        <PageBody className="bg-[var(--workspace-shell-canvas)] p-0">
          {shortcutsBar}
          <HomegroupDashboard {...communityData} />
        </PageBody>
      </>
    );
  }

  if (isLiteWorkspace) {
    const userRecord = workspace.user as { user_metadata?: { first_name?: string } };
    const userFirstName =
      typeof userRecord?.user_metadata?.first_name === 'string'
        ? userRecord.user_metadata.first_name.trim()
        : null;
    const installedApps = buildWorkAppLinks(account, workspace.moduleSettings);

    return (
      <>
        <TeamAccountLayoutPageHeader
          account={account}
          title={
            userFirstName ? `Welcome back, ${userFirstName}` : accountLabel
          }
          description="Your apps workspace — install add-ons or upgrade to full business."
        />
        <PageBody className="bg-[var(--workspace-shell-canvas)] p-0">
          {shortcutsBar}
          <BusinessLiteDashboard
            accountSlug={account}
            accountName={accountLabel}
            userFirstName={userFirstName}
            canManageBilling={access.canViewBilling}
            installedApps={installedApps}
          />
        </PageBody>
      </>
    );
  }

  const data = await loadDashboardPageData(account);

  const shortcutsBarMobile = (
    <Suspense fallback={null}>
      <WorkspaceDashboardShortcutsBar
        accountId={accountId}
        accountSlug={account}
        accountName={data.accountName}
        compact
        className="px-0 pt-0"
      />
    </Suspense>
  );

  const shortcutsBarDesktop = (
    <Suspense fallback={null}>
      <WorkspaceDashboardShortcutsBar
        accountId={accountId}
        accountSlug={account}
        accountName={data.accountName}
      />
    </Suspense>
  );

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

      <PageBody className="bg-[var(--workspace-shell-canvas)] p-0 md:p-0">
        <div className="hidden md:block">{shortcutsBarDesktop}</div>
        <DashboardPageContent
          accountName={data.userFirstName ?? data.accountSlug}
          accountSlug={data.accountSlug}
          metrics={data.metrics}
          financeTrend={data.financeTrend}
          statusSummary={data.statusSummary}
          activeJobs={data.activeJobsList}
          upcomingTasks={data.upcomingTasks}
          recentNotes={data.recentNotes}
          recentInvoices={data.recentInvoices}
          teamMembers={data.teamMembers}
          shortcutsBar={shortcutsBarMobile}
        />
      </PageBody>
    </>
  );
}

export default withI18n(TeamAccountHomePage);
