'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import { CalendarDays } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { setMealEntryAction } from '../_lib/actions';
import type {
  MealEntryRow,
  RecipeRow,
} from '../_lib/schema/family-meal.schema';
import {
  mondayWeekStart,
  weekDatesFrom,
  weekdayLabel,
} from '../_lib/server/family-meal.dates';
import { ACCENT, isLeftoversMeal } from './meal-ui';

type Props = {
  recipe: RecipeRow;
  weekDates?: string[];
  weekEntries?: MealEntryRow[];
  accountSlug?: string;
  planHref: string;
};

export function RecipePlanAssignDialog({
  recipe,
  weekDates,
  weekEntries = [],
  accountSlug,
  planHref,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const scopeFields = accountSlug ? { accountSlug } : {};
  const dates = weekDates?.length
    ? weekDates
    : weekDatesFrom(mondayWeekStart());

  const entryByDate = useMemo(() => {
    const map = new Map<string, MealEntryRow>();
    for (const entry of weekEntries) {
      if (entry.meal_type === 'dinner') map.set(entry.plan_date, entry);
    }
    return map;
  }, [weekEntries]);

  function assign(date: string) {
    startTransition(async () => {
      const result = await setMealEntryAction({
        planDate: date,
        mealType: 'dinner',
        title: recipe.name,
        recipeId: recipe.id,
        notes: null,
        ...scopeFields,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Added to ${weekdayLabel(date)}`);
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={() => setOpen(true)}
      >
        <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
        Add to this week
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to this week</DialogTitle>
            <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
              Pick a dinner. This uses the recipe so shopping can pull
              ingredients. Leftovers can be typed on the plan instead.
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-1.5">
            {dates.map((date) => {
              const entry = entryByDate.get(date);
              const alreadyThis = entry?.recipe_id === recipe.id;
              return (
                <li key={date}>
                  <button
                    type="button"
                    disabled={isPending || alreadyThis}
                    onClick={() => assign(date)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-opacity hover:opacity-90',
                      alreadyThis
                        ? 'border-[color:color-mix(in_srgb,var(--ozer-accent)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--ozer-accent)_10%,transparent)]'
                        : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]',
                    )}
                  >
                    <span>
                      <span className="block text-sm font-medium">
                        {weekdayLabel(date)}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">
                        {entry?.title
                          ? alreadyThis
                            ? 'Already this recipe'
                            : isLeftoversMeal(entry.title)
                              ? `Replace leftovers: ${entry.title}`
                              : `Replace ${entry.title}`
                          : 'Empty — add dinner'}
                      </span>
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: ACCENT }}
                    >
                      {alreadyThis ? 'Keep' : entry?.title ? 'Replace' : 'Add'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href={planHref}>Open meal plan</Link>
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
