'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ArrowLeft,
  Clock,
  Pencil,
  Sparkles,
  Star,
  Trash2,
  Users,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { deleteRecipeAction, toggleRecipeFavoriteAction } from '../_lib/actions';
import { buildRecipesListPath } from '../_lib/family-meal.paths';
import type { RecipeRow } from '../_lib/schema/family-meal.schema';
import { RecipeDialog } from './RecipeDialog';
import {
  mealTypeLabels,
  panelClass,
  titleCase,
  totalTimeLabel,
} from './meal-ui';

type Props = {
  recipe: RecipeRow;
  basePath: string;
  accountSlug?: string;
};

export function RecipeDetailPage({ recipe, basePath, accountSlug }: Props) {
  const router = useRouter();
  const scopeFields = accountSlug ? { accountSlug } : {};
  const [editOpen, setEditOpen] = useState(false);
  const [, startTransition] = useTransition();

  const time = totalTimeLabel(recipe.prep_minutes, recipe.cook_minutes);
  const backHref = buildRecipesListPath(basePath);

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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-12 pt-6 text-[var(--workspace-shell-text)] md:px-2">
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
        <div className="flex flex-wrap items-center gap-2">
          {recipe.source === 'ai' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ozer-accent-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--ozer-accent-muted)]">
              <Sparkles className="h-3 w-3" />
              AI generated
            </span>
          ) : null}
          <span className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-1 text-[11px] capitalize text-[var(--workspace-shell-text-muted)]">
            {mealTypeLabels[recipe.meal_type]}
          </span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight">{recipe.name}</h1>

        {recipe.description ? (
          <p className="text-base text-[var(--workspace-shell-text-muted)]">{recipe.description}</p>
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
        </div>

        {recipe.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-1 text-xs capitalize text-[var(--workspace-shell-text-muted)]"
              >
                {titleCase(tag)}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={cn(panelClass, 'p-5')}>
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">Ingredients</h2>
          {recipe.ingredients.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-[var(--workspace-shell-text-muted)]">
              {recipe.ingredients.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#FFE3DA]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">No ingredients listed.</p>
          )}
        </section>

        <section className={cn(panelClass, 'p-5 md:col-span-2')}>
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">Method</h2>
          {recipe.instructions?.trim() ? (
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--workspace-shell-text-muted)]">
              {recipe.instructions}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">No instructions yet.</p>
          )}
        </section>
      </div>

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
