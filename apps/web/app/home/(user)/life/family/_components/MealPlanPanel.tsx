'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  applyGeneratedWeekAction,
  clearMealEntryAction,
  setMealEntryAction,
} from '../_lib/actions';
import {
  addDays,
  chunkDates,
  monthCalendarGrid,
  monthLabel,
  shiftMonth,
  toYmd,
  weekdayLabel,
} from '../_lib/server/family-meal.dates';
import type {
  MealEntryRow,
  MealPlanView,
  MealPreferencesRow,
  RecipeRow,
} from '../_lib/schema/family-meal.schema';
import { MealDayEditDialog } from './MealDayEditDialog';
import { ACCENT, panelClass, titleCase } from './meal-ui';

type GeneratedMeal = {
  date: string;
  title: string;
  description: string;
  tags: string[];
  recipeId: string | null;
};

type Props = {
  view: MealPlanView;
  weekStart: string;
  weekDates: string[];
  monthKey: string;
  planDates: string[];
  entries: MealEntryRow[];
  recipes: RecipeRow[];
  preferences: MealPreferencesRow;
  onChanged: () => void;
};

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function shiftWeek(weekStart: string, deltaWeeks: number): string {
  return addDays(weekStart, deltaWeeks * 7);
}

function rangeLabel(dates: string[]): string {
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return '';
  const fmt = (ymd: string) => {
    const [y, mo, da] = ymd.split('-').map(Number);
    return new Date(y!, mo! - 1, da!).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  };
  return `${fmt(first)} – ${fmt(last)}`;
}

function familyMealUrl(view: MealPlanView, weekStart: string, monthKey: string) {
  if (view === 'month') {
    return `/home/life/family?view=month&month=${monthKey}`;
  }
  return `/home/life/family?view=week&week=${weekStart}`;
}

export function MealPlanPanel({
  view,
  weekStart,
  weekDates,
  monthKey,
  planDates,
  entries,
  recipes,
  preferences,
  onChanged,
}: Props) {
  const router = useRouter();
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [inlineEditDate, setInlineEditDate] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftRecipeId, setDraftRecipeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const today = toYmd(new Date());

  const entriesByDate = useMemo(() => {
    const map = new Map<string, MealEntryRow>();
    for (const entry of entries) {
      if (entry.meal_type === 'dinner') map.set(entry.plan_date, entry);
    }
    return map;
  }, [entries]);

  const recipeById = useMemo(
    () => new Map(recipes.map((r) => [r.id, r])),
    [recipes],
  );

  const emptyDates = planDates.filter((d) => !entriesByDate.get(d)?.title);
  const filledCount = planDates.length - emptyDates.length;

  const monthGrid = useMemo(
    () => (view === 'month' ? monthCalendarGrid(monthKey) : []),
    [view, monthKey],
  );

  function setView(next: MealPlanView) {
    router.push(familyMealUrl(next, weekStart, monthKey));
  }

  function goPrev() {
    if (view === 'month') {
      router.push(
        `/home/life/family?view=month&month=${shiftMonth(monthKey, -1)}`,
      );
      return;
    }
    router.push(
      `/home/life/family?view=week&week=${shiftWeek(weekStart, -1)}`,
    );
  }

  function goNext() {
    if (view === 'month') {
      router.push(
        `/home/life/family?view=month&month=${shiftMonth(monthKey, 1)}`,
      );
      return;
    }
    router.push(
      `/home/life/family?view=week&week=${shiftWeek(weekStart, 1)}`,
    );
  }

  function openEdit(date: string) {
    if (view === 'month') {
      setEditingDate(date);
      return;
    }
    const entry = entriesByDate.get(date);
    setInlineEditDate(date);
    setDraftTitle(entry?.title ?? '');
    setDraftRecipeId(entry?.recipe_id ?? null);
  }

  async function saveInlineEdit(date: string) {
    const title = draftTitle.trim();
    setIsSaving(true);
    try {
      if (!title) {
        const result = await clearMealEntryAction({
          planDate: date,
          mealType: 'dinner',
        });
        if (!result.success) throw new Error(result.error);
      } else {
        const result = await setMealEntryAction({
          planDate: date,
          mealType: 'dinner',
          title,
          recipeId: draftRecipeId,
          notes: null,
        });
        if (!result.success) throw new Error(result.error);
      }
      setInlineEditDate(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClear(date: string) {
    setIsSaving(true);
    try {
      const result = await clearMealEntryAction({
        planDate: date,
        mealType: 'dinner',
      });
      if (!result.success) throw new Error(result.error);
      setInlineEditDate(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not clear');
    } finally {
      setIsSaving(false);
    }
  }

  async function runGenerator(mode: 'generate' | 'fill') {
    const dates = mode === 'fill' ? emptyDates : planDates;
    if (dates.length === 0) {
      toast.info('Every day already has a meal — try "Generate" to replace.');
      return;
    }

    setIsGenerating(true);
    try {
      const allMeals: GeneratedMeal[] = [];
      const chunks = chunkDates(dates, 7);

      for (const chunk of chunks) {
        const response = await fetch('/api/family/meal-plan/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode, dates: chunk }),
        });
        const body = (await response.json()) as {
          meals?: GeneratedMeal[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error ?? 'Could not generate meal plan');
        }
        allMeals.push(...(body.meals ?? []));
      }

      if (allMeals.length === 0) {
        throw new Error('The planner did not return any meals');
      }

      const result = await applyGeneratedWeekAction({
        entries: allMeals.map((meal) => ({
          planDate: meal.date,
          mealType: 'dinner',
          title: meal.title,
          notes: meal.description || null,
          recipeId: meal.recipeId ?? null,
        })),
      });
      if (!result.success) {
        throw new Error(result.error);
      }

      const periodLabel = view === 'month' ? 'month' : 'week';
      toast.success(
        mode === 'fill'
          ? `Filled ${allMeals.length} day${allMeals.length === 1 ? '' : 's'}`
          : `Generated this ${periodLabel}’s meals`,
      );
      onChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not generate meal plan',
      );
    } finally {
      setIsGenerating(false);
    }
  }

  const hasDietary = preferences.dietary_requirements.length > 0;
  const hasPriorities = preferences.priorities.length > 0;
  const periodTitle =
    view === 'month' ? monthLabel(monthKey) : rangeLabel(weekDates);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-white/8 bg-white/[0.03] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setView('week')}
              className={cn(
                'rounded-md px-3 py-1.5 font-medium transition-colors',
                view === 'week'
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white',
              )}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setView('month')}
              className={cn(
                'rounded-md px-3 py-1.5 font-medium transition-colors',
                view === 'month'
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white',
              )}
            >
              Month
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={goPrev}
              aria-label={view === 'month' ? 'Previous month' : 'Previous week'}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[140px] text-center">
              <p className="text-sm font-semibold text-white">{periodTitle}</p>
              <p className="text-xs text-zinc-400">
                {filledCount}/{planDates.length} planned
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={goNext}
              aria-label={view === 'month' ? 'Next month' : 'Next week'}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => runGenerator('fill')}
            disabled={isGenerating || emptyDates.length === 0}
          >
            {isGenerating ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-1.5 h-4 w-4" />
            )}
            Fill gaps
          </Button>
          <Button
            onClick={() => runGenerator('generate')}
            disabled={isGenerating}
            style={{ backgroundColor: ACCENT }}
            className="text-white hover:opacity-90"
          >
            {isGenerating ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            Generate plan
          </Button>
        </div>
      </div>

      {hasDietary || hasPriorities ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-zinc-500">Planning for:</span>
          {preferences.dietary_requirements.map((d) => (
            <span
              key={`d-${d}`}
              className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 capitalize text-emerald-200"
            >
              {d}
            </span>
          ))}
          {preferences.priorities.map((p) => (
            <span
              key={`p-${p}`}
              className="rounded-full bg-white/[0.06] px-2 py-0.5 text-zinc-300"
            >
              {titleCase(p)}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          Tip: set dietary requirements and preferences in the Preferences tab to
          tailor the generator.
        </p>
      )}

      {view === 'month' ? (
        <div className={cn(panelClass, 'p-3 sm:p-4')}>
          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAY_HEADERS.map((label) => (
              <div
                key={label}
                className="py-1 text-center text-[11px] font-medium uppercase text-zinc-500"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthGrid.map((cell) => {
              const entry = entriesByDate.get(cell.date);
              const isToday = cell.date === today;
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => cell.inMonth && openEdit(cell.date)}
                  disabled={!cell.inMonth}
                  className={cn(
                    'flex min-h-[72px] flex-col rounded-lg border p-1.5 text-left transition-colors sm:min-h-[88px] sm:p-2',
                    cell.inMonth
                      ? 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]'
                      : 'border-transparent bg-transparent opacity-30',
                    isToday && cell.inMonth && 'border-[#5eead4]/30 bg-[#5eead4]/5',
                  )}
                >
                  <span
                    className={cn(
                      'text-[11px] font-semibold sm:text-xs',
                      isToday ? 'text-[#5eead4]' : 'text-zinc-400',
                    )}
                  >
                    {Number(cell.date.slice(8, 10))}
                  </span>
                  {cell.inMonth && entry?.title ? (
                    <span className="mt-1 line-clamp-2 text-[10px] font-medium leading-tight text-white sm:text-xs">
                      {entry.title}
                    </span>
                  ) : cell.inMonth ? (
                    <span className="mt-1 text-[10px] text-zinc-600">+</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={cn(panelClass, 'divide-y divide-white/6')}>
          {weekDates.map((date) => {
            const entry = entriesByDate.get(date);
            const recipe = entry?.recipe_id
              ? recipeById.get(entry.recipe_id)
              : null;
            const isToday = date === today;
            const isEditing = inlineEditDate === date;

            return (
              <div key={date} className="px-4 py-3">
                <div className="flex items-start gap-4">
                  <div className="w-14 shrink-0 pt-0.5">
                    <p
                      className={cn(
                        'text-xs font-semibold uppercase',
                        isToday ? 'text-[#5eead4]' : 'text-zinc-400',
                      )}
                    >
                      {weekdayLabel(date).slice(0, 3)}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {Number(date.slice(8, 10))}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        {recipes.length > 0 ? (
                          <select
                            value={draftRecipeId ?? ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (!value) {
                                setDraftRecipeId(null);
                                return;
                              }
                              const r = recipeById.get(value);
                              setDraftRecipeId(value);
                              if (r) setDraftTitle(r.name);
                            }}
                            className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-2 text-sm text-white outline-none focus:border-white/25"
                          >
                            <option value="" className="bg-[#0F1B35]">
                              Free text / no recipe
                            </option>
                            {recipes.map((r) => (
                              <option
                                key={r.id}
                                value={r.id}
                                className="bg-[#0F1B35]"
                              >
                                {r.name}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <Input
                          autoFocus
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveInlineEdit(date);
                            if (e.key === 'Escape') setInlineEditDate(null);
                          }}
                          placeholder="What's for dinner?"
                          className="h-9 text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => void saveInlineEdit(date)}
                            disabled={isSaving}
                            style={{ backgroundColor: ACCENT }}
                            className="h-8 text-white hover:opacity-90"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setInlineEditDate(null)}
                            disabled={isSaving}
                            className="h-8 text-zinc-400"
                          >
                            Cancel
                          </Button>
                          {entry?.title ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleClear(date)}
                              disabled={isSaving}
                              className="ml-auto h-8 text-zinc-400 hover:text-rose-300"
                            >
                              Clear
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openEdit(date)}
                        className="group flex w-full items-start justify-between gap-3 text-left"
                      >
                        <div className="min-w-0">
                          {entry?.title ? (
                            <>
                              <p className="truncate text-sm font-medium text-white">
                                {entry.title}
                              </p>
                              {entry.notes ? (
                                <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">
                                  {entry.notes}
                                </p>
                              ) : null}
                              {recipe && recipe.tags.length > 0 ? (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {recipe.tags.slice(0, 3).map((tag) => (
                                    <span
                                      key={tag}
                                      className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] capitalize text-zinc-400"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-sm text-zinc-500 group-hover:text-zinc-300">
                              + Add a meal
                            </span>
                          )}
                        </div>
                      </button>
                    )}
                  </div>

                  {!isEditing && entry?.title ? (
                    <button
                      type="button"
                      onClick={() => void handleClear(date)}
                      disabled={isSaving}
                      aria-label="Clear meal"
                      className="shrink-0 text-zinc-600 hover:text-rose-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MealDayEditDialog
        open={editingDate !== null}
        onOpenChange={(open) => {
          if (!open) setEditingDate(null);
        }}
        date={editingDate}
        entry={editingDate ? (entriesByDate.get(editingDate) ?? null) : null}
        recipes={recipes}
        onSaved={onChanged}
      />
    </div>
  );
}
