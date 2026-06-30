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
  accountSlug?: string;
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
  accountSlug,
  onSaved,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
        {open && date ? (
          <MealDayEditForm
            key={`${date}-${entry?.updated_at ?? 'new'}`}
            date={date}
            entry={entry}
            recipes={recipes}
            accountSlug={accountSlug}
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
  accountSlug,
  onClose,
  onSaved,
}: {
  date: string;
  entry: MealEntryRow | null;
  recipes: RecipeRow[];
  accountSlug?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const scopeFields = accountSlug ? { accountSlug } : {};
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
        ...scopeFields,
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
        ...scopeFields,
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
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">{weekdayLabel(date)} · Dinner</p>
      </DialogHeader>

      <div className="space-y-3">
        {recipes.length > 0 ? (
          <select
            value={recipeId ?? ''}
            onChange={(e) => handleRecipeSelect(e.target.value)}
            className="h-9 w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 text-sm text-[var(--workspace-shell-text)] outline-none focus:border-[color:var(--workspace-shell-border)]"
          >
            <option value="" className="bg-[var(--ozer-surface-panel)]">
              Pick from library or type below
            </option>
            {recipes.map((recipe) => (
              <option
                key={recipe.id}
                value={recipe.id}
                className="bg-[var(--ozer-surface-panel)]"
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
            className="mr-auto text-[var(--workspace-shell-text-muted)] hover:text-rose-300"
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
          className="text-[var(--workspace-shell-text)] hover:opacity-90"
        >
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </>
  );
}
