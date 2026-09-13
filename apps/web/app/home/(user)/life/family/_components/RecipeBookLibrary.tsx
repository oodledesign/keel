'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';

import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { buildRecipeBookDetailPath } from '../_lib/family-meal.paths';
import { deleteRecipeBookAction } from '../_lib/recipe-book-actions';
import type {
  RecipeBookWithRecipes,
  RecipeRow,
} from '../_lib/schema/family-meal.schema';
import { RecipeBookDialog } from './RecipeBookDialog';
import { ACCENT, panelClass } from './meal-ui';

type Props = {
  books: RecipeBookWithRecipes[];
  recipes: RecipeRow[];
  basePath: string;
  accountSlug?: string;
  initialRecipeIds?: string[];
  onChanged: () => void;
};

export function RecipeBookLibrary({
  books,
  recipes,
  basePath,
  accountSlug,
  initialRecipeIds,
  onChanged,
}: Props) {
  const scopeFields = accountSlug ? { accountSlug } : {};
  const createIds = initialRecipeIds ?? [];
  const [dialogOpen, setDialogOpen] = useState(
    Boolean(initialRecipeIds?.length),
  );
  const [editing, setEditing] = useState<RecipeBookWithRecipes | null>(null);
  const [, startTransition] = useTransition();

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(book: RecipeBookWithRecipes) {
    setEditing(book);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) setEditing(null);
  }

  function handleDelete(book: RecipeBookWithRecipes) {
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
      onChanged();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-xl text-sm text-[var(--workspace-shell-text-muted)]">
          A recipe book is a curated list you can share. Tick recipes on the
          Recipes tab, or start an empty book and add them here.
        </p>
        <Button
          onClick={openNew}
          style={{ backgroundColor: ACCENT }}
          className="text-[var(--workspace-shell-text)] hover:opacity-90"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New recipe book
        </Button>
      </div>

      {books.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--workspace-shell-border)] px-6 py-16 text-center">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-[var(--workspace-shell-text-muted)]" />
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            No recipe books yet. On the Recipes tab, tick a few recipes and tap
            Create recipe book — or start an empty book here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {books.map((book) => {
            const count = book.recipe_ids.length;
            return (
              <div
                key={book.id}
                className={cn(panelClass, 'flex flex-col p-4')}
              >
                <Link
                  href={buildRecipeBookDetailPath(basePath, book.id)}
                  className="min-w-0 flex-1 transition-opacity hover:opacity-90"
                >
                  <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                    {book.name}
                  </h3>
                  {book.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--workspace-shell-text-muted)]">
                      {book.description}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-[var(--workspace-shell-text-muted)]">
                    {count === 1 ? '1 recipe' : `${count} recipes`}
                  </p>
                </Link>
                <div className="mt-4 flex items-center gap-2 border-t border-[color:var(--workspace-shell-border)] pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(book)}
                    className="h-8 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(book)}
                    className="h-8 text-[var(--workspace-shell-text-muted)] hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RecipeBookDialog
        key={editing?.id ?? `new-${createIds.join(',')}`}
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        book={editing}
        recipes={recipes}
        initialRecipeIds={editing ? undefined : initialRecipeIds}
        accountSlug={accountSlug}
        onSaved={() => {
          setDialogOpen(false);
          setEditing(null);
          onChanged();
        }}
      />
    </div>
  );
}
