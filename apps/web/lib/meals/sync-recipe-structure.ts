import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

import { parseIngredientLine } from '~/lib/meals/recipe-measurements';

type Client = SupabaseClient<Database>;

/**
 * Rebuild structured ingredients from free-text lines and ensure a Method step
 * exists (or refresh a sole auto Method step). Additive — does not wipe custom
 * multi-step methods when more than one step is already present.
 */
export async function syncRecipeStructure(
  client: Client,
  input: {
    recipeId: string;
    ingredients: string[];
    instructions: string | null;
  },
): Promise<void> {
  const parsed = input.ingredients
    .map((line) => parseIngredientLine(line))
    .filter((line) => line.original_text);

  // Replace structured ingredients for this recipe.
  const { error: deleteIngredientsError } = await client
    .from('family_recipe_ingredients')
    .delete()
    .eq('recipe_id', input.recipeId);

  if (deleteIngredientsError) throw deleteIngredientsError;

  if (parsed.length > 0) {
    const { error: insertIngredientsError } = await client
      .from('family_recipe_ingredients')
      .insert(
        parsed.map((line, index) => ({
          recipe_id: input.recipeId,
          sort_order: index,
          name: line.name || line.original_text,
          amount: line.amount,
          unit: line.unit,
          original_text: line.original_text,
        })),
      );

    if (insertIngredientsError) throw insertIngredientsError;
  }

  const { data: steps, error: stepsError } = await client
    .from('family_recipe_steps')
    .select('id, title, sort_order')
    .eq('recipe_id', input.recipeId)
    .order('sort_order', { ascending: true });

  if (stepsError) throw stepsError;

  const existing = (steps ?? []) as Array<{
    id: string;
    title: string;
    sort_order: number;
  }>;

  const methodContent =
    input.instructions?.trim() || 'No instructions yet.';

  const methodStep = existing.find((step) => step.title === 'Method');

  if (methodStep) {
    // Refresh Method content; leave other steps (e.g. Prep) alone.
    const { error: updateStepError } = await client
      .from('family_recipe_steps')
      .update({
        content: methodContent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', methodStep.id);

    if (updateStepError) throw updateStepError;
    return;
  }

  const { error: insertStepError } = await client
    .from('family_recipe_steps')
    .insert({
      recipe_id: input.recipeId,
      sort_order: 1,
      title: 'Method',
      content: methodContent,
      timer_seconds: null,
    });
  if (insertStepError) throw insertStepError;
}
