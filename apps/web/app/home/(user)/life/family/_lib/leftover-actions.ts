'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { leftoverMealTitle, planLeftoverSlots } from '~/lib/meals/leftover-plan';

import { setMealEntryAction } from './actions';
import {
  type ApplyLeftoversInput,
  ApplyLeftoversSchema,
} from './schema/family-meal.schema';
import { resolveMealPlanScope } from './server/family-meal.scope';

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

export async function applyLeftoversAction(
  input: ApplyLeftoversInput,
): Promise<ActionResult<{ dates: string[] }>> {
  try {
    const parsed = ApplyLeftoversSchema.parse(input);
    const client = getSupabaseServerClient();
    const scope = await resolveMealPlanScope(parsed.accountSlug);
    const scopeFields = parsed.accountSlug
      ? { accountSlug: parsed.accountSlug }
      : {};

    let sourceQuery = client
      .from('family_meal_plan_entries')
      .select('id, title, recipe_id')
      .eq('plan_date', parsed.sourceDate)
      .eq('meal_type', parsed.mealType);

    if (scope.kind === 'workspace') {
      sourceQuery = sourceQuery.eq('account_id', scope.accountId);
    } else {
      sourceQuery = sourceQuery
        .eq('user_id', scope.userId)
        .is('account_id', null);
    }

    const { data: source, error: sourceError } = await sourceQuery.maybeSingle();
    if (sourceError) return fail(sourceError);
    if (!source) return fail(new Error('No meal found to turn into leftovers'));

    const sourceRow = source as {
      id: string;
      title: string;
      recipe_id: string | null;
    };

    const markSource = await setMealEntryAction({
      planDate: parsed.sourceDate,
      mealType: parsed.mealType,
      title: sourceRow.title,
      recipeId: sourceRow.recipe_id,
      isBatchPrep: true,
      leftoverSourceEntryId: null,
      ...scopeFields,
    });
    if (!markSource.success) return markSource;

    const slots = planLeftoverSlots({
      source: sourceRow,
      targetDates: parsed.targetDates.filter(
        (date) => date !== parsed.sourceDate,
      ),
    });

    for (const slot of slots) {
      const result = await setMealEntryAction({
        planDate: slot.planDate,
        mealType: parsed.mealType,
        title: leftoverMealTitle(sourceRow.title),
        recipeId: slot.recipeId,
        leftoverSourceEntryId: sourceRow.id,
        isBatchPrep: false,
        ...scopeFields,
      });
      if (!result.success) return result;
    }

    return ok({ dates: slots.map((slot) => slot.planDate) });
  } catch (err) {
    return fail(err);
  }
}
