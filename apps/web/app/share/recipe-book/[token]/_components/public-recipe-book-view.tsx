import { Clock } from 'lucide-react';

import { totalTimeLabel } from '~/home/(user)/life/family/_components/meal-ui';
import type { PublicRecipeBookView as PublicRecipeBookData } from '~/lib/meals/public-recipe.loader';

import {
  PublicRecipeContent,
  PublicShareChrome,
  lightShareVars,
} from '../../../recipe/[token]/_components/public-recipe-view';

export function PublicRecipeBookView({ book }: { book: PublicRecipeBookData }) {
  return (
    <main
      className="min-h-[100dvh] bg-[var(--ozer-cream-50,#FBF6EC)] [color-scheme:light]"
      style={lightShareVars}
    >
      <PublicShareChrome eyebrow="Recipe book" />

      <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-6 sm:px-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-[var(--ozer-plum-900,#2B1B33)]">
          {book.name}
        </h1>
        {book.description ? (
          <p className="mt-2 text-base text-[var(--ozer-plum-700)]">
            {book.description}
          </p>
        ) : null}
        <p className="mt-3 text-sm text-[var(--ozer-plum-700)]">
          {book.recipes.length === 1
            ? '1 recipe'
            : `${book.recipes.length} recipes`}
        </p>
      </div>

      {book.recipes.length === 0 ? (
        <p className="mx-auto max-w-3xl px-4 pb-16 text-sm text-[var(--ozer-plum-700)] sm:px-6">
          This recipe book is empty.
        </p>
      ) : (
        <>
          <div className="mx-auto grid w-full max-w-3xl gap-3 px-4 pb-10 sm:px-6">
            {book.recipes.map((recipe, index) => {
              const href = recipe.publicShareToken
                ? `/share/recipe/${recipe.publicShareToken}`
                : `#recipe-${recipe.id}`;
              const time = totalTimeLabel(
                recipe.prepMinutes,
                recipe.cookMinutes,
              );

              return (
                <a
                  key={recipe.id}
                  href={href}
                  className="flex items-center gap-3 rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-white/80 px-4 py-3 transition-opacity hover:opacity-90"
                >
                  <span className="w-6 text-xs font-medium text-[var(--ozer-plum-700)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--ozer-plum-900,#2B1B33)]">
                      {recipe.name}
                    </p>
                    {recipe.description ? (
                      <p className="mt-0.5 line-clamp-1 text-xs text-[var(--ozer-plum-700)]">
                        {recipe.description}
                      </p>
                    ) : null}
                  </div>
                  {time ? (
                    <span className="flex items-center gap-1 text-xs text-[var(--ozer-plum-700)]">
                      <Clock className="h-3.5 w-3.5" />
                      {time}
                    </span>
                  ) : null}
                </a>
              );
            })}
          </div>

          <div className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-0 pb-16">
            {book.recipes.map((recipe) => (
              <section key={recipe.id} id={`recipe-${recipe.id}`}>
                <PublicRecipeContent recipe={recipe} />
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
