'use server';

import { normaliseIngredientName } from '~/lib/meals/shopping-list-merge';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  type DeleteHouseholdMemberInput,
  DeleteHouseholdMemberSchema,
  type DeletePantryItemInput,
  DeletePantryItemSchema,
  type HouseholdMemberInput,
  HouseholdMemberInputSchema,
  type PantryItemInput,
  PantryItemInputSchema,
} from './schema/family-meal.schema';
import {
  resolveMealPlanScope,
  revalidateMealPlanPaths,
  revalidateShoppingPaths,
} from './server/family-meal.scope';
import { applyMealPlanScope, fromUntypedTable } from './server/family-untyped';

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

export async function upsertHouseholdMemberAction(
  input: HouseholdMemberInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = HouseholdMemberInputSchema.parse(input);
    const scope = await resolveMealPlanScope(parsed.accountSlug);
    const now = new Date().toISOString();
    const values = {
      user_id: scope.userId,
      account_id: scope.kind === 'workspace' ? scope.accountId : null,
      display_name: parsed.displayName,
      dietary_tags: parsed.dietaryTags,
      excluded_ingredients: parsed.excludedIngredients,
      updated_at: now,
    };

    if (parsed.id) {
      const { data, error } = await applyMealPlanScope(
        fromUntypedTable('family_household_members')
          .update(values)
          .eq('id', parsed.id),
        scope,
      )
        .select('id')
        .single();

      if (error) return fail(error);
      revalidateMealPlanPaths(scope);
      return ok({ id: (data as { id: string }).id });
    }

    const { data, error } = await fromUntypedTable('family_household_members')
      .insert(values)
      .select('id')
      .single();

    if (error) return fail(error);
    revalidateMealPlanPaths(scope);
    return ok({ id: (data as { id: string }).id });
  } catch (err) {
    return fail(err);
  }
}

export async function deleteHouseholdMemberAction(
  input: DeleteHouseholdMemberInput,
): Promise<ActionResult> {
  try {
    const parsed = DeleteHouseholdMemberSchema.parse(input);
    const scope = await resolveMealPlanScope(parsed.accountSlug);
    const { error } = await applyMealPlanScope(
      fromUntypedTable('family_household_members')
        .delete()
        .eq('id', parsed.memberId),
      scope,
    );

    if (error) return fail(error);
    revalidateMealPlanPaths(scope);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

export async function upsertPantryItemAction(
  input: PantryItemInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = PantryItemInputSchema.parse(input);
    const scope = await resolveMealPlanScope(parsed.accountSlug);
    const normalized = normaliseIngredientName(parsed.name);
    if (!normalized) {
      return fail(new Error('Enter an ingredient name'));
    }

    const values = {
      user_id: scope.userId,
      account_id: scope.kind === 'workspace' ? scope.accountId : null,
      name: parsed.name,
      normalized_name: normalized,
      notes: parsed.notes ?? null,
      updated_at: new Date().toISOString(),
    };

    if (parsed.id) {
      const { data, error } = await applyMealPlanScope(
        fromUntypedTable('family_pantry_items')
          .update(values)
          .eq('id', parsed.id),
        scope,
      )
        .select('id')
        .single();

      if (error) return fail(error);
      revalidateMealPlanPaths(scope);
      revalidateShoppingPaths(scope);
      return ok({ id: (data as { id: string }).id });
    }

    const { data, error } = await fromUntypedTable('family_pantry_items')
      .insert(values)
      .select('id')
      .single();

    if (error) return fail(error);
    revalidateMealPlanPaths(scope);
    revalidateShoppingPaths(scope);
    return ok({ id: (data as { id: string }).id });
  } catch (err) {
    return fail(err);
  }
}

export async function deletePantryItemAction(
  input: DeletePantryItemInput,
): Promise<ActionResult> {
  try {
    const parsed = DeletePantryItemSchema.parse(input);
    const scope = await resolveMealPlanScope(parsed.accountSlug);
    const { error } = await applyMealPlanScope(
      fromUntypedTable('family_pantry_items').delete().eq('id', parsed.itemId),
      scope,
    );

    if (error) return fail(error);
    revalidateMealPlanPaths(scope);
    revalidateShoppingPaths(scope);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

export function editorDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const meta = user.user_metadata ?? {};
  const candidates = [meta.full_name, meta.name, meta.display_name];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  const email = user.email?.trim();
  if (email) return email.split('@')[0] ?? email;
  return 'Someone';
}

export async function currentEditorDisplayName() {
  const user = await requireUserInServerComponent();
  return editorDisplayName(user);
}
