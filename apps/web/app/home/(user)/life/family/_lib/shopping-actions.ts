'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  type AddShoppingItemInput,
  AddShoppingItemSchema,
  type GenerateShoppingListInput,
  GenerateShoppingListSchema,
  type ShoppingListItemRow,
  type ShoppingListWithItems,
  type ToggleShoppingItemInput,
  ToggleShoppingItemSchema,
} from './schema/family-shopping.schema';
import {
  resolveMealPlanScope,
  revalidateMealPlanPaths,
  revalidateShoppingPaths,
} from './server/family-meal.scope';
import { createFamilyShoppingService } from './server/family-shopping.service';

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

export type GenerateShoppingListResult =
  | { status: 'exists' }
  | { status: 'empty'; skippedMeals: string[] }
  | {
      status: 'created';
      list: ShoppingListWithItems;
      replaced: boolean;
    };

export async function generateShoppingListAction(
  input: GenerateShoppingListInput,
): Promise<ActionResult<GenerateShoppingListResult>> {
  try {
    const parsed = GenerateShoppingListSchema.parse(input);
    const client = getSupabaseServerClient();
    const scope = await resolveMealPlanScope(parsed.accountSlug);
    const service = createFamilyShoppingService(client);
    const result = await service.generateFromWeek({
      scope,
      weekStart: parsed.weekStart,
      replaceExisting: parsed.replaceExisting,
    });

    if (result.status === 'created') {
      revalidateShoppingPaths(scope);
      revalidateMealPlanPaths(scope);
    }

    return ok(result);
  } catch (err) {
    return fail(err);
  }
}

export async function toggleShoppingItemAction(
  input: ToggleShoppingItemInput,
): Promise<ActionResult> {
  try {
    const parsed = ToggleShoppingItemSchema.parse(input);
    const client = getSupabaseServerClient();
    const scope = await resolveMealPlanScope(parsed.accountSlug);
    const service = createFamilyShoppingService(client);
    await service.toggleItem(scope, parsed.itemId, parsed.checked);
    revalidateShoppingPaths(scope);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

export async function addShoppingItemAction(
  input: AddShoppingItemInput,
): Promise<ActionResult<{ item: ShoppingListItemRow }>> {
  try {
    const parsed = AddShoppingItemSchema.parse(input);
    const client = getSupabaseServerClient();
    const scope = await resolveMealPlanScope(parsed.accountSlug);
    const service = createFamilyShoppingService(client);
    const item = await service.addItem(scope, {
      listId: parsed.listId,
      weekStart: parsed.weekStart,
      text: parsed.text,
      clientItemId: parsed.clientItemId,
    });
    revalidateShoppingPaths(scope);
    return ok({ item });
  } catch (err) {
    return fail(err);
  }
}
