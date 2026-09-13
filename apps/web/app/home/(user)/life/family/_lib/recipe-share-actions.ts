'use server';

import { z } from 'zod';

import { generatePublicShareToken } from '~/lib/videos/public-share.server';

import {
  RotateRecipeBookShareTokenSchema,
  RotateRecipeShareTokenSchema,
  SetRecipeBookPublicShareSchema,
  SetRecipePublicShareSchema,
} from './schema/family-meal.schema';
import {
  type MealPlanScope,
  resolveMealPlanScope,
  revalidateRecipeBookPaths,
  revalidateRecipePaths,
} from './server/family-meal.scope';
import { applyMealPlanScope, fromUntypedTable } from './server/family-untyped';

type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

type ShareState = { enabled: boolean; token: string | null };

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

function applyScope(
  query: ReturnType<typeof fromUntypedTable>,
  scope: MealPlanScope,
) {
  return applyMealPlanScope(query, scope);
}

async function updateShareState({
  table,
  id,
  scope,
  enabled,
  rotate,
}: {
  table: string;
  id: string;
  scope: MealPlanScope;
  enabled?: boolean;
  rotate?: boolean;
}): Promise<ShareState> {
  const { data: existing, error: readError } = await applyScope(
    fromUntypedTable(table)
      .select('public_share_enabled, public_share_token')
      .eq('id', id),
    scope,
  ).maybeSingle();

  if (readError) throw readError;
  if (!existing) {
    throw new Error(
      table === 'family_recipe_books'
        ? 'Recipe book not found'
        : 'Recipe not found',
    );
  }

  const row = existing as unknown as {
    public_share_enabled: boolean | null;
    public_share_token: string | null;
  };
  const currentToken = row.public_share_token ?? null;
  const nextEnabled = enabled ?? Boolean(row.public_share_enabled);
  const nextToken =
    rotate || (nextEnabled && !currentToken)
      ? generatePublicShareToken()
      : currentToken;

  const { data, error } = await applyScope(
    fromUntypedTable(table)
      .update({
        public_share_enabled: nextEnabled,
        public_share_token: nextToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id),
    scope,
  )
    .select('public_share_enabled, public_share_token')
    .single();

  if (error) throw error;

  const updated = data as unknown as {
    public_share_enabled: boolean | null;
    public_share_token: string | null;
  };

  return {
    enabled: Boolean(updated.public_share_enabled),
    token: updated.public_share_token ?? null,
  };
}

export async function setRecipePublicShareAction(
  input: z.infer<typeof SetRecipePublicShareSchema>,
): Promise<ActionResult<ShareState>> {
  try {
    const parsed = SetRecipePublicShareSchema.parse(input);
    const scope = await resolveMealPlanScope(parsed.accountSlug);
    const data = await updateShareState({
      table: 'family_recipes',
      id: parsed.recipeId,
      scope,
      enabled: parsed.enabled,
    });
    revalidateRecipePaths(scope, parsed.recipeId);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function rotateRecipeShareTokenAction(
  input: z.infer<typeof RotateRecipeShareTokenSchema>,
): Promise<ActionResult<ShareState>> {
  try {
    const parsed = RotateRecipeShareTokenSchema.parse(input);
    const scope = await resolveMealPlanScope(parsed.accountSlug);
    const data = await updateShareState({
      table: 'family_recipes',
      id: parsed.recipeId,
      scope,
      enabled: true,
      rotate: true,
    });
    revalidateRecipePaths(scope, parsed.recipeId);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function setRecipeBookPublicShareAction(
  input: z.infer<typeof SetRecipeBookPublicShareSchema>,
): Promise<ActionResult<ShareState>> {
  try {
    const parsed = SetRecipeBookPublicShareSchema.parse(input);
    const scope = await resolveMealPlanScope(parsed.accountSlug);
    const data = await updateShareState({
      table: 'family_recipe_books',
      id: parsed.bookId,
      scope,
      enabled: parsed.enabled,
    });
    revalidateRecipeBookPaths(scope, parsed.bookId);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function rotateRecipeBookShareTokenAction(
  input: z.infer<typeof RotateRecipeBookShareTokenSchema>,
): Promise<ActionResult<ShareState>> {
  try {
    const parsed = RotateRecipeBookShareTokenSchema.parse(input);
    const scope = await resolveMealPlanScope(parsed.accountSlug);
    const data = await updateShareState({
      table: 'family_recipe_books',
      id: parsed.bookId,
      scope,
      enabled: true,
      rotate: true,
    });
    revalidateRecipeBookPaths(scope, parsed.bookId);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}
