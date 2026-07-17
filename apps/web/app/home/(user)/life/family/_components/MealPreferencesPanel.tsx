'use client';

import { useEffect, useState, useTransition } from 'react';

import { Minus, Plus, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { saveMealPreferencesAction } from '../_lib/actions';
import type { MealPreferencesRow } from '../_lib/schema/family-meal.schema';
import {
  ACCENT,
  dietaryChoices,
  panelClass,
  priorityChoices,
  titleCase,
} from './meal-ui';

type Props = {
  preferences: MealPreferencesRow;
  accountSlug?: string;
  onSaved: () => void;
};

export function MealPreferencesPanel({
  preferences,
  accountSlug,
  onSaved,
}: Props) {
  const scopeFields = accountSlug ? { accountSlug } : {};
  const [dietary, setDietary] = useState<string[]>(
    preferences.dietary_requirements,
  );
  const [priorities, setPriorities] = useState<string[]>(
    preferences.priorities,
  );
  const [dislikes, setDislikes] = useState<string[]>(
    preferences.disliked_ingredients,
  );
  const [householdSize, setHouseholdSize] = useState(
    preferences.household_size,
  );
  const [notes, setNotes] = useState(preferences.notes ?? '');
  const [customDietary, setCustomDietary] = useState('');
  const [dislikeInput, setDislikeInput] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDietary(preferences.dietary_requirements);
    setPriorities(preferences.priorities);
    setDislikes(preferences.disliked_ingredients);
    setHouseholdSize(preferences.household_size);
    setNotes(preferences.notes ?? '');
  }, [
    preferences.updated_at,
    preferences.dietary_requirements,
    preferences.priorities,
    preferences.disliked_ingredients,
    preferences.household_size,
    preferences.notes,
  ]);

  function toggle(
    value: string,
    list: string[],
    setList: (next: string[]) => void,
  ) {
    setList(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    );
  }

  function addCustomDietary() {
    const v = customDietary.trim().toLowerCase();
    if (v && !dietary.includes(v)) setDietary([...dietary, v]);
    setCustomDietary('');
  }

  function addDislike() {
    const v = dislikeInput.trim().toLowerCase();
    if (v && !dislikes.includes(v)) setDislikes([...dislikes, v]);
    setDislikeInput('');
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveMealPreferencesAction({
        dietary_requirements: dietary,
        priorities,
        disliked_ingredients: dislikes,
        household_size: householdSize,
        notes: notes.trim() || null,
        ...scopeFields,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Preferences saved');
      onSaved();
    });
  }

  const allDietary = Array.from(new Set([...dietaryChoices, ...dietary]));

  return (
    <div className="max-w-2xl space-y-5">
      <div className={cn(panelClass, 'p-5')}>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Dietary requirements
        </h3>
        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
          Hard constraints the generator must always respect.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {allDietary.map((option) => {
            const active = dietary.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggle(option, dietary, setDietary)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  active
                    ? 'border-transparent text-[var(--workspace-shell-text)]'
                    : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                )}
                style={active ? { backgroundColor: ACCENT } : undefined}
              >
                {option}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            value={customDietary}
            onChange={(e) => setCustomDietary(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomDietary();
              }
            }}
            placeholder="Add another (e.g. shellfish allergy)"
            className="h-9 text-sm"
          />
          <Button type="button" variant="outline" onClick={addCustomDietary}>
            Add
          </Button>
        </div>
      </div>

      <div className={cn(panelClass, 'p-5')}>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Priorities
        </h3>
        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
          What matters most when the planner suggests meals.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {priorityChoices.map((option) => {
            const active = priorities.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggle(option, priorities, setPriorities)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-transparent text-[var(--workspace-shell-text)]'
                    : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                )}
                style={active ? { backgroundColor: ACCENT } : undefined}
              >
                {titleCase(option)}
              </button>
            );
          })}
        </div>
      </div>

      <div className={cn(panelClass, 'p-5')}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Household size
            </h3>
            <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
              How many people you usually cook for.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setHouseholdSize((n) => Math.max(1, n - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-8 text-center text-lg font-semibold text-[var(--workspace-shell-text)]">
              {householdSize}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setHouseholdSize((n) => Math.min(30, n + 1))}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className={cn(panelClass, 'p-5')}>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Ingredients to avoid
        </h3>
        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
          Things the household dislikes (soft preference).
        </p>
        {dislikes.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {dislikes.map((item) => (
              <span
                key={item}
                className="flex items-center gap-1 rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-1 text-xs text-[var(--workspace-shell-text)] capitalize"
              >
                {item}
                <button
                  type="button"
                  onClick={() =>
                    setDislikes(dislikes.filter((d) => d !== item))
                  }
                  aria-label={`Remove ${item}`}
                >
                  <X className="h-3 w-3 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex gap-2">
          <Input
            value={dislikeInput}
            onChange={(e) => setDislikeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDislike();
              }
            }}
            placeholder="e.g. mushrooms"
            className="h-9 text-sm"
          />
          <Button type="button" variant="outline" onClick={addDislike}>
            Add
          </Button>
        </div>
      </div>

      <div className={cn(panelClass, 'p-5')}>
        <Label
          htmlFor="pref-notes"
          className="text-sm font-semibold text-[var(--workspace-shell-text)]"
        >
          Notes for the planner
        </Label>
        <Textarea
          id="pref-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything else? e.g. 'fish on Fridays', 'leftovers for lunch', 'kids hate spice'"
          className="mt-2"
        />
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isPending}
          style={{ backgroundColor: ACCENT }}
          className="text-[var(--workspace-shell-text)] hover:opacity-90"
        >
          {isPending ? 'Saving…' : 'Save preferences'}
        </Button>
      </div>
    </div>
  );
}
