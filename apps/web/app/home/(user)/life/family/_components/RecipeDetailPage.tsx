'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ArrowLeft, Clock, Pencil, Star, Trash2, Users } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  deleteRecipeAction,
  retryRecipeNutritionAction,
  toggleRecipeFavoriteAction,
} from '../_lib/actions';
import { buildRecipesListPath } from '../_lib/family-meal.paths';
import type {
  RecipeCookLogRow,
  RecipePopularityStats,
  RecipeRow,
  RecipeStructure,
} from '../_lib/schema/family-meal.schema';
import { RecipeBadges } from './RecipeBadges';
import { RecipeCookLogPanel } from './RecipeCookLogPanel';
import { RecipeDialog } from './RecipeDialog';
import { RecipeMethodPanel } from './RecipeMethodPanel';
import { panelClass, totalTimeLabel } from './meal-ui';

type Props = {
  recipe: RecipeRow;
  basePath: string;
  accountSlug?: string;
  popularity?: RecipePopularityStats;
  recentLogs?: RecipeCookLogRow[];
  structure?: RecipeStructure;
};

function formatMacro(value: number | null | undefined, unit: string) {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded}${unit}`;
}

export function RecipeDetailPage({
  recipe,
  basePath,
  accountSlug,
  popularity = { times_cooked: 0, avg_rating: null, popularity_score: 0 },
  recentLogs = [],
  structure = { ingredients: [], steps: [] },
}: Props) {
  const router = useRouter();
  const scopeFields = accountSlug ? { accountSlug } : {};
  const [editOpen, setEditOpen] = useState(false);
  const [nutritionPending, startNutritionTransition] = useTransition();
  const [, startTransition] = useTransition();

  const time = totalTimeLabel(recipe.prep_minutes, recipe.cook_minutes);
  const backHref = buildRecipesListPath(basePath);
  const hasNutrition =
    recipe.calories_per_serving != null ||
    recipe.protein_g != null ||
    recipe.carbs_g != null ||
    recipe.fat_g != null;

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRecipeAction({
        recipeId: recipe.id,
        ...scopeFields,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Recipe deleted');
      router.push(backHref);
      router.refresh();
    });
  }

  function handleFavorite() {
    startTransition(async () => {
      const result = await toggleRecipeFavoriteAction({
        recipeId: recipe.id,
        isFavorite: !recipe.is_favorite,
        ...scopeFields,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleRetryNutrition() {
    startNutritionTransition(async () => {
      const result = await retryRecipeNutritionAction({
        recipeId: recipe.id,
        ...scopeFields,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Nutrition updated');
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pt-6 pb-12 text-[var(--workspace-shell-text)] md:px-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--workspace-shell-text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to recipes
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFavorite}
            className="h-8"
          >
            <Star
              className={cn(
                'mr-1.5 h-3.5 w-3.5',
                recipe.is_favorite
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-[var(--workspace-shell-text-muted)]',
              )}
            />
            {recipe.is_favorite ? 'Favourited' : 'Favourite'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="h-8"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="h-8 text-[var(--workspace-shell-text-muted)] hover:text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <header className="space-y-3">
        <RecipeBadges
          source={recipe.source}
          mealType={recipe.meal_type}
          tags={recipe.tags}
          dietTags={recipe.diet_tags}
        />

        <h1 className="text-3xl font-bold tracking-tight">{recipe.name}</h1>

        {recipe.description ? (
          <p className="text-base text-[var(--workspace-shell-text-muted)]">
            {recipe.description}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--workspace-shell-text-muted)]">
          {time ? (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {time}
              {recipe.prep_minutes || recipe.cook_minutes ? (
                <span className="text-[var(--workspace-shell-text-muted)]">
                  {recipe.prep_minutes ? `${recipe.prep_minutes}m prep` : null}
                  {recipe.prep_minutes && recipe.cook_minutes ? ' · ' : null}
                  {recipe.cook_minutes ? `${recipe.cook_minutes}m cook` : null}
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
          {recipe.calories_per_serving != null ? (
            <span>{recipe.calories_per_serving} kcal / serving</span>
          ) : null}
        </div>
      </header>

      {hasNutrition || recipe.nutrition_pending ? (
        <section className={cn(panelClass, 'space-y-3 p-5')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Nutrition
            </h2>
            {recipe.nutrition_pending ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={nutritionPending}
                onClick={handleRetryNutrition}
              >
                {nutritionPending ? 'Retrying…' : 'Retry analysis'}
              </Button>
            ) : null}
          </div>

          {hasNutrition ? (
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-[var(--workspace-shell-text-muted)]">
                  Calories
                </dt>
                <dd className="font-medium text-[var(--workspace-shell-text)]">
                  {recipe.calories_per_serving != null
                    ? `${recipe.calories_per_serving} kcal`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--workspace-shell-text-muted)]">
                  Protein
                </dt>
                <dd className="font-medium text-[var(--workspace-shell-text)]">
                  {formatMacro(recipe.protein_g, 'g') ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--workspace-shell-text-muted)]">
                  Carbs
                </dt>
                <dd className="font-medium text-[var(--workspace-shell-text)]">
                  {formatMacro(recipe.carbs_g, 'g') ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--workspace-shell-text-muted)]">
                  Fat
                </dt>
                <dd className="font-medium text-[var(--workspace-shell-text)]">
                  {formatMacro(recipe.fat_g, 'g') ?? '—'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Nutrition analysis is pending. You can retry once Edamam is
              configured, or after fixing ingredient lines.
            </p>
          )}

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

      <RecipeMethodPanel
        baseServings={recipe.servings}
        ingredients={structure.ingredients}
        steps={structure.steps}
        fallbackIngredients={recipe.ingredients}
        fallbackInstructions={recipe.instructions}
      />

      <RecipeCookLogPanel
        recipeId={recipe.id}
        accountSlug={accountSlug}
        popularity={popularity}
        recentLogs={recentLogs}
      />

      <RecipeDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        recipe={recipe}
        accountSlug={accountSlug}
        onSaved={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
