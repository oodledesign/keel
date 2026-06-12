import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type {
  FamilyMealData,
  MealEntryRow,
  MealPlanView,
  MealPreferencesRow,
  RecipeRow,
} from '../schema/family-meal.schema';
import {
  currentMonthKey,
  mondayWeekStart,
  monthDatesFrom,
  monthKeyFromYmd,
  weekDatesFrom,
} from './family-meal.dates';
import { resolveMealPlanScope, type MealPlanScope } from './family-meal.scope';

function defaultPreferences(
  userId: string,
  accountId: string | null,
): MealPreferencesRow {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    account_id: accountId,
    dietary_requirements: [],
    priorities: [],
    disliked_ingredients: [],
    household_size: 2,
    notes: null,
    created_at: now,
    updated_at: now,
  };
}

type LoadOptions = {
  accountSlug?: string;
  view?: MealPlanView;
  weekStart?: string;
  monthKey?: string;
};

function recipesQuery(scope: MealPlanScope) {
  const client = getSupabaseServerClient();
  const base = client.from('family_recipes').select('*');
  if (scope.kind === 'workspace') {
    return base.eq('account_id', scope.accountId);
  }
  return base.eq('user_id', scope.userId).is('account_id', null);
}

function preferencesQuery(scope: MealPlanScope) {
  const client = getSupabaseServerClient();
  const base = client.from('family_meal_preferences').select('*');
  if (scope.kind === 'workspace') {
    return base.eq('account_id', scope.accountId);
  }
  return base.eq('user_id', scope.userId).is('account_id', null);
}

function entriesQuery(
  scope: MealPlanScope,
  rangeStart: string,
  rangeEnd: string,
) {
  const client = getSupabaseServerClient();
  const base = client
    .from('family_meal_plan_entries')
    .select('*')
    .gte('plan_date', rangeStart)
    .lte('plan_date', rangeEnd)
    .order('plan_date', { ascending: true });
  if (scope.kind === 'workspace') {
    return base.eq('account_id', scope.accountId);
  }
  return base.eq('user_id', scope.userId).is('account_id', null);
}

export const loadFamilyMealData = cache(
  async (options: LoadOptions = {}): Promise<FamilyMealData> => {
    const scope = await resolveMealPlanScope(options.accountSlug);

    const view: MealPlanView = options.view ?? 'week';
    const weekStart = options.weekStart ?? mondayWeekStart();
    const weekDates = weekDatesFrom(weekStart);
    const monthKey =
      options.monthKey ??
      (view === 'month' ? currentMonthKey() : monthKeyFromYmd(weekStart));

    const planDates =
      view === 'month' ? monthDatesFrom(monthKey) : weekDates;
    const rangeStart = planDates[0] ?? weekStart;
    const rangeEnd = planDates[planDates.length - 1] ?? rangeStart;

    const accountId =
      scope.kind === 'workspace' ? scope.accountId : null;

    const [recipesResult, preferencesResult, entriesResult] = await Promise.all([
      recipesQuery(scope)
        .order('is_favorite', { ascending: false })
        .order('updated_at', { ascending: false }),
      preferencesQuery(scope).maybeSingle(),
      entriesQuery(scope, rangeStart, rangeEnd),
    ]);

    const recipes = (recipesResult.data ?? []) as RecipeRow[];
    const preferences =
      (preferencesResult.data as MealPreferencesRow | null) ??
      defaultPreferences(scope.userId, accountId);
    const entries = (entriesResult.data ?? []) as MealEntryRow[];

    return {
      recipes,
      preferences,
      accountSlug:
        scope.kind === 'workspace' ? scope.accountSlug : undefined,
      basePath: scope.basePath,
      view,
      periodStart: view === 'month' ? `${monthKey}-01` : weekStart,
      planDates,
      monthKey,
      weekStart,
      weekDates,
      entries,
    };
  },
);
