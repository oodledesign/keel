'use client';

import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
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
import { cn } from '@kit/ui/utils';

import { upsertRecipeAction } from '../_lib/actions';
import {
  RECIPE_MEAL_TYPES,
  type RecipeInput,
  type RecipeMealType,
  type RecipeRow,
} from '../_lib/schema/family-meal.schema';
import { ACCENT, dietaryChoices, mealTypeLabels, priorityChoices } from './meal-ui';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: RecipeRow | null;
  onSaved: () => void;
};

const suggestedTags = [...priorityChoices, ...dietaryChoices];

function toForm(recipe: RecipeRow | null) {
  return {
    name: recipe?.name ?? '',
    description: recipe?.description ?? '',
    ingredients: (recipe?.ingredients ?? []).join('\n'),
    instructions: recipe?.instructions ?? '',
    tags: recipe?.tags ?? [],
    meal_type: (recipe?.meal_type ?? 'dinner') as RecipeMealType,
    prep_minutes: recipe?.prep_minutes?.toString() ?? '',
    cook_minutes: recipe?.cook_minutes?.toString() ?? '',
    servings: recipe?.servings?.toString() ?? '',
    is_favorite: recipe?.is_favorite ?? false,
  };
}

export function RecipeDialog({ open, onOpenChange, recipe, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[var(--workspace-shell-panel)] text-white sm:max-w-lg">
        {open ? (
          <RecipeForm
            key={recipe?.id ?? 'new'}
            recipe={recipe}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RecipeForm({
  recipe,
  onClose,
  onSaved,
}: {
  recipe: RecipeRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => toForm(recipe));
  const [customTag, setCustomTag] = useState('');
  const [isPending, startTransition] = useTransition();

  function toggleTag(tag: string) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag)
        ? f.tags.filter((t) => t !== tag)
        : [...f.tags, tag],
    }));
  }

  function addCustomTag() {
    const tag = customTag.trim().toLowerCase();
    if (!tag) return;
    if (!form.tags.includes(tag)) {
      setForm((f) => ({ ...f, tags: [...f.tags, tag] }));
    }
    setCustomTag('');
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error('Give the recipe a name');
      return;
    }

    const toNum = (v: string) => {
      const n = Number.parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    };

    const payload: RecipeInput = {
      id: recipe?.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      ingredients: form.ingredients
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      instructions: form.instructions.trim() || null,
      tags: form.tags,
      meal_type: form.meal_type,
      prep_minutes: toNum(form.prep_minutes),
      cook_minutes: toNum(form.cook_minutes),
      servings: toNum(form.servings),
      is_favorite: form.is_favorite,
    };

    startTransition(async () => {
      const result = await upsertRecipeAction(payload);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(recipe ? 'Recipe updated' : 'Recipe added');
      onClose();
      onSaved();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{recipe ? 'Edit recipe' : 'Add recipe'}</DialogTitle>
        <DialogDescription className="text-zinc-400">
          Build your library so the planner can reuse meals you love.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="recipe-name">Name</Label>
          <Input
            id="recipe-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Chicken stir fry"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="recipe-desc">Description</Label>
          <Textarea
            id="recipe-desc"
            rows={2}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="One-line summary"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="recipe-prep">Prep (min)</Label>
            <Input
              id="recipe-prep"
              inputMode="numeric"
              value={form.prep_minutes}
              onChange={(e) =>
                setForm((f) => ({ ...f, prep_minutes: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipe-cook">Cook (min)</Label>
            <Input
              id="recipe-cook"
              inputMode="numeric"
              value={form.cook_minutes}
              onChange={(e) =>
                setForm((f) => ({ ...f, cook_minutes: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipe-servings">Serves</Label>
            <Input
              id="recipe-servings"
              inputMode="numeric"
              value={form.servings}
              onChange={(e) =>
                setForm((f) => ({ ...f, servings: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipe-meal">Meal</Label>
            <select
              id="recipe-meal"
              value={form.meal_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  meal_type: e.target.value as RecipeMealType,
                }))
              }
              className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-2 text-sm text-white outline-none focus:border-white/25"
            >
              {RECIPE_MEAL_TYPES.map((mt) => (
                <option key={mt} value={mt} className="bg-[#0F1B35]">
                  {mealTypeLabels[mt]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="recipe-ingredients">Ingredients</Label>
          <Textarea
            id="recipe-ingredients"
            rows={4}
            value={form.ingredients}
            onChange={(e) =>
              setForm((f) => ({ ...f, ingredients: e.target.value }))
            }
            placeholder="One ingredient per line"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="recipe-instructions">Instructions</Label>
          <Textarea
            id="recipe-instructions"
            rows={4}
            value={form.instructions}
            onChange={(e) =>
              setForm((f) => ({ ...f, instructions: e.target.value }))
            }
            placeholder="Optional method / steps"
          />
        </div>

        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set([...suggestedTags, ...form.tags])).map((tag) => {
              const active = form.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
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
          <div className="flex gap-2">
            <Input
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomTag();
                }
              }}
              placeholder="Add custom tag"
              className="h-8 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCustomTag}
            >
              Add
            </Button>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={form.is_favorite}
            onChange={(e) =>
              setForm((f) => ({ ...f, is_favorite: e.target.checked }))
            }
            className="h-4 w-4 accent-[#059669]"
          />
          Mark as favourite
        </label>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isPending}
          style={{ backgroundColor: ACCENT }}
          className="text-white hover:opacity-90"
        >
          {isPending ? 'Saving…' : recipe ? 'Save changes' : 'Add recipe'}
        </Button>
      </DialogFooter>
    </>
  );
}
