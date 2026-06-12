'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import {
  Clock,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { deleteRecipeAction, toggleRecipeFavoriteAction } from '../_lib/actions';
import { buildRecipeDetailPath } from '../_lib/family-meal.paths';
import type { RecipeRow } from '../_lib/schema/family-meal.schema';
import { RecipeDialog } from './RecipeDialog';
import { RecipeGenerateDialog } from './RecipeGenerateDialog';
import { ACCENT, panelClass, totalTimeLabel } from './meal-ui';

type Props = {
  recipes: RecipeRow[];
  preferences: import('../_lib/schema/family-meal.schema').MealPreferencesRow;
  basePath: string;
  accountSlug?: string;
  onChanged: () => void;
};

export function RecipeLibrary({
  recipes,
  preferences,
  basePath,
  accountSlug,
  onChanged,
}: Props) {
  const scopeFields = accountSlug ? { accountSlug } : {};
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editing, setEditing] = useState<RecipeRow | null>(null);
  const [, startTransition] = useTransition();

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipes) for (const t of r.tags) set.add(t);
    return Array.from(set).sort();
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      const matchesQuery =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.toLowerCase().includes(q));
      const matchesTag = !activeTag || r.tags.includes(activeTag);
      return matchesQuery && matchesTag;
    });
  }, [recipes, query, activeTag]);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(recipe: RecipeRow) {
    setEditing(recipe);
    setDialogOpen(true);
  }

  function handleDelete(recipe: RecipeRow) {
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
      onChanged();
    });
  }

  function handleFavorite(recipe: RecipeRow) {
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
      onChanged();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setGenerateOpen(true)}>
            <Sparkles className="mr-1.5 h-4 w-4" />
            Generate with AI
          </Button>
          <Button
            onClick={openNew}
            style={{ backgroundColor: ACCENT }}
            className="text-white hover:opacity-90"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add recipe
          </Button>
        </div>
      </div>

      {allTags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              !activeTag
                ? 'border-transparent text-white'
                : 'border-white/10 text-zinc-400 hover:text-white',
            )}
            style={!activeTag ? { backgroundColor: ACCENT } : undefined}
          >
            All
          </button>
          {allTags.map((tag) => {
            const active = activeTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(active ? null : tag)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                  active
                    ? 'border-transparent text-white'
                    : 'border-white/10 text-zinc-400 hover:text-white',
                )}
                style={active ? { backgroundColor: ACCENT } : undefined}
              >
                {tag}
              </button>
            );
          })}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/8 px-6 py-16 text-center">
          <UtensilsCrossed className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-400">
            {recipes.length === 0
              ? 'No recipes yet. Add your family favourites to get started.'
              : 'No recipes match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((recipe) => {
            const time = totalTimeLabel(
              recipe.prep_minutes,
              recipe.cook_minutes,
            );
            return (
              <div
                key={recipe.id}
                className={cn(panelClass, 'flex flex-col p-4')}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={buildRecipeDetailPath(basePath, recipe.id)}
                    className="min-w-0 flex-1 transition-opacity hover:opacity-90"
                  >
                    <h3 className="text-sm font-semibold text-white">
                      {recipe.name}
                    </h3>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleFavorite(recipe)}
                    aria-label="Toggle favourite"
                    className="shrink-0"
                  >
                    <Star
                      className={cn(
                        'h-4 w-4',
                        recipe.is_favorite
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-zinc-600 hover:text-zinc-400',
                      )}
                    />
                  </button>
                </div>

                <Link
                  href={buildRecipeDetailPath(basePath, recipe.id)}
                  className="mt-1 block min-w-0 flex-1 transition-opacity hover:opacity-90"
                >
                  {recipe.description ? (
                    <p className="line-clamp-2 text-xs text-zinc-400">
                      {recipe.description}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    {time ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {time}
                      </span>
                    ) : null}
                    {recipe.servings ? (
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {recipe.servings}
                      </span>
                    ) : null}
                  </div>

                  {recipe.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {recipe.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] capitalize text-zinc-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </Link>

                <div className="mt-4 flex items-center gap-2 border-t border-white/6 pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(recipe)}
                    className="h-8 text-zinc-300 hover:text-white"
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(recipe)}
                    className="h-8 text-zinc-400 hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RecipeGenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        preferences={preferences}
        recipes={recipes}
        accountSlug={accountSlug}
        onSaved={onChanged}
      />

      <RecipeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        recipe={editing}
        accountSlug={accountSlug}
        onSaved={onChanged}
      />
    </div>
  );
}
