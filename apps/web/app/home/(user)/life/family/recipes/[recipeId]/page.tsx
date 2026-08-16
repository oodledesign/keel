import { notFound } from 'next/navigation';

import { RecipeDetailPage } from '~/home/(user)/life/family/_components/RecipeDetailPage';
import {
  loadFamilyRecipeById,
  loadFamilyRecipeCookLogs,
  loadFamilyRecipePopularity,
  loadFamilyRecipeStructure,
} from '~/home/(user)/life/family/_lib/server/family-meal.loader';
import { resolveMealPlanScope } from '~/home/(user)/life/family/_lib/server/family-meal.scope';
import { withI18n } from '~/lib/i18n/with-i18n';

export const dynamic = 'force-dynamic';

type RecipeDetailRouteProps = {
  params: Promise<{ recipeId: string }>;
};

export async function generateMetadata({ params }: RecipeDetailRouteProps) {
  const { recipeId } = await params;
  const recipe = await loadFamilyRecipeById(recipeId);

  return {
    title: recipe?.name ?? 'Recipe',
  };
}

async function PersonalRecipeDetailRoute({ params }: RecipeDetailRouteProps) {
  const { recipeId } = await params;
  const [recipe, scope, popularity, recentLogs, structure] = await Promise.all([
    loadFamilyRecipeById(recipeId),
    resolveMealPlanScope(),
    loadFamilyRecipePopularity(recipeId),
    loadFamilyRecipeCookLogs(recipeId),
    loadFamilyRecipeStructure(recipeId),
  ]);

  if (!recipe) {
    notFound();
  }

  return (
    <RecipeDetailPage
      recipe={recipe}
      basePath={scope.basePath}
      accountSlug={undefined}
      popularity={popularity}
      recentLogs={recentLogs}
      structure={structure}
    />
  );
}

export default withI18n(PersonalRecipeDetailRoute);
