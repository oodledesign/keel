import { withI18n } from '~/lib/i18n/with-i18n';
import { loadPublicRecipeByToken } from '~/lib/meals/public-recipe.loader';

import {
  PublicRecipeContent,
  PublicShareChrome,
  PublicShareNotFound,
  lightShareVars,
} from './_components/public-recipe-view';

export const dynamic = 'force-dynamic';

interface PublicRecipePageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PublicRecipePageProps) {
  const { token } = await params;
  const recipe = await loadPublicRecipeByToken(token);

  return {
    title: recipe?.name ?? 'Recipe not found',
    robots: { index: false, follow: false },
  };
}

async function PublicRecipePage({ params }: PublicRecipePageProps) {
  const { token } = await params;
  const recipe = await loadPublicRecipeByToken(token);

  if (!recipe) {
    return <PublicShareNotFound title="Recipe not found" />;
  }

  return (
    <main
      className="min-h-[100dvh] bg-[var(--ozer-cream-50,#FBF6EC)] [color-scheme:light]"
      style={lightShareVars}
    >
      <PublicShareChrome eyebrow="Recipe" />
      <PublicRecipeContent recipe={recipe} />
    </main>
  );
}

export default withI18n(PublicRecipePage);
