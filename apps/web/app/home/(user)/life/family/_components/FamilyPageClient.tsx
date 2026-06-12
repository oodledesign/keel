'use client';

import { useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  SlidersHorizontal,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

import type { FamilyMealData } from '../_lib/schema/family-meal.schema';
import { MealPlanPanel } from './MealPlanPanel';
import { MealPreferencesPanel } from './MealPreferencesPanel';
import { RecipeLibrary } from './RecipeLibrary';
import { ACCENT } from './meal-ui';

type Tab = 'plan' | 'recipes' | 'preferences';

function parseTab(value: string | null): Tab {
  if (value === 'recipes' || value === 'preferences') {
    return value;
  }

  return 'plan';
}

const TABS: { id: Tab; label: string; Icon: typeof CalendarDays }[] = [
  { id: 'plan', label: 'Meal plan', Icon: CalendarDays },
  { id: 'recipes', label: 'Recipes', Icon: BookOpen },
  { id: 'preferences', label: 'Preferences', Icon: SlidersHorizontal },
];

const PLACEHOLDER_TASKS = [
  { id: '1', title: 'Grocery shop — midweek top-up', category: 'Shopping', dueDate: 'Wed', done: false },
  { id: '2', title: 'Book dentist for kids', category: 'Health', dueDate: 'This week', done: false },
  { id: '3', title: 'Kids swimming — pack bags', category: 'Activities', dueDate: 'Today', done: true },
];

type Props = {
  initialData: FamilyMealData;
  showHouseholdTasks?: boolean;
  compactHeader?: boolean;
};

export function FamilyPageClient({
  initialData,
  showHouseholdTasks = true,
  compactHeader = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => parseTab(searchParams.get('tab')));

  const refresh = () => router.refresh();

  const recipeCount = initialData.recipes.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 bg-transparent px-4 pb-12 pt-6 text-white md:px-6 lg:px-8">
      {!compactHeader ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Family
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Plan meals by the week or month, keep your recipes, and share
              household tasks
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex w-full max-w-md rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] p-1 text-sm">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 font-medium transition-colors',
              tab === id
                ? 'bg-white/10 text-white'
                : 'text-zinc-400 hover:text-white',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {id === 'recipes' && recipeCount > 0 ? (
              <span className="rounded-full bg-white/10 px-1.5 text-[11px]">
                {recipeCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'plan' ? (
        <div
          className={cn(
            'grid gap-6',
            showHouseholdTasks && 'lg:grid-cols-[1fr,300px]',
          )}
        >
          <MealPlanPanel
            view={initialData.view}
            weekStart={initialData.weekStart}
            weekDates={initialData.weekDates}
            monthKey={initialData.monthKey}
            planDates={initialData.planDates}
            entries={initialData.entries}
            recipes={initialData.recipes}
            preferences={initialData.preferences}
            basePath={initialData.basePath}
            accountSlug={initialData.accountSlug}
            onChanged={refresh}
          />

          {showHouseholdTasks ? (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-zinc-300">
              Household tasks
            </h2>
            <div className="space-y-2">
              {PLACEHOLDER_TASKS.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 rounded-xl border border-white/6 bg-[var(--workspace-shell-panel)] px-4 py-3"
                >
                  <span className="mt-0.5 shrink-0">
                    {task.done ? (
                      <CheckCircle2 className="h-4 w-4 text-[#5eead4]" />
                    ) : (
                      <Circle className="h-4 w-4 text-zinc-500" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        task.done
                          ? 'text-zinc-500 line-through'
                          : 'text-white',
                      )}
                    >
                      {task.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: ACCENT }}
                        />
                        {task.category}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {task.dueDate}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          ) : null}
        </div>
      ) : null}

      {tab === 'recipes' ? (
        <RecipeLibrary
          recipes={initialData.recipes}
          preferences={initialData.preferences}
          basePath={initialData.basePath}
          accountSlug={initialData.accountSlug}
          onChanged={refresh}
        />
      ) : null}

      {tab === 'preferences' ? (
        <MealPreferencesPanel
          preferences={initialData.preferences}
          accountSlug={initialData.accountSlug}
          onSaved={refresh}
        />
      ) : null}
    </div>
  );
}
