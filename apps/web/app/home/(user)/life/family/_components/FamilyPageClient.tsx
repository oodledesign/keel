'use client';

import { useState } from 'react';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Library,
  ShoppingCart,
  SlidersHorizontal,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { buildShoppingPath } from '../_lib/family-meal.paths';
import type { FamilyMealData } from '../_lib/schema/family-meal.schema';
import { MealPlanPanel } from './MealPlanPanel';
import { MealPreferencesPanel } from './MealPreferencesPanel';
import { RecipeBookLibrary } from './RecipeBookLibrary';
import { RecipeLibrary } from './RecipeLibrary';

type Tab = 'plan' | 'recipes' | 'books' | 'preferences';

function parseTab(value: string | null): Tab {
  if (value === 'recipes' || value === 'books' || value === 'preferences') {
    return value;
  }

  return 'plan';
}

const TABS: {
  id: Tab;
  label: string;
  shortLabel: string;
  Icon: typeof CalendarDays;
}[] = [
  { id: 'plan', label: 'Meal plan', shortLabel: 'Plan', Icon: CalendarDays },
  { id: 'recipes', label: 'Recipes', shortLabel: 'Recipes', Icon: BookOpen },
  {
    id: 'books',
    label: 'Recipe books',
    shortLabel: 'Books',
    Icon: Library,
  },
  {
    id: 'preferences',
    label: 'Preferences',
    shortLabel: 'Prefs',
    Icon: SlidersHorizontal,
  },
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));
  const [bookDraft, setBookDraft] = useState<{ ids: string[]; key: number }>({
    ids: [],
    key: 0,
  });

  const refresh = () => router.refresh();

  const recipeCount = initialData.recipes.length;
  const bookCount = initialData.books.length;
  const plannedCount = initialData.entries.filter(
    (entry) => entry.meal_type === 'dinner' && Boolean(entry.title?.trim()),
  ).length;
  const hasPreferences =
    initialData.preferences.dietary_requirements.length > 0 ||
    initialData.preferences.priorities.length > 0;

  function selectTab(next: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'plan') {
      params.delete('tab');
    } else {
      params.set('tab', next);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 bg-transparent px-4 pt-6 pb-12 text-[var(--workspace-shell-text)] md:px-6 lg:px-8">
      {!compactHeader ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Meals & recipes
            </h1>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
              Keep a recipe library, plan dinners, then make a shopping list.
              Share a recipe or a whole book with a public link.
            </p>
          </div>
        </div>
      ) : null}

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
        <div
          role="tablist"
          aria-label="Meal sections"
          className="flex w-max max-w-2xl min-w-full rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-1 text-sm md:w-full"
        >
          {TABS.map(({ id, label, shortLabel, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => selectTab(id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 font-medium whitespace-nowrap transition-colors',
                tab === id
                  ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{label}</span>
              {id === 'recipes' && recipeCount > 0 ? (
                <span className="rounded-full border border-[color:var(--workspace-shell-border)] px-1.5 text-[11px]">
                  {recipeCount}
                </span>
              ) : null}
              {id === 'books' && bookCount > 0 ? (
                <span className="rounded-full border border-[color:var(--workspace-shell-border)] px-1.5 text-[11px]">
                  {bookCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
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
            hasShoppingListForWeek={initialData.hasShoppingListForWeek}
            onChanged={refresh}
            onOpenRecipes={() => selectTab('recipes')}
            onOpenPreferences={() => selectTab('preferences')}
          />

          {showHouseholdTasks ? (
            <MealNextSteps
              recipeCount={recipeCount}
              plannedCount={plannedCount}
              hasPreferences={hasPreferences}
              hasShoppingList={Boolean(initialData.hasShoppingListForWeek)}
              shoppingHref={buildShoppingPath(
                initialData.accountSlug,
                initialData.weekStart,
              )}
              onOpenRecipes={() => selectTab('recipes')}
              onOpenPreferences={() => selectTab('preferences')}
            />
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
          onCreateBook={(recipeIds) => {
            setBookDraft({ ids: recipeIds, key: Date.now() });
            selectTab('books');
          }}
        />
      ) : null}

      {tab === 'books' ? (
        <RecipeBookLibrary
          key={bookDraft.key}
          books={initialData.books}
          recipes={initialData.recipes}
          basePath={initialData.basePath}
          accountSlug={initialData.accountSlug}
          initialRecipeIds={bookDraft.ids}
          onChanged={() => {
            setBookDraft({ ids: [], key: 0 });
            refresh();
          }}
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

function MealNextSteps({
  recipeCount,
  plannedCount,
  hasPreferences,
  hasShoppingList,
  shoppingHref,
  onOpenRecipes,
  onOpenPreferences,
}: {
  recipeCount: number;
  plannedCount: number;
  hasPreferences: boolean;
  hasShoppingList: boolean;
  shoppingHref: string;
  onOpenRecipes: () => void;
  onOpenPreferences: () => void;
}) {
  const steps: {
    key: string;
    title: string;
    body: string;
    onClick?: () => void;
    href?: string;
  }[] = [];

  if (recipeCount === 0) {
    steps.push({
      key: 'recipes',
      title: 'Add recipes',
      body: 'Import a link, generate with AI, or type one by hand. The week plan and shopping list use this library.',
      onClick: onOpenRecipes,
    });
  } else {
    steps.push({
      key: 'recipes',
      title:
        recipeCount === 1
          ? '1 recipe in your library'
          : `${recipeCount} recipes in your library`,
      body: 'Open a recipe to share it, or tick a few and collect them into a book.',
      onClick: onOpenRecipes,
    });
  }

  if (!hasPreferences) {
    steps.push({
      key: 'preferences',
      title: 'Set preferences',
      body: 'Dietary needs and household size steer Generate plan and AI recipes.',
      onClick: onOpenPreferences,
    });
  }

  if (plannedCount === 0) {
    steps.push({
      key: 'plan',
      title: 'Plan this week’s dinners',
      body:
        recipeCount === 0
          ? 'Tap a day and type a meal name, or generate a week once you have recipes.'
          : 'Tap a day to assign a recipe, or use Generate plan.',
    });
  } else if (hasShoppingList) {
    steps.push({
      key: 'shopping',
      title: 'Shopping list ready',
      body: 'Open this week’s list, or rebuild it from the meal plan.',
      href: shoppingHref,
    });
  } else {
    steps.push({
      key: 'shopping',
      title: 'Make a shopping list',
      body: 'Use Make shopping list on the plan once dinners have recipes attached.',
    });
  }

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-[var(--workspace-shell-text)]">
        Next steps
      </h2>
      <p className="mb-3 text-xs text-[var(--workspace-shell-text-muted)]">
        Recipes → plan dinners → shopping list
      </p>
      <div className="space-y-2">
        {steps.map((step) => {
          const className =
            'flex w-full items-start gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-3 text-left';
          const interactiveClass = `${className} transition-opacity hover:opacity-90`;
          const content = (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  {step.title}
                </p>
                <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                  {step.body}
                </p>
              </div>
              {step.onClick || step.href ? (
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
              ) : null}
            </>
          );

          if (step.href) {
            return (
              <Link
                key={step.key}
                href={step.href}
                className={interactiveClass}
              >
                {content}
              </Link>
            );
          }

          if (step.onClick) {
            return (
              <button
                key={step.key}
                type="button"
                onClick={step.onClick}
                className={interactiveClass}
              >
                {content}
              </button>
            );
          }

          return (
            <div key={step.key} className={className}>
              {content}
            </div>
          );
        })}
        {hasShoppingList ? (
          <p className="flex items-center gap-1.5 px-1 text-[11px] text-[var(--workspace-shell-text-muted)]">
            <ShoppingCart className="h-3 w-3" />
            Shopping is a separate page for this week
          </p>
        ) : null}
      </div>
    </section>
  );
}
