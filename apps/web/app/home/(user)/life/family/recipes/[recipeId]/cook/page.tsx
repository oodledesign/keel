import { notFound } from 'next/navigation';

import { RecipeCookMode } from '~/home/(user)/life/family/_components/RecipeCookMode';
import {
  loadFamilyRecipeById,
  loadFamilyRecipeStructure,
} from '~/home/(user)/life/family/_lib/server/family-meal.loader';
import { resolveMealPlanScope } from '~/home/(user)/life/family/_lib/server/family-meal.scope';
import { withI18n } from '~/lib/i18n/with-i18n';

export const dynamic = 'force-dynamic';

type CookRouteProps = {
  params: Promise<{ recipeId: string }>;
};

async function PersonalRecipeCookRoute({ params }: CookRouteProps) {
  const { recipeId } = await params;
  const [recipe, structure, scope] = await Promise.all([
    loadFamilyRecipeById(recipeId),
    loadFamilyRecipeStructure(recipeId),
    resolveMealPlanScope(),
  ]);

  if (!recipe) {
    notFound();
  }

  return (
    <RecipeCookMode
      recipe={recipe}
      structure={structure}
      basePath={scope.basePath}
    />
  );
}

export default withI18n(PersonalRecipeCookRoute);
