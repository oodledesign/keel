import { notFound } from 'next/navigation';

import { RecipeBookDetailPage } from '~/home/(user)/life/family/_components/RecipeBookDetailPage';
import {
  loadFamilyMealData,
  loadFamilyRecipeBookById,
} from '~/home/(user)/life/family/_lib/server/family-meal.loader';
import { resolveMealPlanScope } from '~/home/(user)/life/family/_lib/server/family-meal.scope';
import { withI18n } from '~/lib/i18n/with-i18n';

export const dynamic = 'force-dynamic';

type RecipeBookDetailRouteProps = {
  params: Promise<{ bookId: string }>;
};

export async function generateMetadata({ params }: RecipeBookDetailRouteProps) {
  const { bookId } = await params;
  const book = await loadFamilyRecipeBookById(bookId);

  return {
    title: book?.name ?? 'Recipe book',
  };
}

async function PersonalRecipeBookDetailRoute({
  params,
}: RecipeBookDetailRouteProps) {
  const { bookId } = await params;
  const [book, mealData, scope] = await Promise.all([
    loadFamilyRecipeBookById(bookId),
    loadFamilyMealData(),
    resolveMealPlanScope(),
  ]);

  if (!book) {
    notFound();
  }

  return (
    <RecipeBookDetailPage
      book={book}
      recipes={mealData.recipes}
      basePath={scope.basePath}
      accountSlug={undefined}
    />
  );
}

export default withI18n(PersonalRecipeBookDetailRoute);
