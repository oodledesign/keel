import { notFound } from 'next/navigation';

import { RecipeDetailPage } from '../_components/RecipeDetailPage';
import { loadFamilyRecipeById } from '../_lib/server/family-meal.loader';
import { resolveMealPlanScope } from '../_lib/server/family-meal.scope';

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

export default async function PersonalRecipeDetailRoute({
  params,
}: RecipeDetailRouteProps) {
  const { recipeId } = await params;
  const [recipe, scope] = await Promise.all([
    loadFamilyRecipeById(recipeId),
    resolveMealPlanScope(),
  ]);

  if (!recipe) {
    notFound();
  }

  return (
    <RecipeDetailPage
      recipe={recipe}
      basePath={scope.basePath}
      accountSlug={undefined}
    />
  );
}
