'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { ChevronLeft, ChevronRight, Sparkles, Wand2, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { clearMealEntryAction, setMealEntryAction } from '../_lib/actions';
import type {
  MealEntryRow,
  MealPlanView,
  MealPreferencesRow,
  RecipeRow,
} from '../_lib/schema/family-meal.schema';
import {
  addDays,
  mealPlanUrl,
  monthCalendarGrid,
  monthLabel,
  shiftMonth,
  toYmd,
  weekdayLabel,
} from '../_lib/server/family-meal.dates';
import { MealDayEditDialog } from './MealDayEditDialog';
import { MealPlanGenerateDialog } from './MealPlanGenerateDialog';
import { ACCENT, panelClass, titleCase } from './meal-ui';

type Props = {
  view: MealPlanView;
  weekStart: string;
  weekDates: string[];
  monthKey: string;
  planDates: string[];
  entries: MealEntryRow[];
  recipes: RecipeRow[];
  preferences: MealPreferencesRow;
  basePath: string;
  accountSlug?: string;
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

export function MealPlanPanel({
  view,
  weekStart,
  weekDates,
  monthKey,
  planDates,
  entries,
  recipes,
  preferences,
  basePath,
  accountSlug,
  onChanged,
}: Props) {
  const router = useRouter();
  const scopeFields = accountSlug ? { accountSlug } : {};
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [inlineEditDate, setInlineEditDate] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftRecipeId, setDraftRecipeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [generateDialog, setGenerateDialog] = useState<{
    open: boolean;
    mode: 'fill' | 'generate';
  }>({ open: false, mode: 'fill' });

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

  const emptyDates = planDates.filter(
    (d) => !entriesByDate.get(d)?.title?.trim(),
  );
  const filledCount = planDates.length - emptyDates.length;

  const monthGrid = useMemo(
    () => (view === 'month' ? monthCalendarGrid(monthKey) : []),
    [view, monthKey],
  );

  function setView(next: MealPlanView) {
    router.push(mealPlanUrl(basePath, next, weekStart, monthKey));
  }

  function goPrev() {
    if (view === 'month') {
      router.push(
        mealPlanUrl(basePath, 'month', weekStart, shiftMonth(monthKey, -1)),
      );
      return;
    }
    router.push(
      mealPlanUrl(basePath, 'week', shiftWeek(weekStart, -1), monthKey),
    );
  }

  function goNext() {
    if (view === 'month') {
      router.push(
        mealPlanUrl(basePath, 'month', weekStart, shiftMonth(monthKey, 1)),
      );
      return;
    }
    router.push(
      mealPlanUrl(basePath, 'week', shiftWeek(weekStart, 1), monthKey),
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
          ...scopeFields,
        });
        if (!result.success) throw new Error(result.error);
      } else {
        const result = await setMealEntryAction({
          planDate: date,
          mealType: 'dinner',
          title,
          recipeId: draftRecipeId,
          notes: null,
          ...scopeFields,
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
        ...scopeFields,
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

  function openGenerator(mode: 'generate' | 'fill') {
    if (mode === 'fill' && emptyDates.length === 0) {
      toast.info(
        'Every day already has a meal — try "Generate plan" to replace.',
      );
      return;
    }
    setGenerateDialog({ open: true, mode });
  }

  const hasDietary = preferences.dietary_requirements.length > 0;
  const hasPriorities = preferences.priorities.length > 0;
  const periodTitle =
    view === 'month' ? monthLabel(monthKey) : rangeLabel(weekDates);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setView('week')}
              className={cn(
                'rounded-md px-3 py-1.5 font-medium transition-colors',
                view === 'week'
                  ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
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
                  ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
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
              <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                {periodTitle}
              </p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
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
            onClick={() => openGenerator('fill')}
            disabled={emptyDates.length === 0}
          >
            <Wand2 className="mr-1.5 h-4 w-4" />
            Fill gaps
          </Button>
          <Button
            onClick={() => openGenerator('generate')}
            style={{ backgroundColor: ACCENT }}
            className="text-[var(--workspace-shell-text)] hover:opacity-90"
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            Generate plan
          </Button>
        </div>
      </div>

      {hasDietary || hasPriorities ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[var(--workspace-shell-text-muted)]">
            Planning for:
          </span>
          {preferences.dietary_requirements.map((d) => (
            <span
              key={`d-${d}`}
              className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-emerald-200 capitalize"
            >
              {d}
            </span>
          ))}
          {preferences.priorities.map((p) => (
            <span
              key={`p-${p}`}
              className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[var(--workspace-shell-text-muted)]"
            >
              {titleCase(p)}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          Tip: set dietary requirements and preferences in the Preferences tab
          to tailor the generator.
        </p>
      )}

      {view === 'month' ? (
        <div className={cn(panelClass, 'p-3 sm:p-4')}>
          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAY_HEADERS.map((label) => (
              <div
                key={label}
                className="py-1 text-center text-[11px] font-medium text-[var(--workspace-shell-text-muted)] uppercase"
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
                      ? 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] hover:border-[color:var(--workspace-shell-border)] hover:bg-[var(--workspace-shell-sidebar-accent)]'
                      : 'border-transparent bg-transparent opacity-30',
                    isToday &&
                      cell.inMonth &&
                      'border-[#FFE3DA]/30 bg-[#FFE3DA]/5',
                  )}
                >
                  <span
                    className={cn(
                      'text-[11px] font-semibold sm:text-xs',
                      isToday
                        ? 'text-[var(--ozer-accent-muted)]'
                        : 'text-[var(--workspace-shell-text-muted)]',
                    )}
                  >
                    {Number(cell.date.slice(8, 10))}
                  </span>
                  {cell.inMonth && entry?.title ? (
                    <span className="mt-1 line-clamp-2 text-[10px] leading-tight font-medium text-[var(--workspace-shell-text)] sm:text-xs">
                      {entry.title}
                    </span>
                  ) : cell.inMonth ? (
                    <span className="mt-1 text-[10px] text-[var(--workspace-shell-text-muted)]">
                      +
                    </span>
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
                        isToday
                          ? 'text-[var(--ozer-accent-muted)]'
                          : 'text-[var(--workspace-shell-text-muted)]',
                      )}
                    >
                      {weekdayLabel(date).slice(0, 3)}
                    </p>
                    <p className="text-[11px] text-[var(--workspace-shell-text-muted)]">
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
                            className="h-9 w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 text-sm text-[var(--workspace-shell-text)] outline-none focus:border-[color:var(--workspace-shell-border)]"
                          >
                            <option
                              value=""
                              className="bg-[var(--ozer-surface-panel)]"
                            >
                              Free text / no recipe
                            </option>
                            {recipes.map((r) => (
                              <option
                                key={r.id}
                                value={r.id}
                                className="bg-[var(--ozer-surface-panel)]"
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
                            className="h-8 text-[var(--workspace-shell-text)] hover:opacity-90"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setInlineEditDate(null)}
                            disabled={isSaving}
                            className="h-8 text-[var(--workspace-shell-text-muted)]"
                          >
                            Cancel
                          </Button>
                          {entry?.title ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleClear(date)}
                              disabled={isSaving}
                              className="ml-auto h-8 text-[var(--workspace-shell-text-muted)] hover:text-rose-300"
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
                              <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                                {entry.title}
                              </p>
                              {entry.notes ? (
                                <p className="mt-0.5 line-clamp-1 text-xs text-[var(--workspace-shell-text-muted)]">
                                  {entry.notes}
                                </p>
                              ) : null}
                              {recipe && recipe.tags.length > 0 ? (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {recipe.tags.slice(0, 3).map((tag) => (
                                    <span
                                      key={tag}
                                      className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-1.5 py-0.5 text-[10px] text-[var(--workspace-shell-text-muted)] capitalize"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-sm text-[var(--workspace-shell-text-muted)] group-hover:text-[var(--workspace-shell-text-muted)]">
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
                      className="shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-rose-300"
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
        accountSlug={accountSlug}
        onSaved={onChanged}
      />

      <MealPlanGenerateDialog
        open={generateDialog.open}
        onOpenChange={(open) =>
          setGenerateDialog((current) => ({ ...current, open }))
        }
        mode={generateDialog.mode}
        targetDates={generateDialog.mode === 'fill' ? emptyDates : planDates}
        planDates={planDates}
        preferences={preferences}
        accountSlug={accountSlug}
        onSaved={onChanged}
      />
    </div>
  );
}
