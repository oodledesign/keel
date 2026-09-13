import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { RecipeBookDetailPage } from '~/home/(user)/life/family/_components/RecipeBookDetailPage';
import {
  loadFamilyMealData,
  loadFamilyRecipeBookById,
} from '~/home/(user)/life/family/_lib/server/family-meal.loader';
import { resolveMealPlanScope } from '~/home/(user)/life/family/_lib/server/family-meal.scope';
import { withI18n } from '~/lib/i18n/with-i18n';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../../_lib/role-access';
import { isAccountModuleEnabled } from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';

interface WorkspaceRecipeBookDetailPageProps {
  params: Promise<{ account: string; bookId: string }>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async ({
  params,
}: WorkspaceRecipeBookDetailPageProps) => {
  const { account: slug, bookId } = await params;
  const book = await loadFamilyRecipeBookById(bookId, slug);

  return {
    title: book?.name ?? 'Recipe book',
  };
};

async function WorkspaceRecipeBookDetailPage({
  params,
}: WorkspaceRecipeBookDetailPageProps) {
  const { account: slug, bookId } = await params;

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

  const [book, mealData, scope] = await Promise.all([
    loadFamilyRecipeBookById(bookId, slug),
    loadFamilyMealData({ accountSlug: slug }),
    resolveMealPlanScope(slug),
  ]);

  if (!book) {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-0 text-[var(--workspace-shell-text)] md:px-6 lg:px-8">
      <RecipeBookDetailPage
        book={book}
        recipes={mealData.recipes}
        basePath={scope.basePath}
        accountSlug={slug}
      />
    </PageBody>
  );
}

export default withI18n(WorkspaceRecipeBookDetailPage);
