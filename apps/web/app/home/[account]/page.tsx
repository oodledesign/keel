import { Suspense } from 'react';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { buildWorkAppLinks } from '~/config/work-account-navigation.config';
import { isBusinessLiteWorkspace } from '~/lib/billing/is-business-lite-workspace';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { BusinessDashboardSkeleton } from './_components/business-dashboard-skeleton';
import { BusinessLiteDashboard } from './_components/business-lite-dashboard';
import { CommercialAgencyDashboard } from './_components/commercial-agency-dashboard';
import { DashboardPageContent } from './_components/dashboard-page-content';
import { FamilyDashboard } from './_components/family-dashboard';
import { HomegroupDashboard } from './_components/homegroup-dashboard';
import { PropertyBusinessDashboard } from './_components/property-business-dashboard';
import { TeamAccountLayoutPageHeader } from './_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from './_lib/role-access';
import { isPropertyNavModuleEnabled } from './_lib/server/account-modules';
import { loadCommercialDashboardData } from './_lib/server/commercial-dashboard.loader';
import { loadCommunityDashboardData } from './_lib/server/community-dashboard.loader';
import { loadDashboardPageData } from './_lib/server/dashboard-page.loader';
import { loadFamilyDashboardData } from './_lib/server/family-dashboard.loader';
import { loadPropertyDashboardData } from './_lib/server/property-dashboard.loader';
import { loadTeamWorkspace } from './_lib/server/team-account-workspace.loader';
import { spaceTypeFromProfile } from './_lib/workspace-profile';

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

async function PropertyDashboardContent({
  account,
  moduleSettings,
}: {
  account: string;
  moduleSettings: Parameters<typeof isPropertyNavModuleEnabled>[0];
}) {
  const propertyData = await loadPropertyDashboardData(account);
  const financesEnabled = isPropertyNavModuleEnabled(
    moduleSettings,
    'finances',
  );

  return (
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
  );
}

async function CommercialDashboardContent({ account }: { account: string }) {
  const commercialData = await loadCommercialDashboardData(account);

  return (
    <CommercialAgencyDashboard
      accountSlug={commercialData.accountSlug}
      metrics={commercialData.metrics}
      recentListings={commercialData.recentListings}
    />
  );
}

async function FamilyDashboardContent({ account }: { account: string }) {
  const familyData = await loadFamilyDashboardData(account);

  return (
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
  );
}

async function CommunityDashboardContent({ account }: { account: string }) {
  const communityData = await loadCommunityDashboardData(account);

  return <HomegroupDashboard {...communityData} />;
}

async function WorkDashboardContent({ account }: { account: string }) {
  const data = await loadDashboardPageData(account);

  return (
    <DashboardPageContent
      accountSlug={data.accountSlug}
      accountId={data.accountId}
      metrics={data.metrics}
      financeTrend={data.financeTrend}
      upcomingTasks={data.upcomingTasks}
      needsReply={data.needsReply}
      suggestedEmailTasks={data.suggestedEmailTasks}
      recentNotes={data.recentNotes}
    />
  );
}

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
    (workspace.account as { name?: string | null }).name?.trim() || account;
  const accountId = (workspace.account as { id: string }).id;

  const billingClient = getSupabaseServerClient();
  const isLiteWorkspace =
    spaceType === 'work' &&
    (await isBusinessLiteWorkspace(
      billingClient,
      accountId,
      workspace.businessType,
    ));

  const userRecord = workspace.user as {
    user_metadata?: { first_name?: string };
  };
  const userFirstName =
    typeof userRecord?.user_metadata?.first_name === 'string'
      ? userRecord.user_metadata.first_name.trim()
      : null;

  if (spaceType === 'property') {
    return (
      <>
        <TeamAccountLayoutPageHeader
          account={account}
          title={accountLabel}
          description="Overview of your property business."
        />
        <PageBody className="bg-[var(--workspace-shell-canvas)] p-0">
          <Suspense fallback={<BusinessDashboardSkeleton />}>
            <PropertyDashboardContent
              account={account}
              moduleSettings={workspace.moduleSettings}
            />
          </Suspense>
        </PageBody>
      </>
    );
  }

  if (spaceType === 'commercial-property') {
    return (
      <>
        <TeamAccountLayoutPageHeader
          account={account}
          title="Agency home"
          description="Triage enquiries, keep stock moving, and jump into today's work."
        />
        <PageBody className="bg-[var(--workspace-shell-canvas)] p-0">
          <Suspense fallback={<BusinessDashboardSkeleton />}>
            <CommercialDashboardContent account={account} />
          </Suspense>
        </PageBody>
      </>
    );
  }

  if (spaceType === 'family') {
    return (
      <>
        <TeamAccountLayoutPageHeader
          account={account}
          title={accountLabel}
          description="Overview of your family workspace."
        />
        <PageBody className="bg-[var(--workspace-shell-canvas)] p-0">
          <Suspense fallback={<BusinessDashboardSkeleton />}>
            <FamilyDashboardContent account={account} />
          </Suspense>
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
          description="Overview of your group workspace."
        />
        <PageBody className="bg-[var(--workspace-shell-canvas)] p-0">
          <Suspense fallback={<BusinessDashboardSkeleton />}>
            <CommunityDashboardContent account={account} />
          </Suspense>
        </PageBody>
      </>
    );
  }

  if (isLiteWorkspace) {
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

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title={userFirstName ? `Welcome back, ${userFirstName}` : accountLabel}
        description="Your business overview for this month."
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] p-0 md:p-0">
        <Suspense fallback={<BusinessDashboardSkeleton />}>
          <WorkDashboardContent account={account} />
        </Suspense>
      </PageBody>
    </>
  );
}

export default withI18n(TeamAccountHomePage);
