import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  mondayWeekStart,
  weekDatesFrom,
} from '~/home/(user)/life/family/_lib/server/family-meal.dates';
import type { MealPlanScope } from '~/home/(user)/life/family/_lib/server/family-meal.scope';
import { createFamilyShoppingService } from '~/home/(user)/life/family/_lib/server/family-shopping.service';
import {
  type DietaryPerson,
  findHouseholdDietaryConflicts,
} from '~/lib/meals/dietary-conflict';
import { NativeHttpError } from '~/lib/native/http';
import type { NativeWorkspace } from '~/lib/native/workspace-shared';

type LooseQuery = {
  select: (cols?: string) => LooseQuery;
  update: (rows: unknown) => LooseQuery;
  eq: (col: string, val: unknown) => LooseQuery;
  is: (col: string, val: unknown) => LooseQuery;
  in: (col: string, vals: readonly unknown[]) => LooseQuery;
  gte: (col: string, val: unknown) => LooseQuery;
  lte: (col: string, val: unknown) => LooseQuery;
  order: (col: string, opts?: { ascending?: boolean }) => LooseQuery;
  limit: (count: number) => LooseQuery;
  maybeSingle: () => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
  then: (
    resolve: (value: {
      data: unknown;
      error: { message: string } | null;
    }) => unknown,
  ) => Promise<unknown>;
};

function loose(client: SupabaseClient): {
  from: (table: string) => LooseQuery;
} {
  return client as unknown as { from: (table: string) => LooseQuery };
}

export function nativeMealScope(
  userId: string,
  workspace: NativeWorkspace,
): MealPlanScope {
  if (workspace.isPersonal) {
    return {
      kind: 'personal',
      userId,
      basePath: '/app/life/family',
      revalidatePath: '/home/life/family',
    };
  }

  return {
    kind: 'workspace',
    userId,
    accountId: workspace.id,
    accountSlug: workspace.slug || workspace.id,
    basePath: `/app/${workspace.slug || workspace.id}/meal-plan`,
    revalidatePath: `/home/${workspace.slug || workspace.id}/meal-plan`,
  };
}

function applyScope(query: LooseQuery, scope: MealPlanScope): LooseQuery {
  if (scope.kind === 'workspace') {
    return query.eq('account_id', scope.accountId);
  }
  return query.eq('user_id', scope.userId).is('account_id', null);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

export async function listNativeRecipes(
  client: SupabaseClient,
  scope: MealPlanScope,
) {
  const db = loose(client);
  const { data, error } = (await applyScope(
    db
      .from('family_recipes')
      .select(
        'id, name, description, image_url, meal_type, prep_minutes, cook_minutes, servings, is_favorite, diet_tags, tags, ingredients, updated_at',
      ),
    scope,
  )
    .order('is_favorite', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(80)) as { data: unknown; error: { message: string } | null };

  if (error) throw new Error(error.message);

  const recipes = (data as Array<Record<string, unknown>> | null) ?? [];
  const ids = recipes.map((row) => String(row.id));
  const cookStats = await loadNativeCookStats(client, ids);

  return recipes.map((row) => {
    const stats = cookStats.get(String(row.id));
    return {
      id: String(row.id),
      name: String(row.name),
      description: row.description == null ? null : String(row.description),
      image_url: row.image_url == null ? null : String(row.image_url),
      meal_type: String(row.meal_type ?? 'dinner'),
      prep_minutes: row.prep_minutes == null ? null : Number(row.prep_minutes),
      cook_minutes: row.cook_minutes == null ? null : Number(row.cook_minutes),
      servings: row.servings == null ? null : Number(row.servings),
      is_favorite: Boolean(row.is_favorite),
      diet_tags: asStringArray(row.diet_tags),
      tags: asStringArray(row.tags),
      ingredients: asStringArray(row.ingredients),
      last_cooked_at: stats?.last_cooked_at ?? null,
      times_cooked: stats?.times_cooked ?? 0,
    };
  });
}

export async function getNativeRecipe(
  client: SupabaseClient,
  scope: MealPlanScope,
  recipeId: string,
) {
  const db = loose(client);
  const { data, error } = await applyScope(
    db.from('family_recipes').select('*').eq('id', recipeId),
    scope,
  ).maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new NativeHttpError(404, 'Recipe not found');

  const row = data as Record<string, unknown>;
  const [structure, stats] = await Promise.all([
    loadNativeRecipeStructure(client, recipeId),
    loadNativeCookStats(client, [recipeId]),
  ]);
  const cook = stats.get(recipeId);

  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    ingredients: asStringArray(row.ingredients),
    instructions: row.instructions == null ? null : String(row.instructions),
    image_url: row.image_url == null ? null : String(row.image_url),
    meal_type: String(row.meal_type ?? 'dinner'),
    prep_minutes: row.prep_minutes == null ? null : Number(row.prep_minutes),
    cook_minutes: row.cook_minutes == null ? null : Number(row.cook_minutes),
    servings: row.servings == null ? null : Number(row.servings),
    is_favorite: Boolean(row.is_favorite),
    diet_tags: asStringArray(row.diet_tags),
    tags: asStringArray(row.tags),
    last_cooked_at: cook?.last_cooked_at ?? null,
    times_cooked: cook?.times_cooked ?? 0,
    steps: structure.steps,
    structured_ingredients: structure.ingredients,
  };
}

export async function listNativeMealPlan(
  client: SupabaseClient,
  scope: MealPlanScope,
  weekStart: string,
) {
  const dates = weekDatesFrom(weekStart);
  const rangeEnd = dates[dates.length - 1] ?? weekStart;
  const db = loose(client);

  const [entriesResult, recipes, membersResult] = await Promise.all([
    applyScope(
      db
        .from('family_meal_plan_entries')
        .select(
          'id, plan_date, meal_type, title, recipe_id, notes, cook_member_id, is_batch_prep, leftover_source_entry_id',
        )
        .gte('plan_date', weekStart)
        .lte('plan_date', rangeEnd),
      scope,
    ).order('plan_date', { ascending: true }),
    listNativeRecipes(client, scope),
    applyScope(
      db
        .from('family_household_members')
        .select('id, display_name, dietary_tags, excluded_ingredients'),
      scope,
    ).order('sort_order', { ascending: true }),
  ]);

  const entriesError = (entriesResult as { error?: { message: string } }).error;
  if (entriesError) throw new Error(entriesError.message);

  const members = ((membersResult as { data?: Array<Record<string, unknown>> })
    .data ?? []) as Array<Record<string, unknown>>;
  const people: DietaryPerson[] = members.map((row) => ({
    id: String(row.id),
    name: String(row.display_name),
    dietary_tags: asStringArray(row.dietary_tags),
    excluded_ingredients: asStringArray(row.excluded_ingredients),
  }));
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const entries = ((entriesResult as { data?: Array<Record<string, unknown>> })
    .data ?? []) as Array<Record<string, unknown>>;

  return {
    week_start: weekStart,
    dates,
    members: people.map((person) => ({
      id: person.id,
      display_name: person.name,
    })),
    entries: entries.map((row) => {
      const recipeId = row.recipe_id == null ? null : String(row.recipe_id);
      const recipe = recipeId ? recipeById.get(recipeId) : undefined;
      const warnings = recipe
        ? findHouseholdDietaryConflicts({
            recipe: {
              name: recipe.name,
              diet_tags: recipe.diet_tags,
              ingredients: recipe.ingredients,
              tags: recipe.tags,
            },
            people,
          }).map((conflict) => conflict.message)
        : [];

      return {
        id: String(row.id),
        plan_date: String(row.plan_date),
        meal_type: String(row.meal_type),
        title: String(row.title ?? ''),
        recipe_id: recipeId,
        notes: row.notes == null ? null : String(row.notes),
        cook_member_id:
          row.cook_member_id == null ? null : String(row.cook_member_id),
        cook_member_name:
          people.find((person) => person.id === String(row.cook_member_id))
            ?.name ?? null,
        is_batch_prep: Boolean(row.is_batch_prep),
        leftover_source_entry_id:
          row.leftover_source_entry_id == null
            ? null
            : String(row.leftover_source_entry_id),
        dietary_warnings: warnings,
      };
    }),
  };
}

export async function getNativeShoppingList(
  client: SupabaseClient,
  scope: MealPlanScope,
  weekStart?: string,
) {
  const service = createFamilyShoppingService(client);
  const resolvedWeek = weekStart ?? mondayWeekStart();
  const list = weekStart
    ? await service.loadLatestList(scope, weekStart)
    : await service.loadLatestList(scope);

  if (!list) {
    return {
      week_start: resolvedWeek,
      list: null,
    };
  }

  return {
    week_start: list.week_start,
    list: {
      id: list.id,
      skipped_meals: list.skipped_meals,
      generated_at: list.generated_at,
      items: list.items.map((item) => ({
        id: item.id,
        display_text: item.display_text,
        category: item.category,
        checked: item.checked,
        in_pantry: item.in_pantry,
        excluded: item.excluded,
      })),
    },
  };
}

export async function toggleNativeShoppingItem(
  client: SupabaseClient,
  scope: MealPlanScope,
  itemId: string,
  checked: boolean,
) {
  const service = createFamilyShoppingService(client);
  await service.toggleItem(scope, itemId, checked);
  return { ok: true, id: itemId, checked };
}

async function loadNativeCookStats(
  client: SupabaseClient,
  recipeIds: string[],
): Promise<Map<string, { times_cooked: number; last_cooked_at: string }>> {
  const stats = new Map<
    string,
    { times_cooked: number; last_cooked_at: string }
  >();
  if (recipeIds.length === 0) return stats;

  const { data, error } = await client
    .from('family_recipe_logs')
    .select('recipe_id, cooked_at')
    .in('recipe_id', recipeIds)
    .order('cooked_at', { ascending: false })
    .limit(400);

  if (error) return stats;

  for (const row of data ?? []) {
    const id = String((row as { recipe_id: string }).recipe_id);
    const cookedAt = String((row as { cooked_at: string }).cooked_at);
    const current = stats.get(id) ?? {
      times_cooked: 0,
      last_cooked_at: cookedAt,
    };
    current.times_cooked += 1;
    stats.set(id, current);
  }

  return stats;
}

async function loadNativeRecipeStructure(
  client: SupabaseClient,
  recipeId: string,
) {
  const [ingredientsResult, stepsResult] = await Promise.all([
    client
      .from('family_recipe_ingredients')
      .select('id, name, amount, unit, original_text, sort_order')
      .eq('recipe_id', recipeId)
      .order('sort_order', { ascending: true }),
    client
      .from('family_recipe_steps')
      .select('id, title, content, timer_seconds, sort_order')
      .eq('recipe_id', recipeId)
      .order('sort_order', { ascending: true }),
  ]);

  return {
    ingredients: (ingredientsResult.data ?? []).map((row) => {
      const r = row as {
        id: string;
        name: string;
        amount: number | string | null;
        unit: string | null;
        original_text: string;
      };
      return {
        id: r.id,
        name: r.name,
        amount: r.amount == null ? null : Number(r.amount),
        unit: r.unit,
        original_text: r.original_text,
      };
    }),
    steps: (stepsResult.data ?? []).map((row) => {
      const r = row as {
        id: string;
        title: string;
        content: string;
        timer_seconds: number | null;
      };
      return {
        id: r.id,
        title: r.title,
        content: r.content,
        timer_seconds: r.timer_seconds,
      };
    }),
  };
}
