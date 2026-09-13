'use server';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  DeleteRecipeBookSchema,
  RecipeBookInputSchema,
} from './schema/family-meal.schema';
import {
  type MealPlanScope,
  resolveMealPlanScope,
  revalidateMealPlanPaths,
  revalidateRecipeBookPaths,
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

function fromTable(table: string) {
  const client = getSupabaseServerClient();
  return (
    client as unknown as {
      from: (name: string) => ReturnType<typeof client.from>;
    }
  ).from(table);
}

function applyScope<
  T extends {
    eq: (column: string, value: string) => T;
    is: (column: string, value: null) => T;
  },
>(query: T, scope: MealPlanScope): T {
  if (scope.kind === 'workspace') {
    return query.eq('account_id', scope.accountId);
  }

  return query.eq('user_id', scope.userId).is('account_id', null);
}

async function replaceBookItems(
  bookId: string,
  recipeIds: string[],
  scope: MealPlanScope,
) {
  if (recipeIds.length > 0) {
    const { data: recipes, error: recipesError } = await applyScope(
      fromTable('family_recipes').select('id').in('id', recipeIds),
      scope,
    );

    if (recipesError) throw recipesError;

    const allowed = new Set(
      (recipes ?? []).map((row) => (row as { id: string }).id),
    );
    if (recipeIds.some((id) => !allowed.has(id))) {
      throw new Error('One or more recipes are not in this library');
    }
  }

  const { error: deleteError } = await fromTable('family_recipe_book_items')
    .delete()
    .eq('book_id', bookId);

  if (deleteError) throw deleteError;

  if (recipeIds.length === 0) return;

  const { error: insertError } = await fromTable(
    'family_recipe_book_items',
  ).insert(
    recipeIds.map((recipeId, index) => ({
      book_id: bookId,
      recipe_id: recipeId,
      sort_order: index,
    })),
  );

  if (insertError) throw insertError;
}

export async function upsertRecipeBookAction(
  input: z.infer<typeof RecipeBookInputSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = RecipeBookInputSchema.parse(input);
    const scope = await resolveMealPlanScope(parsed.accountSlug);
    const now = new Date().toISOString();
    const values = {
      user_id: scope.userId,
      account_id: scope.kind === 'workspace' ? scope.accountId : null,
      name: parsed.name,
      description: parsed.description ?? null,
      updated_at: now,
    };

    let bookId: string;

    if (parsed.id) {
      const { data, error } = await applyScope(
        fromTable('family_recipe_books').update(values).eq('id', parsed.id),
        scope,
      )
        .select('id')
        .single();

      if (error) return fail(error);
      bookId = (data as { id: string }).id;
    } else {
      const { data, error } = await fromTable('family_recipe_books')
        .insert(values)
        .select('id')
        .single();

      if (error) return fail(error);
      bookId = (data as { id: string }).id;
    }

    await replaceBookItems(bookId, parsed.recipeIds, scope);
    revalidateRecipeBookPaths(scope, bookId);
    return ok({ id: bookId });
  } catch (err) {
    return fail(err);
  }
}

export async function deleteRecipeBookAction(
  input: z.infer<typeof DeleteRecipeBookSchema>,
): Promise<ActionResult> {
  try {
    const parsed = DeleteRecipeBookSchema.parse(input);
    const scope = await resolveMealPlanScope(parsed.accountSlug);
    const { error } = await applyScope(
      fromTable('family_recipe_books').delete().eq('id', parsed.bookId),
      scope,
    );

    if (error) return fail(error);
    revalidateMealPlanPaths(scope);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}
