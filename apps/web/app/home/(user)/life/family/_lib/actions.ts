'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import type { Database } from '@kit/supabase/database';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  fetchPublicRecipeImage,
  parseRecipeImageDataUrl,
} from '~/lib/meals/fetch-recipe-image';
import {
  ingredientsChanged,
  refreshRecipeNutrition,
} from '~/lib/meals/recipe-nutrition';
import { refreshRecipePrepStep } from '~/lib/meals/recipe-prep';
import {
  isStoredRecipeImageUrl,
  removeRecipeCover,
  storeRecipeCoverBytes,
} from '~/lib/meals/store-recipe-photo';
import { syncRecipeStructure } from '~/lib/meals/sync-recipe-structure';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  AccountSlugFieldSchema,
  type ApplyGeneratedWeekInput,
  ApplyGeneratedWeekSchema,
  type BulkAddGeneratedRecipesInput,
  BulkAddGeneratedRecipesSchema,
  type ClearMealEntryInput,
  ClearMealEntrySchema,
  type DeleteRecipeInput,
  DeleteRecipeSchema,
  type LogRecipeCookInput,
  LogRecipeCookSchema,
  type MealPreferencesInput,
  MealPreferencesInputSchema,
  type RecipeInput,
  RecipeInputSchema,
  type SetMealEntryInput,
  SetMealEntrySchema,
  type ToggleRecipeFavoriteInput,
  ToggleRecipeFavoriteSchema,
  toRecipeWriteValues,
} from './schema/family-meal.schema';
import {
  resolveMealPlanScope,
  revalidateMealPlanPaths,
  revalidateRecipePaths,
} from './server/family-meal.scope';

type Client = SupabaseClient<Database>;

const RetryRecipeNutritionSchema = AccountSlugFieldSchema.extend({
  recipeId: z.string().uuid(),
});
export type RetryRecipeNutritionInput = z.infer<
  typeof RetryRecipeNutritionSchema
>;

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
  client: Client,
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
  client: Client,
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

async function resolveRecipeCoverUrl(input: {
  ownerAccountId: string;
  recipeId: string;
  existingImageUrl: string | null;
  input: RecipeInput;
}): Promise<string | null> {
  const uploaded = input.input.image_data
    ? parseRecipeImageDataUrl(input.input.image_data)
    : null;

  if (uploaded) {
    return storeRecipeCoverBytes({
      ownerAccountId: input.ownerAccountId,
      recipeId: input.recipeId,
      existingImageUrl: input.existingImageUrl,
      bytes: uploaded.bytes,
      contentType: uploaded.contentType,
    });
  }

  const remote = input.input.remote_image_url ?? null;
  if (remote) {
    const fetched = await fetchPublicRecipeImage(remote);
    if (!fetched) return input.existingImageUrl;
    return storeRecipeCoverBytes({
      ownerAccountId: input.ownerAccountId,
      recipeId: input.recipeId,
      existingImageUrl: input.existingImageUrl,
      bytes: fetched.bytes,
      contentType: fetched.contentType,
    });
  }

  const keep = input.input.image_url ?? null;
  if (keep && isStoredRecipeImageUrl(keep)) {
    return keep;
  }

  if (input.existingImageUrl) {
    await removeRecipeCover(input.existingImageUrl);
  }

  return null;
}

export async function upsertRecipeAction(
  input: RecipeInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = RecipeInputSchema.parse(input);
    const client = getSupabaseServerClient();
    const scope = await resolveMealPlanScope(parsed.accountSlug);

    let previousIngredients: string[] | null = null;
    let previousPrepHash: string | null = null;
    let previousImageUrl: string | null = null;
    if (parsed.id) {
      let previousQuery = client
        .from('family_recipes')
        .select('ingredients, prep_ingredients_hash, image_url')
        .eq('id', parsed.id);

      if (scope.kind === 'workspace') {
        previousQuery = previousQuery.eq('account_id', scope.accountId);
      } else {
        previousQuery = previousQuery
          .eq('user_id', scope.userId)
          .is('account_id', null);
      }

      const { data: previous } = await previousQuery.maybeSingle();
      const previousRow = previous as {
        ingredients?: string[];
        prep_ingredients_hash?: string | null;
        image_url?: string | null;
      } | null;
      previousIngredients = previousRow?.ingredients ?? null;
      previousPrepHash = previousRow?.prep_ingredients_hash ?? null;
      previousImageUrl = previousRow?.image_url ?? null;
    }

    const values = {
      user_id: scope.userId,
      account_id: scope.kind === 'workspace' ? scope.accountId : null,
      ...toRecipeWriteValues(parsed),
      ...(parsed.id
        ? {}
        : { source: parsed.source === 'ai' ? 'ai' : 'manual' }),
      updated_at: new Date().toISOString(),
    };

    let recipeId: string;

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
      recipeId = (data as { id: string }).id;
    } else {
      const { data, error } = await client
        .from('family_recipes')
        .insert(values)
        .select('id')
        .single();
      if (error) return fail(error);
      recipeId = (data as { id: string }).id;
    }

    try {
      const nextImageUrl = await resolveRecipeCoverUrl({
        ownerAccountId:
          scope.kind === 'workspace' ? scope.accountId : scope.userId,
        recipeId,
        existingImageUrl: previousImageUrl,
        input: parsed,
      });

      if (nextImageUrl !== previousImageUrl) {
        const { error: imageError } = await client
          .from('family_recipes')
          .update({
            image_url: nextImageUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipeId);

        if (imageError) {
          console.error(
            '[family-meal] cover persist failed:',
            imageError.message,
          );
        }
      }
    } catch (coverError) {
      console.error(
        '[family-meal] cover persist failed:',
        coverError instanceof Error ? coverError.message : coverError,
      );
    }

    try {
      await syncRecipeStructure(client, {
        recipeId,
        ingredients: parsed.ingredients,
        instructions: parsed.instructions ?? null,
      });
    } catch (structureError) {
      console.error(
        '[family-meal] structure sync failed:',
        structureError instanceof Error
          ? structureError.message
          : structureError,
      );
    }

    const shouldRefreshNutrition =
      !parsed.id || ingredientsChanged(previousIngredients, parsed.ingredients);

    const meterAccountId =
      scope.kind === 'workspace' ? scope.accountId : scope.userId;

    if (shouldRefreshNutrition) {
      try {
        await refreshRecipeNutrition({
          client,
          recipeId,
          title: parsed.name,
          ingredients: parsed.ingredients,
          servings: parsed.servings ?? null,
        });
      } catch (nutritionError) {
        console.error(
          '[family-meal] nutrition refresh failed:',
          nutritionError instanceof Error
            ? nutritionError.message
            : nutritionError,
        );
      }
    }

    // Prep step: hash-gated inside refreshRecipePrepStep (skips Haiku when unchanged).
    try {
      await refreshRecipePrepStep({
        client,
        recipeId,
        ingredients: parsed.ingredients,
        previousHash: previousPrepHash,
        accountId: meterAccountId,
      });
    } catch (prepError) {
      console.error(
        '[family-meal] prep step refresh failed:',
        prepError instanceof Error ? prepError.message : prepError,
      );
    }

    revalidateRecipePaths(scope, recipeId);
    return ok({ id: recipeId });
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

    let existingQuery = client
      .from('family_recipes')
      .select('image_url')
      .eq('id', parsed.recipeId);

    if (scope.kind === 'workspace') {
      existingQuery = existingQuery.eq('account_id', scope.accountId);
    } else {
      existingQuery = existingQuery
        .eq('user_id', scope.userId)
        .is('account_id', null);
    }

    const { data: existing } = await existingQuery.maybeSingle();
    const existingImageUrl =
      (existing as { image_url?: string | null } | null)?.image_url ?? null;

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
    if (!error && existingImageUrl) {
      try {
        await removeRecipeCover(existingImageUrl);
      } catch (coverError) {
        console.error(
          '[family-meal] cover remove failed:',
          coverError instanceof Error ? coverError.message : coverError,
        );
      }
    }
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

export async function logRecipeCookAction(
  input: LogRecipeCookInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = LogRecipeCookSchema.parse(input);
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();
    const scope = await resolveMealPlanScope(parsed.accountSlug);

    // Ensure the recipe is in scope before inserting the log (RLS also enforces).
    let recipeQuery = client
      .from('family_recipes')
      .select('id')
      .eq('id', parsed.recipeId);

    if (scope.kind === 'workspace') {
      recipeQuery = recipeQuery.eq('account_id', scope.accountId);
    } else {
      recipeQuery = recipeQuery
        .eq('user_id', scope.userId)
        .is('account_id', null);
    }

    const { data: recipe, error: recipeError } =
      await recipeQuery.maybeSingle();
    if (recipeError) return fail(recipeError);
    if (!recipe) return fail(new Error('Recipe not found'));

    const { data, error } = await client
      .from('family_recipe_logs')
      .insert({
        recipe_id: parsed.recipeId,
        logged_by: user.id,
        rating: parsed.rating ?? null,
        notes: parsed.notes?.trim() ? parsed.notes.trim() : null,
        cooked_at: parsed.cookedAt ?? new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) return fail(error);

    revalidateRecipePaths(scope, parsed.recipeId);
    return ok({ id: (data as { id: string }).id });
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
      nutrition_pending: recipe.ingredients.length > 0,
      updated_at: now,
    }));

    const { data, error } = await client
      .from('family_recipes')
      .insert(rows)
      .select('id, name, ingredients, instructions, servings');

    if (error) return fail(error);

    const inserted = (data ?? []) as Array<{
      id: string;
      name: string;
      ingredients: string[];
      instructions: string | null;
      servings: number | null;
    }>;

    const meterAccountId =
      scope.kind === 'workspace' ? scope.accountId : scope.userId;

    for (const recipe of inserted) {
      try {
        await syncRecipeStructure(client, {
          recipeId: recipe.id,
          ingredients: recipe.ingredients ?? [],
          instructions: recipe.instructions,
        });
      } catch (structureError) {
        console.error(
          '[family-meal] bulk structure sync failed:',
          structureError instanceof Error
            ? structureError.message
            : structureError,
        );
      }

      try {
        await refreshRecipeNutrition({
          client,
          recipeId: recipe.id,
          title: recipe.name,
          ingredients: recipe.ingredients ?? [],
          servings: recipe.servings,
        });
      } catch (nutritionError) {
        console.error(
          '[family-meal] bulk nutrition refresh failed:',
          nutritionError instanceof Error
            ? nutritionError.message
            : nutritionError,
        );
      }

      try {
        await refreshRecipePrepStep({
          client,
          recipeId: recipe.id,
          ingredients: recipe.ingredients ?? [],
          previousHash: null,
          accountId: meterAccountId,
        });
      } catch (prepError) {
        console.error(
          '[family-meal] bulk prep step refresh failed:',
          prepError instanceof Error ? prepError.message : prepError,
        );
      }
    }

    revalidateMealPlanPaths(scope);
    return ok({ added: inserted.length });
  } catch (err) {
    return fail(err);
  }
}

export async function retryRecipeNutritionAction(
  input: RetryRecipeNutritionInput,
): Promise<ActionResult> {
  try {
    const parsed = RetryRecipeNutritionSchema.parse(input);
    const client = getSupabaseServerClient();
    const scope = await resolveMealPlanScope(parsed.accountSlug);

    let recipeQuery = client
      .from('family_recipes')
      .select('id, name, ingredients, servings')
      .eq('id', parsed.recipeId);

    if (scope.kind === 'workspace') {
      recipeQuery = recipeQuery.eq('account_id', scope.accountId);
    } else {
      recipeQuery = recipeQuery
        .eq('user_id', scope.userId)
        .is('account_id', null);
    }

    const { data, error } = await recipeQuery.maybeSingle();
    if (error) return fail(error);
    if (!data) return fail(new Error('Recipe not found'));

    const recipe = data as {
      id: string;
      name: string;
      ingredients: string[];
      servings: number | null;
    };

    const nutrition = await refreshRecipeNutrition({
      client,
      recipeId: recipe.id,
      title: recipe.name,
      ingredients: recipe.ingredients ?? [],
      servings: recipe.servings,
    });

    revalidateRecipePaths(scope, recipe.id);

    if (nutrition.nutrition_pending) {
      return fail(
        new Error(
          'Nutrition analysis could not be completed. Please check your Edamam credentials or ingredient formatting and try again.',
        ),
      );
    }
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}
