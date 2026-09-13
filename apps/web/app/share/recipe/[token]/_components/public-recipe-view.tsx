import type { CSSProperties } from 'react';

import { Clock, Users } from 'lucide-react';

import { brandAssets } from '~/config/brand.config';
import { RecipeBadges } from '~/home/(user)/life/family/_components/RecipeBadges';
import { RecipeMethodPanel } from '~/home/(user)/life/family/_components/RecipeMethodPanel';
import { RecipeSourceLink } from '~/home/(user)/life/family/_components/RecipeSourceLink';
import { totalTimeLabel } from '~/home/(user)/life/family/_components/meal-ui';
import type { PublicRecipeView } from '~/lib/meals/public-recipe.loader';

export const lightShareVars = {
  '--workspace-shell-canvas': 'var(--ozer-cream-50)',
  '--workspace-shell-panel': 'var(--ozer-white)',
  '--workspace-shell-panel-hover': 'var(--ozer-cream-100)',
  '--workspace-shell-sidebar-accent': 'var(--ozer-plum-alpha-08)',
  '--workspace-shell-border': 'var(--ozer-border-on-light)',
  '--workspace-shell-text': 'var(--ozer-text-on-light)',
  '--workspace-shell-text-muted': 'var(--ozer-plum-600)',
  '--workspace-shell-text-subtle': 'var(--ozer-plum-500)',
  colorScheme: 'light',
} as CSSProperties;

function formatMacro(value: number | null | undefined, unit: string) {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded}${unit}`;
}

export function PublicShareChrome({ eyebrow }: { eyebrow: string }) {
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 pt-8 sm:px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={brandAssets.wordmarkOnLight}
        alt="Ozer"
        className="h-7 w-auto"
      />
      <p className="text-xs font-medium tracking-wide text-[var(--ozer-plum-700)] uppercase">
        {eyebrow}
      </p>
    </header>
  );
}

export function PublicShareNotFound({
  title = 'Not found',
  description = 'This share link is invalid or has been disabled.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--ozer-cream-50,#FBF6EC)] px-4 [color-scheme:light]">
      <div className="max-w-md text-center">
        <h1 className="font-heading text-xl font-bold text-[var(--ozer-plum-900,#2B1B33)]">
          {title}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">{description}</p>
      </div>
    </main>
  );
}

export function PublicRecipeContent({ recipe }: { recipe: PublicRecipeView }) {
  const time = totalTimeLabel(recipe.prepMinutes, recipe.cookMinutes);
  const hasNutrition =
    recipe.caloriesPerServing != null ||
    recipe.proteinG != null ||
    recipe.carbsG != null ||
    recipe.fatG != null;

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      {recipe.imageUrl ? (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={recipe.imageUrl}
            alt=""
            className="max-h-80 w-full object-cover"
          />
        </div>
      ) : null}

      <header className="space-y-3">
        <RecipeBadges
          source={recipe.source}
          sourceLabel={recipe.sourceLabel}
          sourceUrl={recipe.sourceUrl}
          mealType={recipe.mealType}
          tags={recipe.tags}
          dietTags={recipe.dietTags}
        />

        <h1 className="font-heading text-3xl font-bold tracking-tight text-[var(--ozer-plum-900,#2B1B33)]">
          {recipe.name}
        </h1>

        {recipe.description ? (
          <p className="text-base text-[var(--ozer-plum-700)]">
            {recipe.description}
          </p>
        ) : null}

        <RecipeSourceLink url={recipe.sourceUrl} className="text-sm" />

        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--ozer-plum-700)]">
          {time ? (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {time}
              {recipe.prepMinutes || recipe.cookMinutes ? (
                <span>
                  {recipe.prepMinutes ? `${recipe.prepMinutes}m prep` : null}
                  {recipe.prepMinutes && recipe.cookMinutes ? ' · ' : null}
                  {recipe.cookMinutes ? `${recipe.cookMinutes}m cook` : null}
                </span>
              ) : null}
            </span>
          ) : null}
          {recipe.servings ? (
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Serves {recipe.servings}
            </span>
          ) : null}
          {recipe.caloriesPerServing != null ? (
            <span>{recipe.caloriesPerServing} kcal / serving</span>
          ) : null}
        </div>
      </header>

      <RecipeMethodPanel
        baseServings={recipe.servings}
        ingredients={recipe.structure.ingredients}
        steps={recipe.structure.steps}
        fallbackIngredients={recipe.ingredients}
        fallbackInstructions={recipe.instructions}
      />

      {hasNutrition ? (
        <section className="space-y-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5">
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Nutrition
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[var(--workspace-shell-text-muted)]">
                Calories
              </dt>
              <dd className="font-medium text-[var(--workspace-shell-text)]">
                {recipe.caloriesPerServing != null
                  ? `${recipe.caloriesPerServing} kcal`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--workspace-shell-text-muted)]">
                Protein
              </dt>
              <dd className="font-medium text-[var(--workspace-shell-text)]">
                {formatMacro(recipe.proteinG, 'g') ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--workspace-shell-text-muted)]">
                Carbs
              </dt>
              <dd className="font-medium text-[var(--workspace-shell-text)]">
                {formatMacro(recipe.carbsG, 'g') ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--workspace-shell-text-muted)]">Fat</dt>
              <dd className="font-medium text-[var(--workspace-shell-text)]">
                {formatMacro(recipe.fatG, 'g') ?? '—'}
              </dd>
            </div>
          </dl>
          <p className="text-[11px] text-[var(--workspace-shell-text-muted)]">
            Nutrition analysis powered by{' '}
            <a
              href="https://developer.edamam.com"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Edamam
            </a>
            .
          </p>
        </section>
      ) : null}
    </article>
  );
}
