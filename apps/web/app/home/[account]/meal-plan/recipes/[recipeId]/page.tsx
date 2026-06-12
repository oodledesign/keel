import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { RecipeDetailPage } from '~/home/(user)/life/family/_components/RecipeDetailPage';
import { loadFamilyRecipeById } from '~/home/(user)/life/family/_lib/server/family-meal.loader';
import { resolveMealPlanScope } from '~/home/(user)/life/family/_lib/server/family-meal.scope';
import { withI18n } from '~/lib/i18n/with-i18n';

import { getDefaultAccountPath, getTeamAccountAccess } from '../../_lib/role-access';
import { isAccountModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';

interface WorkspaceRecipeDetailPageProps {
  params: Promise<{ account: string; recipeId: string }>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async ({
  params,
}: WorkspaceRecipeDetailPageProps) => {
  const { account: slug, recipeId } = await params;
  const recipe = await loadFamilyRecipeById(recipeId, slug);

  return {
    title: recipe?.name ?? 'Recipe',
  };
};

async function WorkspaceRecipeDetailPage({
  params,
}: WorkspaceRecipeDetailPageProps) {
  const { account: slug, recipeId } = await params;

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

  const [recipe, scope] = await Promise.all([
    loadFamilyRecipeById(recipeId, slug),
    resolveMealPlanScope(slug),
  ]);

  if (!recipe) {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-0 text-[var(--workspace-shell-text)] md:px-6 lg:px-8">
      <RecipeDetailPage
        recipe={recipe}
        basePath={scope.basePath}
        accountSlug={slug}
      />
    </PageBody>
  );
}

export default withI18n(WorkspaceRecipeDetailPage);
