'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ArrowLeft, Clock, Pencil, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { buildPublicRecipeBookShareUrl } from '~/lib/meals/public-recipe-share';

import { buildRecipeDetailPath } from '../_lib/family-meal.paths';
import { deleteRecipeBookAction } from '../_lib/recipe-book-actions';
import {
  rotateRecipeBookShareTokenAction,
  setRecipeBookPublicShareAction,
} from '../_lib/recipe-share-actions';
import type {
  RecipeBookWithRecipes,
  RecipeRow,
} from '../_lib/schema/family-meal.schema';
import { RecipeBookDialog } from './RecipeBookDialog';
import { RecipeSharePanel } from './RecipeSharePanel';
import { panelClass, totalTimeLabel } from './meal-ui';

type Props = {
  book: RecipeBookWithRecipes;
  recipes: RecipeRow[];
  basePath: string;
  accountSlug?: string;
};

export function RecipeBookDetailPage({
  book,
  recipes,
  basePath,
  accountSlug,
}: Props) {
  const router = useRouter();
  const scopeFields = accountSlug ? { accountSlug } : {};
  const [editOpen, setEditOpen] = useState(false);
  const [, startTransition] = useTransition();
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const orderedRecipes = book.recipe_ids
    .map((id) => recipesById.get(id))
    .filter((recipe): recipe is RecipeRow => Boolean(recipe));
  const backHref = `${basePath}?tab=books`;

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRecipeBookAction({
        bookId: book.id,
        ...scopeFields,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Recipe book deleted');
      router.push(backHref);
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
          Back to books
        </Link>

        <div className="flex items-center gap-2">
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

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{book.name}</h1>
        {book.description ? (
          <p className="text-base text-[var(--workspace-shell-text-muted)]">
            {book.description}
          </p>
        ) : null}
      </header>

      <RecipeSharePanel
        title="Public link"
        description="Share a read-only page with this recipe book."
        enabled={book.public_share_enabled}
        token={book.public_share_token}
        buildUrl={buildPublicRecipeBookShareUrl}
        onToggle={async (enabled) => {
          const result = await setRecipeBookPublicShareAction({
            bookId: book.id,
            enabled,
            ...scopeFields,
          });
          if (result.success) router.refresh();
          return result;
        }}
        onRotate={async () => {
          const result = await rotateRecipeBookShareTokenAction({
            bookId: book.id,
            ...scopeFields,
          });
          if (result.success) router.refresh();
          return result;
        }}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Recipes
        </h2>
        {orderedRecipes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--workspace-shell-border)] px-6 py-12 text-center text-sm text-[var(--workspace-shell-text-muted)]">
            This book is empty. Edit it to add recipes.
          </div>
        ) : (
          <ol className="space-y-3">
            {orderedRecipes.map((recipe, index) => {
              const time = totalTimeLabel(
                recipe.prep_minutes,
                recipe.cook_minutes,
              );
              return (
                <li key={recipe.id}>
                  <Link
                    href={buildRecipeDetailPath(basePath, recipe.id)}
                    className={cn(
                      panelClass,
                      'flex items-center gap-3 p-4 transition-opacity hover:opacity-90',
                    )}
                  >
                    <span className="w-6 text-xs font-medium text-[var(--workspace-shell-text-muted)]">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                        {recipe.name}
                      </p>
                      {recipe.description ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-[var(--workspace-shell-text-muted)]">
                          {recipe.description}
                        </p>
                      ) : null}
                    </div>
                    {time ? (
                      <span className="flex items-center gap-1 text-xs text-[var(--workspace-shell-text-muted)]">
                        <Clock className="h-3.5 w-3.5" />
                        {time}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <RecipeBookDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        book={book}
        recipes={recipes}
        accountSlug={accountSlug}
        onSaved={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
