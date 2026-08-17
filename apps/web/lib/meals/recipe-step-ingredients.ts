import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

type Client = SupabaseClient<Database>;

/**
 * Atomically replace all step→ingredient links for a single step.
 * Deletes existing rows first, then inserts the new set.
 */
export async function replaceStepIngredientLinks(
  client: Client,
  stepId: string,
  ingredientIds: string[],
): Promise<void> {
  const { error: deleteError } = await client
    .from('family_recipe_step_ingredients')
    .delete()
    .eq('step_id', stepId);

  if (deleteError) throw deleteError;

  if (ingredientIds.length === 0) return;

  const { error: insertError } = await client
    .from('family_recipe_step_ingredients')
    .insert(
      ingredientIds.map((ingredientId) => ({
        step_id: stepId,
        ingredient_id: ingredientId,
        quantity_multiplier: 1,
      })),
    );

  if (insertError) throw insertError;
}
