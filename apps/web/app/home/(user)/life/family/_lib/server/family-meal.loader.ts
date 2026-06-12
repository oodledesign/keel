import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

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

function defaultPreferences(userId: string): MealPreferencesRow {
  const now = new Date().toISOString();
  return {
    user_id: userId,
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
  view?: MealPlanView;
  weekStart?: string;
  monthKey?: string;
};

export const loadFamilyMealData = cache(
  async (options: LoadOptions = {}): Promise<FamilyMealData> => {
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();

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

    const [recipesResult, preferencesResult, entriesResult] = await Promise.all([
      client
        .from('family_recipes')
        .select('*')
        .eq('user_id', user.id)
        .order('is_favorite', { ascending: false })
        .order('updated_at', { ascending: false }),
      client
        .from('family_meal_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      client
        .from('family_meal_plan_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('plan_date', rangeStart)
        .lte('plan_date', rangeEnd)
        .order('plan_date', { ascending: true }),
    ]);

    const recipes = (recipesResult.data ?? []) as RecipeRow[];
    const preferences =
      (preferencesResult.data as MealPreferencesRow | null) ??
      defaultPreferences(user.id);
    const entries = (entriesResult.data ?? []) as MealEntryRow[];

    return {
      recipes,
      preferences,
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
