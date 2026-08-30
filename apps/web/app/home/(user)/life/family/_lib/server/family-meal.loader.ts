import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type {
  FamilyMealData,
  MealEntryRow,
  MealPlanView,
  MealPreferencesRow,
  RecipeCookLogRow,
  RecipeIngredientRow,
  RecipePopularityStats,
  RecipeRow,
  RecipeStepRow,
  RecipeStructure,
} from '../schema/family-meal.schema';
import {
  currentMonthKey,
  mondayWeekStart,
  monthDatesFrom,
  monthKeyFromYmd,
  weekDatesFrom,
} from './family-meal.dates';
import { type MealPlanScope, resolveMealPlanScope } from './family-meal.scope';
import { createFamilyShoppingService } from './family-shopping.service';

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

    const planDates = view === 'month' ? monthDatesFrom(monthKey) : weekDates;
    const rangeStart = planDates[0] ?? weekStart;
    const rangeEnd = planDates[planDates.length - 1] ?? rangeStart;

    const accountId = scope.kind === 'workspace' ? scope.accountId : null;

    const shoppingService = createFamilyShoppingService(
      getSupabaseServerClient(),
    );

    const [recipesResult, preferencesResult, entriesResult, shoppingList] =
      await Promise.all([
        recipesQuery(scope)
          .order('is_favorite', { ascending: false })
          .order('updated_at', { ascending: false }),
        preferencesQuery(scope).maybeSingle(),
        entriesQuery(scope, rangeStart, rangeEnd),
        shoppingService.findListForWeek(scope, weekStart).catch(() => null),
      ]);

    const recipes = (recipesResult.data ?? []) as RecipeRow[];
    const preferences =
      (preferencesResult.data as MealPreferencesRow | null) ??
      defaultPreferences(scope.userId, accountId);
    const entries = (entriesResult.data ?? []) as MealEntryRow[];

    return {
      recipes,
      preferences,
      accountSlug: scope.kind === 'workspace' ? scope.accountSlug : undefined,
      basePath: scope.basePath,
      view,
      periodStart: view === 'month' ? `${monthKey}-01` : weekStart,
      planDates,
      monthKey,
      weekStart,
      weekDates,
      entries,
      hasShoppingListForWeek: Boolean(shoppingList),
    };
  },
);

export const loadFamilyRecipeById = cache(
  async (recipeId: string, accountSlug?: string): Promise<RecipeRow | null> => {
    const scope = await resolveMealPlanScope(accountSlug);
    const { data, error } = await recipesQuery(scope)
      .eq('id', recipeId)
      .maybeSingle();

    if (error) {
      console.error('[family-meal] loadFamilyRecipeById:', error.message);
      return null;
    }

    return (data as RecipeRow | null) ?? null;
  },
);

export const loadFamilyRecipePopularity = cache(
  async (recipeId: string): Promise<RecipePopularityStats> => {
    const client = getSupabaseServerClient();
    const { data, error } = await client
      .from('family_recipe_popularity')
      .select('times_cooked, avg_rating, popularity_score')
      .eq('recipe_id', recipeId)
      .maybeSingle();

    if (error) {
      console.error('[family-meal] loadFamilyRecipePopularity:', error.message);
      return { times_cooked: 0, avg_rating: null, popularity_score: 0 };
    }

    if (!data) {
      return { times_cooked: 0, avg_rating: null, popularity_score: 0 };
    }

    const row = data as {
      times_cooked: number | null;
      avg_rating: number | null;
      popularity_score: number | null;
    };

    return {
      times_cooked: Number(row.times_cooked) || 0,
      avg_rating: row.avg_rating == null ? null : Number(row.avg_rating),
      popularity_score: Number(row.popularity_score) || 0,
    };
  },
);

export const loadFamilyRecipeCookLogs = cache(
  async (recipeId: string, limit = 8): Promise<RecipeCookLogRow[]> => {
    const client = getSupabaseServerClient();
    const { data, error } = await client
      .from('family_recipe_logs')
      .select('id, recipe_id, rating, cooked_at, notes, created_at')
      .eq('recipe_id', recipeId)
      .order('cooked_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[family-meal] loadFamilyRecipeCookLogs:', error.message);
      return [];
    }

    return (data ?? []) as RecipeCookLogRow[];
  },
);

export const loadFamilyRecipeStructure = cache(
  async (recipeId: string): Promise<RecipeStructure> => {
    const client = getSupabaseServerClient();

    const [ingredientsResult, stepsResult] = await Promise.all([
      client
        .from('family_recipe_ingredients')
        .select('id, recipe_id, sort_order, name, amount, unit, original_text')
        .eq('recipe_id', recipeId)
        .order('sort_order', { ascending: true }),
      client
        .from('family_recipe_steps')
        .select('id, recipe_id, sort_order, title, content, timer_seconds')
        .eq('recipe_id', recipeId)
        .order('sort_order', { ascending: true }),
    ]);

    if (ingredientsResult.error) {
      console.error(
        '[family-meal] loadFamilyRecipeStructure ingredients:',
        ingredientsResult.error.message,
      );
    }
    if (stepsResult.error) {
      console.error(
        '[family-meal] loadFamilyRecipeStructure steps:',
        stepsResult.error.message,
      );
    }

    const ingredients = (ingredientsResult.data ?? []).map((row) => {
      const r = row as {
        id: string;
        recipe_id: string;
        sort_order: number;
        name: string;
        amount: number | string | null;
        unit: string | null;
        original_text: string;
      };
      return {
        id: r.id,
        recipe_id: r.recipe_id,
        sort_order: r.sort_order,
        name: r.name,
        amount: r.amount == null ? null : Number(r.amount),
        unit: r.unit,
        original_text: r.original_text,
      } satisfies RecipeIngredientRow;
    });

    const stepsRaw = (stepsResult.data ?? []) as Array<{
      id: string;
      recipe_id: string;
      sort_order: number;
      title: string;
      content: string;
      timer_seconds: number | null;
    }>;

    const stepIds = stepsRaw.map((step) => step.id);
    const multipliersByStep = new Map<string, Record<string, number>>();

    if (stepIds.length > 0) {
      const { data: links, error: linksError } = await client
        .from('family_recipe_step_ingredients')
        .select('step_id, ingredient_id, quantity_multiplier')
        .in('step_id', stepIds);

      if (linksError) {
        console.error(
          '[family-meal] loadFamilyRecipeStructure step links:',
          linksError.message,
        );
      } else {
        for (const link of links ?? []) {
          const row = link as {
            step_id: string;
            ingredient_id: string;
            quantity_multiplier: number | string;
          };
          const current = multipliersByStep.get(row.step_id) ?? {};
          current[row.ingredient_id] = Number(row.quantity_multiplier) || 1;
          multipliersByStep.set(row.step_id, current);
        }
      }
    }

    const steps: RecipeStepRow[] = stepsRaw.map((step) => ({
      ...step,
      ingredient_multipliers: multipliersByStep.get(step.id) ?? {},
    }));

    return { ingredients, steps };
  },
);
