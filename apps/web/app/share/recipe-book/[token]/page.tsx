import { withI18n } from '~/lib/i18n/with-i18n';
import { loadPublicRecipeBookByToken } from '~/lib/meals/public-recipe.loader';

import { PublicShareNotFound } from '../../recipe/[token]/_components/public-recipe-view';
import { PublicRecipeBookView } from './_components/public-recipe-book-view';

export const dynamic = 'force-dynamic';

interface PublicRecipeBookPageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PublicRecipeBookPageProps) {
  const { token } = await params;
  const book = await loadPublicRecipeBookByToken(token);

  return {
    title: book?.name ?? 'Recipe book not found',
    robots: { index: false, follow: false },
  };
}

async function PublicRecipeBookPage({ params }: PublicRecipeBookPageProps) {
  const { token } = await params;
  const book = await loadPublicRecipeBookByToken(token);

  if (!book) {
    return <PublicShareNotFound title="Recipe book not found" />;
  }

  return <PublicRecipeBookView book={book} />;
}

export default withI18n(PublicRecipeBookPage);
