'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  type ApplyGeneratedWeekInput,
  ApplyGeneratedWeekSchema,
  type BulkAddGeneratedRecipesInput,
  BulkAddGeneratedRecipesSchema,
  type ClearMealEntryInput,
  ClearMealEntrySchema,
  type DeleteRecipeInput,
  DeleteRecipeSchema,
  type MealPreferencesInput,
  MealPreferencesInputSchema,
  type RecipeInput,
  RecipeInputSchema,
  type SetMealEntryInput,
  SetMealEntrySchema,
  type ToggleRecipeFavoriteInput,
  ToggleRecipeFavoriteSchema,
} from './schema/family-meal.schema';
import {
  resolveMealPlanScope,
  revalidateMealPlanPaths,
  revalidateRecipePaths,
} from './server/family-meal.scope';

type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

function fail(error: unknown): ActionResult<never> {
  if (error && typeof error === 'object' && 'message' in error) {
    return {
      success: false,
      error: String((error as { message: string }).message),
    };
  }

  return {
    success: false,
    error: error instanceof Error ? error.message : 'Something went wrong',
  };
}

type MealPreferenceValues = {
  user_id: string;
  account_id: string | null;
  dietary_requirements: string[];
  priorities: string[];
  disliked_ingredients: string[];
  household_size: number;
  notes: string | null;
  updated_at: string;
};

type MealPlanEntryValues = {
  user_id: string;
  account_id: string | null;
  plan_date: string;
  meal_type: string;
  title: string;
  recipe_id: string | null;
  notes: string | null;
  updated_at: string;
};

async function persistMealPlanEntry(
  client: ReturnType<typeof getSupabaseServerClient>,
  scope: Awaited<ReturnType<typeof resolveMealPlanScope>>,
  values: Omit<MealPlanEntryValues, 'user_id' | 'account_id' | 'updated_at'>,
) {
  const row: MealPlanEntryValues = {
    user_id: scope.userId,
    account_id: scope.kind === 'workspace' ? scope.accountId : null,
    ...values,
    updated_at: new Date().toISOString(),
  };

  if (scope.kind === 'workspace') {
    const { data: existing, error: readError } = await client
      .from('family_meal_plan_entries')
      .select('id')
      .eq('account_id', scope.accountId)
      .eq('plan_date', values.plan_date)
      .eq('meal_type', values.meal_type)
      .maybeSingle();

    if (readError) throw readError;

    if (existing) {
      const { error } = await client
        .from('family_meal_plan_entries')
        .update(row)
        .eq('id', (existing as { id: string }).id);

      if (error) throw error;
      return;
    }

    const { error } = await client.from('family_meal_plan_entries').insert(row);
    if (error) throw error;
    return;
  }

  const { data: existing, error: readError } = await client
    .from('family_meal_plan_entries')
    .select('id')
    .eq('user_id', scope.userId)
    .is('account_id', null)
    .eq('plan_date', values.plan_date)
    .eq('meal_type', values.meal_type)
    .maybeSingle();

  if (readError) throw readError;

  if (existing) {
    const { error } = await client
      .from('family_meal_plan_entries')
      .update(row)
      .eq('id', (existing as { id: string }).id);

    if (error) throw error;
    return;
  }

  const { error } = await client.from('family_meal_plan_entries').insert(row);
  if (error) throw error;
}

async function persistMealPreferences(
  client: ReturnType<typeof getSupabaseServerClient>,
  scope: Awaited<ReturnType<typeof resolveMealPlanScope>>,
  values: Omit<MealPreferenceValues, 'user_id' | 'account_id' | 'updated_at'>,
) {
  const row: MealPreferenceValues = {
    user_id: scope.userId,
    account_id: scope.kind === 'workspace' ? scope.accountId : null,
    ...values,
    updated_at: new Date().toISOString(),
  };

  if (scope.kind === 'workspace') {
    const { data: existing, error: readError } = await client
      .from('family_meal_preferences')
      .select('id')
      .eq('account_id', scope.accountId)
      .maybeSingle();

    if (readError) throw readError;

    if (existing) {
      const { error } = await client
        .from('family_meal_preferences')
        .update(row)
        .eq('account_id', scope.accountId);

      if (error) throw error;
      return;
    }

    const { error } = await client.from('family_meal_preferences').insert(row);
    if (error) throw error;
    return;
  }

  const { data: existing, error: readError } = await client
    .from('family_meal_preferences')
    .select('id')
    .eq('user_id', scope.userId)
    .is('account_id', null)
    .maybeSingle();

  if (readError) throw readError;

  if (existing) {
    const { error } = await client
      .from('family_meal_preferences')
      .update(row)
      .eq('user_id', scope.userId)
      .is('account_id', null);

    if (error) throw error;
    return;
  }

  const { error } = await client.from('family_meal_preferences').insert(row);
  if (error) throw error;
}

export async function saveMealPreferencesAction(
  input: MealPreferencesInput,
): Promise<ActionResult> {
  try {
    const parsed = MealPreferencesInputSchema.parse(input);
    const client = getSupabaseServerClient();
    const scope = await resolveMealPlanScope(parsed.accountSlug);

    await persistMealPreferences(client, scope, {
      dietary_requirements: parsed.dietary_requirements,
      priorities: parsed.priorities,
      disliked_ingredients: parsed.disliked_ingredients,
      household_size: parsed.household_size,
      notes: parsed.notes ?? null,
    });

    revalidateMealPlanPaths(scope);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

export async function upsertRecipeAction(
  input: RecipeInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = RecipeInputSchema.parse(input);
    const client = getSupabaseServerClient();
    const scope = await resolveMealPlanScope(parsed.accountSlug);

    const values = {
      user_id: scope.userId,
      account_id: scope.kind === 'workspace' ? scope.accountId : null,
      name: parsed.name,
      description: parsed.description ?? null,
      ingredients: parsed.ingredients,
      instructions: parsed.instructions ?? null,
      tags: parsed.tags,
      meal_type: parsed.meal_type,
      prep_minutes: parsed.prep_minutes ?? null,
      cook_minutes: parsed.cook_minutes ?? null,
      servings: parsed.servings ?? null,
      is_favorite: parsed.is_favorite,
      updated_at: new Date().toISOString(),
    };

    if (parsed.id) {
      let updateQuery = client
        .from('family_recipes')
        .update(values)
        .eq('id', parsed.id);

      if (scope.kind === 'workspace') {
        updateQuery = updateQuery.eq('account_id', scope.accountId);
      } else {
        updateQuery = updateQuery
          .eq('user_id', scope.userId)
          .is('account_id', null);
      }

      const { data, error } = await updateQuery.select('id').single();
      if (error) return fail(error);
      revalidateRecipePaths(scope, (data as { id: string }).id);
      return ok({ id: (data as { id: string }).id });
    }

    const { data, error } = await client
      .from('family_recipes')
      .insert(values)
      .select('id')
      .single();
    if (error) return fail(error);
    revalidateRecipePaths(scope, (data as { id: string }).id);
    return ok({ id: (data as { id: string }).id });
  } catch (err) {
    return fail(err);
  }
}

export async function deleteRecipeAction(
  input: DeleteRecipeInput,
): Promise<ActionResult> {
  try {
    const parsed = DeleteRecipeSchema.parse(input);
    const client = getSupabaseServerClient();
    const scope = await resolveMealPlanScope(parsed.accountSlug);

    let deleteQuery = client
      .from('family_recipes')
      .delete()
      .eq('id', parsed.recipeId);

    if (scope.kind === 'workspace') {
      deleteQuery = deleteQuery.eq('account_id', scope.accountId);
    } else {
      deleteQuery = deleteQuery
        .eq('user_id', scope.userId)
        .is('account_id', null);
    }

    const { error } = await deleteQuery;
    if (error) return fail(error);
    revalidateRecipePaths(scope, parsed.recipeId);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

export async function toggleRecipeFavoriteAction(
  input: ToggleRecipeFavoriteInput,
): Promise<ActionResult> {
  try {
    const parsed = ToggleRecipeFavoriteSchema.parse(input);
    const client = getSupabaseServerClient();
    const scope = await resolveMealPlanScope(parsed.accountSlug);

    let updateQuery = client
      .from('family_recipes')
      .update({
        is_favorite: parsed.isFavorite,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.recipeId);

    if (scope.kind === 'workspace') {
      updateQuery = updateQuery.eq('account_id', scope.accountId);
    } else {
      updateQuery = updateQuery
        .eq('user_id', scope.userId)
        .is('account_id', null);
    }

    const { error } = await updateQuery;
    if (error) return fail(error);
    revalidateRecipePaths(scope, parsed.recipeId);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

export async function setMealEntryAction(
  input: SetMealEntryInput,
): Promise<ActionResult> {
  try {
    const parsed = SetMealEntrySchema.parse(input);
    const client = getSupabaseServerClient();
    const scope = await resolveMealPlanScope(parsed.accountSlug);

    await persistMealPlanEntry(client, scope, {
      plan_date: parsed.planDate,
      meal_type: parsed.mealType,
      title: parsed.title,
      recipe_id: parsed.recipeId ?? null,
      notes: parsed.notes ?? null,
    });
    revalidateMealPlanPaths(scope);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

export async function clearMealEntryAction(
  input: ClearMealEntryInput,
): Promise<ActionResult> {
  try {
    const parsed = ClearMealEntrySchema.parse(input);
    const client = getSupabaseServerClient();
    const scope = await resolveMealPlanScope(parsed.accountSlug);

    let query = client
      .from('family_meal_plan_entries')
      .delete()
      .eq('plan_date', parsed.planDate)
      .eq('meal_type', parsed.mealType);

    if (scope.kind === 'workspace') {
      query = query.eq('account_id', scope.accountId);
    } else {
      query = query.eq('user_id', scope.userId).is('account_id', null);
    }

    const { error } = await query;
    if (error) return fail(error);
    revalidateMealPlanPaths(scope);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

export async function applyGeneratedWeekAction(
  input: ApplyGeneratedWeekInput,
): Promise<ActionResult> {
  try {
    const parsed = ApplyGeneratedWeekSchema.parse(input);
    const client = getSupabaseServerClient();
    const scope = await resolveMealPlanScope(parsed.accountSlug);

    for (const entry of parsed.entries) {
      await persistMealPlanEntry(client, scope, {
        plan_date: entry.planDate,
        meal_type: entry.mealType,
        title: entry.title,
        recipe_id: entry.recipeId ?? null,
        notes: entry.notes ?? null,
      });
    }
    revalidateMealPlanPaths(scope);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

export async function bulkAddGeneratedRecipesAction(
  input: BulkAddGeneratedRecipesInput,
): Promise<ActionResult<{ added: number }>> {
  try {
    const parsed = BulkAddGeneratedRecipesSchema.parse(input);
    const client = getSupabaseServerClient();
    const scope = await resolveMealPlanScope(parsed.accountSlug);
    const now = new Date().toISOString();

    const rows = parsed.recipes.map((recipe) => ({
      user_id: scope.userId,
      account_id: scope.kind === 'workspace' ? scope.accountId : null,
      name: recipe.name,
      description: recipe.description ?? null,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions ?? null,
      tags: recipe.tags,
      meal_type: recipe.meal_type,
      prep_minutes: recipe.prep_minutes ?? null,
      cook_minutes: recipe.cook_minutes ?? null,
      servings: recipe.servings ?? null,
      is_favorite: false,
      source: 'ai' as const,
      updated_at: now,
    }));

    const { error } = await client.from('family_recipes').insert(rows);
    if (error) return fail(error);

    revalidateMealPlanPaths(scope);
    return ok({ added: rows.length });
  } catch (err) {
    return fail(err);
  }
}
