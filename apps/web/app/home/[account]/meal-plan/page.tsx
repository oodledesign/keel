import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { FamilyPageClient } from '~/home/(user)/life/family/_components/FamilyPageClient';
import type { MealPlanView } from '~/home/(user)/life/family/_lib/schema/family-meal.schema';
import { loadFamilyMealData } from '~/home/(user)/life/family/_lib/server/family-meal.loader';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../_lib/role-access';
import { isAccountModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../_lib/server/workspace-route-guard';

interface FamilyMealPlanPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ week?: string; month?: string; view?: string }>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:home.pageTitle');
  return { title: `${title} – Meal plan` };
};

function parseView(value: string | undefined): MealPlanView {
  return value === 'month' ? 'month' : 'week';
}

async function FamilyMealPlanPage({
  params,
  searchParams,
}: FamilyMealPlanPageProps) {
  const { account: slug } = await params;
  const { week, month, view: viewParam } = await searchParams;
  const view = parseView(viewParam);

  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(workspace, slug, ['family']);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (
    !access.canViewDashboard ||
    !isAccountModuleEnabled(workspace.moduleSettings, 'meal_plan')
  ) {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  const weekStart =
    view === 'week' && /^\d{4}-\d{2}-\d{2}$/.test(week ?? '')
      ? week
      : undefined;

  const monthKey =
    view === 'month' && /^\d{4}-\d{2}$/.test(month ?? '') ? month : undefined;

  const data = await loadFamilyMealData({
    accountSlug: slug,
    view,
    weekStart,
    monthKey,
  });

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Meal plan"
        description="Plan meals together in your family space."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-0 text-[var(--workspace-shell-text)] lg:px-0">
        <FamilyPageClient
          initialData={data}
          showHouseholdTasks={false}
          compactHeader
        />
      </PageBody>
    </>
  );
}

export default withI18n(FamilyMealPlanPage);
