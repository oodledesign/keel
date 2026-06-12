'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  ApplyGeneratedWeekSchema,
  ClearMealEntrySchema,
  MealPreferencesInputSchema,
  RecipeInputSchema,
  SetMealEntrySchema,
  type ApplyGeneratedWeekInput,
  type ClearMealEntryInput,
  type MealPreferencesInput,
  type RecipeInput,
  type SetMealEntryInput,
} from './schema/family-meal.schema';

const FAMILY_PATH = '/home/life/family';

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
    const user = await requireUserInServerComponent();

    const { error } = await client.from('family_meal_preferences').upsert(
      {
        user_id: user.id,
        dietary_requirements: parsed.dietary_requirements,
        priorities: parsed.priorities,
        disliked_ingredients: parsed.disliked_ingredients,
        household_size: parsed.household_size,
        notes: parsed.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) return fail(error);
    revalidatePath(FAMILY_PATH);
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
    const user = await requireUserInServerComponent();

    const values = {
      user_id: user.id,
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
      const { data, error } = await client
        .from('family_recipes')
        .update(values)
        .eq('id', parsed.id)
        .eq('user_id', user.id)
        .select('id')
        .single();
      if (error) return fail(error);
      revalidatePath(FAMILY_PATH);
      return ok({ id: (data as { id: string }).id });
    }

    const { data, error } = await client
      .from('family_recipes')
      .insert(values)
      .select('id')
      .single();
    if (error) return fail(error);
    revalidatePath(FAMILY_PATH);
    return ok({ id: (data as { id: string }).id });
  } catch (err) {
    return fail(err);
  }
}

export async function deleteRecipeAction(
  recipeId: string,
): Promise<ActionResult> {
  try {
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();
    const { error } = await client
      .from('family_recipes')
      .delete()
      .eq('id', recipeId)
      .eq('user_id', user.id);
    if (error) return fail(error);
    revalidatePath(FAMILY_PATH);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

export async function toggleRecipeFavoriteAction(
  recipeId: string,
  isFavorite: boolean,
): Promise<ActionResult> {
  try {
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();
    const { error } = await client
      .from('family_recipes')
      .update({ is_favorite: isFavorite, updated_at: new Date().toISOString() })
      .eq('id', recipeId)
      .eq('user_id', user.id);
    if (error) return fail(error);
    revalidatePath(FAMILY_PATH);
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
    const user = await requireUserInServerComponent();

    const { error } = await client.from('family_meal_plan_entries').upsert(
      {
        user_id: user.id,
        plan_date: parsed.planDate,
        meal_type: parsed.mealType,
        title: parsed.title,
        recipe_id: parsed.recipeId ?? null,
        notes: parsed.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,plan_date,meal_type' },
    );

    if (error) return fail(error);
    revalidatePath(FAMILY_PATH);
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
    const user = await requireUserInServerComponent();

    const { error } = await client
      .from('family_meal_plan_entries')
      .delete()
      .eq('user_id', user.id)
      .eq('plan_date', parsed.planDate)
      .eq('meal_type', parsed.mealType);

    if (error) return fail(error);
    revalidatePath(FAMILY_PATH);
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
    const user = await requireUserInServerComponent();

    const now = new Date().toISOString();
    const rows = parsed.entries.map((entry) => ({
      user_id: user.id,
      plan_date: entry.planDate,
      meal_type: entry.mealType,
      title: entry.title,
      recipe_id: entry.recipeId ?? null,
      notes: entry.notes ?? null,
      updated_at: now,
    }));

    const { error } = await client
      .from('family_meal_plan_entries')
      .upsert(rows, { onConflict: 'user_id,plan_date,meal_type' });

    if (error) return fail(error);
    revalidatePath(FAMILY_PATH);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}
