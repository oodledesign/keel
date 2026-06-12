'use client';

import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import { clearMealEntryAction, setMealEntryAction } from '../_lib/actions';
import { weekdayLabel } from '../_lib/server/family-meal.dates';
import type { MealEntryRow, RecipeRow } from '../_lib/schema/family-meal.schema';
import { ACCENT } from './meal-ui';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string | null;
  entry: MealEntryRow | null;
  recipes: RecipeRow[];
  onSaved: () => void;
};

function formatDateLabel(date: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(y!, mo! - 1, d!).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function MealDayEditDialog({
  open,
  onOpenChange,
  date,
  entry,
  recipes,
  onSaved,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[var(--workspace-shell-panel)] text-white sm:max-w-md">
        {open && date ? (
          <MealDayEditForm
            key={`${date}-${entry?.updated_at ?? 'new'}`}
            date={date}
            entry={entry}
            recipes={recipes}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MealDayEditForm({
  date,
  entry,
  recipes,
  onClose,
  onSaved,
}: {
  date: string;
  entry: MealEntryRow | null;
  recipes: RecipeRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(entry?.title ?? '');
  const [recipeId, setRecipeId] = useState<string | null>(
    entry?.recipe_id ?? null,
  );
  const [isPending, startTransition] = useTransition();

  function handleRecipeSelect(value: string) {
    if (!value) {
      setRecipeId(null);
      return;
    }
    const recipe = recipes.find((r) => r.id === value);
    setRecipeId(value);
    if (recipe) setTitle(recipe.name);
  }

  function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) {
      handleClear();
      return;
    }

    startTransition(async () => {
      const result = await setMealEntryAction({
        planDate: date,
        mealType: 'dinner',
        title: trimmed,
        recipeId,
        notes: null,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onClose();
      onSaved();
    });
  }

  function handleClear() {
    startTransition(async () => {
      const result = await clearMealEntryAction({
        planDate: date,
        mealType: 'dinner',
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onClose();
      onSaved();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{formatDateLabel(date)}</DialogTitle>
        <p className="text-xs text-zinc-400">{weekdayLabel(date)} · Dinner</p>
      </DialogHeader>

      <div className="space-y-3">
        {recipes.length > 0 ? (
          <select
            value={recipeId ?? ''}
            onChange={(e) => handleRecipeSelect(e.target.value)}
            className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-2 text-sm text-white outline-none focus:border-white/25"
          >
            <option value="" className="bg-[#0F1B35]">
              Pick from library or type below
            </option>
            {recipes.map((recipe) => (
              <option
                key={recipe.id}
                value={recipe.id}
                className="bg-[#0F1B35]"
              >
                {recipe.name}
              </option>
            ))}
          </select>
        ) : null}
        <Input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
          placeholder="What's for dinner?"
        />
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        {entry?.title ? (
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            disabled={isPending}
            className="mr-auto text-zinc-400 hover:text-rose-300"
          >
            Clear
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          style={{ backgroundColor: ACCENT }}
          className="text-white hover:opacity-90"
        >
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </>
  );
}
