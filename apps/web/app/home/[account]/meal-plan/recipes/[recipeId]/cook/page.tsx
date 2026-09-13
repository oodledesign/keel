import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { RecipeCookMode } from '~/home/(user)/life/family/_components/RecipeCookMode';
import {
  loadFamilyRecipeById,
  loadFamilyRecipeStructure,
} from '~/home/(user)/life/family/_lib/server/family-meal.loader';
import { resolveMealPlanScope } from '~/home/(user)/life/family/_lib/server/family-meal.scope';
import { withI18n } from '~/lib/i18n/with-i18n';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../../../_lib/role-access';
import { isAccountModuleEnabled } from '../../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../_lib/server/workspace-route-guard';

interface WorkspaceRecipeCookPageProps {
  params: Promise<{ account: string; recipeId: string }>;
}

export const dynamic = 'force-dynamic';

async function WorkspaceRecipeCookPage({ params }: WorkspaceRecipeCookPageProps) {
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

  const [recipe, structure, scope] = await Promise.all([
    loadFamilyRecipeById(recipeId, slug),
    loadFamilyRecipeStructure(recipeId),
    resolveMealPlanScope(slug),
  ]);

  if (!recipe) {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-0 text-[var(--workspace-shell-text)]">
      <RecipeCookMode
        recipe={recipe}
        structure={structure}
        basePath={scope.basePath}
      />
    </PageBody>
  );
}

export default withI18n(WorkspaceRecipeCookPage);
