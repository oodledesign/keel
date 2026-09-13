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

import { findHouseholdDietaryConflicts } from '~/lib/meals/dietary-conflict';
import { leftoverMealTitle } from '~/lib/meals/leftover-plan';

import { clearMealEntryAction, setMealEntryAction } from '../_lib/actions';
import type {
  HouseholdMemberRow,
  MealEntryRow,
  MealPreferencesRow,
  RecipeRow,
} from '../_lib/schema/family-meal.schema';
import { weekdayLabel } from '../_lib/server/family-meal.dates';
import { ACCENT } from './meal-ui';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string | null;
  entry: MealEntryRow | null;
  recipes: RecipeRow[];
  members?: HouseholdMemberRow[];
  preferences?: MealPreferencesRow;
  weekEntries?: MealEntryRow[];
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
  members = [],
  preferences,
  weekEntries = [],
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
            members={members}
            preferences={preferences}
            weekEntries={weekEntries}
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
  members,
  preferences,
  weekEntries,
  accountSlug,
  onClose,
  onSaved,
}: {
  date: string;
  entry: MealEntryRow | null;
  recipes: RecipeRow[];
  members: HouseholdMemberRow[];
  preferences?: MealPreferencesRow;
  weekEntries: MealEntryRow[];
  accountSlug?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const scopeFields = accountSlug ? { accountSlug } : {};
  const [title, setTitle] = useState(entry?.title ?? '');
  const [recipeId, setRecipeId] = useState<string | null>(
    entry?.recipe_id ?? null,
  );
  const [cookMemberId, setCookMemberId] = useState<string | null>(
    entry?.cook_member_id ?? null,
  );
  const [isBatchPrep, setIsBatchPrep] = useState(
    Boolean(entry?.is_batch_prep),
  );
  const [leftoverSourceId, setLeftoverSourceId] = useState<string | null>(
    entry?.leftover_source_entry_id ?? null,
  );
  const [isPending, startTransition] = useTransition();
  const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);
  const warnings = selectedRecipe
    ? findHouseholdDietaryConflicts({
        recipe: {
          name: selectedRecipe.name,
          diet_tags: selectedRecipe.diet_tags,
          ingredients: selectedRecipe.ingredients,
          tags: selectedRecipe.tags,
        },
        people: members.map((member) => ({
          name: member.display_name,
          dietary_tags: member.dietary_tags,
          excluded_ingredients: member.excluded_ingredients,
        })),
        householdDietaryTags: preferences?.dietary_requirements,
        householdDislikes: preferences?.disliked_ingredients,
      })
    : [];
  const leftoverSources = weekEntries.filter(
    (item) =>
      item.plan_date < date &&
      item.title.trim() &&
      !item.leftover_source_entry_id,
  );

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
        cookMemberId,
        isBatchPrep,
        leftoverSourceEntryId: leftoverSourceId,
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
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {weekdayLabel(date)} · Dinner
        </p>
      </DialogHeader>

      <div className="space-y-3">
        {recipes.length > 0 ? (
          <select
            value={recipeId ?? ''}
            onChange={(e) => handleRecipeSelect(e.target.value)}
            className="h-9 w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 text-sm text-[var(--workspace-shell-text)] outline-none focus:border-[color:var(--workspace-shell-border)]"
          >
            <option value="" className="bg-[var(--ozer-surface-panel)]">
              Pick a recipe, or type a custom meal below
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
        ) : (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Your recipe library is empty. Type a dinner name for now — add
            recipes later if you want ingredients on the shopping list.
          </p>
        )}
        {warnings.length > 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {warnings.map((warning) => (
              <p key={warning.message}>{warning.message}</p>
            ))}
          </div>
        ) : null}
        {members.length > 0 ? (
          <select
            value={cookMemberId ?? ''}
            onChange={(e) => setCookMemberId(e.target.value || null)}
            className="h-9 w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 text-sm"
          >
            <option value="">Who cooks?</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.display_name}
              </option>
            ))}
          </select>
        ) : null}
        <label className="flex items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
          <input
            type="checkbox"
            checked={isBatchPrep}
            onChange={(e) => setIsBatchPrep(e.target.checked)}
            className="h-4 w-4 accent-[var(--ozer-accent)]"
          />
          Batch / prep cook (feeds leftover days)
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setRecipeId(null);
              setLeftoverSourceId(null);
              setIsBatchPrep(false);
              setTitle('Leftovers');
            }}
            className="rounded-full border border-[color:var(--workspace-shell-border)] px-2.5 py-1 text-xs text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
          >
            Leftovers
          </button>
          {leftoverSources.slice(0, 4).map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => {
                setLeftoverSourceId(source.id);
                setRecipeId(source.recipe_id);
                setIsBatchPrep(false);
                setTitle(leftoverMealTitle(source.title));
              }}
              className="rounded-full border border-[color:var(--workspace-shell-border)] px-2.5 py-1 text-xs text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
            >
              From {source.title}
            </button>
          ))}
          <span className="self-center text-[11px] text-[var(--workspace-shell-text-muted)]">
            Leftovers skip the shopping list
          </span>
        </div>
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
