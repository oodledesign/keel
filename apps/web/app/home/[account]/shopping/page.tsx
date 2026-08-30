import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { ShoppingListPanel } from '~/home/(user)/life/family/_components/ShoppingListPanel';
import { loadFamilyShoppingList } from '~/home/(user)/life/family/_lib/server/family-shopping.loader';
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

interface FamilyShoppingPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ week?: string; create?: string }>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:home.pageTitle');
  return { title: `${title} – Shopping` };
};

async function FamilyShoppingPage({
  params,
  searchParams,
}: FamilyShoppingPageProps) {
  const { account: slug } = await params;
  const { week, create } = await searchParams;
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
    !isAccountModuleEnabled(workspace.moduleSettings, 'shopping')
  ) {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(week ?? '') ? week : undefined;
  const data = await loadFamilyShoppingList({
    accountSlug: slug,
    weekStart,
  });

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Shopping"
        description="Merged groceries from this week's meal plan."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <ShoppingListPanel
          list={data.list}
          weekStart={data.weekStart}
          mealPlanHref={`/app/${slug}/meal-plan?view=week&week=${data.weekStart}`}
          accountSlug={slug}
          startAdding={create === 'item'}
        />
      </PageBody>
    </>
  );
}

export default withI18n(FamilyShoppingPage);
