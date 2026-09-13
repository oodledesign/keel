'use client';

import { useMemo, useState, useTransition } from 'react';

import { ChevronDown, ChevronUp, Search } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { upsertRecipeBookAction } from '../_lib/recipe-book-actions';
import type {
  RecipeBookWithRecipes,
  RecipeRow,
} from '../_lib/schema/family-meal.schema';
import { ACCENT } from './meal-ui';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book?: RecipeBookWithRecipes | null;
  recipes: RecipeRow[];
  initialRecipeIds?: string[];
  accountSlug?: string;
  onSaved: (bookId: string) => void;
};

function bookRecipeIds(book?: RecipeBookWithRecipes | null) {
  return book?.recipe_ids ?? [];
}

export function RecipeBookDialog({
  open,
  onOpenChange,
  book = null,
  recipes,
  initialRecipeIds,
  accountSlug,
  onSaved,
}: Props) {
  const scopeFields = accountSlug ? { accountSlug } : {};
  const [name, setName] = useState(book?.name ?? '');
  const [description, setDescription] = useState(book?.description ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>(
    bookRecipeIds(book).length > 0
      ? bookRecipeIds(book)
      : (initialRecipeIds ?? []),
  );
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  const recipesById = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, recipe])),
    [recipes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (recipe) =>
        recipe.name.toLowerCase().includes(q) ||
        (recipe.description ?? '').toLowerCase().includes(q),
    );
  }, [recipes, query]);

  const selectedRecipes = selectedIds
    .map((id) => recipesById.get(id))
    .filter((recipe): recipe is RecipeRow => Boolean(recipe));

  function toggleRecipe(recipeId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(recipeId) ? current : [...current, recipeId];
      }
      return current.filter((id) => id !== recipeId);
    });
  }

  function moveRecipe(recipeId: string, direction: -1 | 1) {
    setSelectedIds((current) => {
      const index = current.indexOf(recipeId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (!moved) return current;
      next.splice(nextIndex, 0, moved);
      return next;
    });
  }

  function handleSave() {
    if (!name.trim()) {
      toast.error('Give the recipe book a name');
      return;
    }

    startTransition(async () => {
      const result = await upsertRecipeBookAction({
        id: book?.id,
        name: name.trim(),
        description: description.trim() || null,
        recipeIds: selectedIds,
        ...scopeFields,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(book ? 'Recipe book updated' : 'Recipe book created');
      onOpenChange(false);
      onSaved(result.data.id);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {book ? 'Edit recipe book' : 'New recipe book'}
          </DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            Collect recipes into a shareable, ordered book.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="recipe-book-name">Name</Label>
            <Input
              id="recipe-book-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Weeknight dinners"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recipe-book-desc">Description</Label>
            <Textarea
              id="recipe-book-desc"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional notes for anyone you share this with"
            />
          </div>

          <div className="space-y-2">
            <Label>Recipes</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search recipes"
                className="pl-9"
              />
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[color:var(--workspace-shell-border)] p-2">
              {filtered.length === 0 ? (
                <p className="px-2 py-3 text-sm text-[var(--workspace-shell-text-muted)]">
                  {recipes.length === 0
                    ? 'Add recipes to your library first.'
                    : 'No recipes match your search.'}
                </p>
              ) : (
                filtered.map((recipe) => {
                  const checked = selectedIds.includes(recipe.id);
                  return (
                    <label
                      key={recipe.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--workspace-shell-sidebar-accent)]"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleRecipe(recipe.id, value === true)
                        }
                      />
                      <span className="min-w-0 truncate">{recipe.name}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {selectedRecipes.length > 0 ? (
            <div className="space-y-2">
              <Label>Order</Label>
              <ol className="space-y-1">
                {selectedRecipes.map((recipe, index) => (
                  <li
                    key={recipe.id}
                    className="flex items-center gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] px-2 py-1.5 text-sm"
                  >
                    <span className="w-5 text-xs text-[var(--workspace-shell-text-muted)]">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {recipe.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => moveRecipe(recipe.id, -1)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Move down"
                      disabled={index === selectedRecipes.length - 1}
                      onClick={() => moveRecipe(recipe.id, 1)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            style={{ backgroundColor: ACCENT }}
            className="text-[var(--workspace-shell-text)] hover:opacity-90"
          >
            {isPending
              ? 'Saving…'
              : book
                ? 'Save changes'
                : 'Create recipe book'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
