'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  ApplyGeneratedWeekSchema,
  ClearMealEntrySchema,
  DeleteRecipeSchema,
  MealPreferencesInputSchema,
  RecipeInputSchema,
  SetMealEntrySchema,
  ToggleRecipeFavoriteSchema,
  type ApplyGeneratedWeekInput,
  type ClearMealEntryInput,
  type DeleteRecipeInput,
  type MealPreferencesInput,
  type RecipeInput,
  type SetMealEntryInput,
  type ToggleRecipeFavoriteInput,
} from './schema/family-meal.schema';
import { resolveMealPlanScope } from './server/family-meal.scope';

type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

function fail(error: unknown): ActionResult<never> {
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Something went wrong',
  };
}

export async function saveMealPreferencesAction(
  input: MealPreferencesInput,
): Promise<ActionResult> {
  try {
    const parsed = MealPreferencesInputSchema.parse(input);
    const client = getSupabaseServerClient();
    const scope = await resolveMealPlanScope(parsed.accountSlug);

    const row = {
      user_id: scope.userId,
      account_id: scope.kind === 'workspace' ? scope.accountId : null,
      dietary_requirements: parsed.dietary_requirements,
      priorities: parsed.priorities,
      disliked_ingredients: parsed.disliked_ingredients,
      household_size: parsed.household_size,
      notes: parsed.notes ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client.from('family_meal_preferences').upsert(row, {
      onConflict: scope.kind === 'workspace' ? 'account_id' : 'user_id',
    });

    if (error) return fail(error);
    revalidatePath(scope.revalidatePath);
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
      revalidatePath(scope.revalidatePath);
      return ok({ id: (data as { id: string }).id });
    }

    const { data, error } = await client
      .from('family_recipes')
      .insert(values)
      .select('id')
      .single();
    if (error) return fail(error);
    revalidatePath(scope.revalidatePath);
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
    revalidatePath(scope.revalidatePath);
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
    revalidatePath(scope.revalidatePath);
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

    const { error } = await client.from('family_meal_plan_entries').upsert(
      {
        user_id: scope.userId,
        account_id: scope.kind === 'workspace' ? scope.accountId : null,
        plan_date: parsed.planDate,
        meal_type: parsed.mealType,
        title: parsed.title,
        recipe_id: parsed.recipeId ?? null,
        notes: parsed.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict:
          scope.kind === 'workspace'
            ? 'account_id,plan_date,meal_type'
            : 'user_id,plan_date,meal_type',
      },
    );

    if (error) return fail(error);
    revalidatePath(scope.revalidatePath);
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
    revalidatePath(scope.revalidatePath);
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

    const now = new Date().toISOString();
    const accountId = scope.kind === 'workspace' ? scope.accountId : null;
    const rows = parsed.entries.map((entry) => ({
      user_id: scope.userId,
      account_id: accountId,
      plan_date: entry.planDate,
      meal_type: entry.mealType,
      title: entry.title,
      recipe_id: entry.recipeId ?? null,
      notes: entry.notes ?? null,
      updated_at: now,
    }));

    const { error } = await client.from('family_meal_plan_entries').upsert(rows, {
      onConflict:
        scope.kind === 'workspace'
          ? 'account_id,plan_date,meal_type'
          : 'user_id,plan_date,meal_type',
    });

    if (error) return fail(error);
    revalidatePath(scope.revalidatePath);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}
