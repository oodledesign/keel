import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

import {
  contentHasIngredientTokens,
  parseIngredientLine,
  tokeniseIngredientMentions,
} from '~/lib/meals/recipe-measurements';
import { replaceStepIngredientLinks } from '~/lib/meals/recipe-step-ingredients';

type Client = SupabaseClient<Database>;

/**
 * Rebuild structured ingredients from free-text lines and ensure a Method step
 * exists (or refresh a sole auto Method step). Additive — does not wipe custom
 * multi-step methods when more than one step is already present.
 *
 * Method text is tokenised with `{ingredient_id}` placeholders where names match,
 * so amounts can live-update with servings / unit system.
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

  let structuredIngredients: Array<{ id: string; name: string }> = [];

  if (parsed.length > 0) {
    const { data: inserted, error: insertIngredientsError } = await client
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
      )
      .select('id, name');

    if (insertIngredientsError) throw insertIngredientsError;
    structuredIngredients = (inserted ?? []) as Array<{
      id: string;
      name: string;
    }>;
  }

  const { data: steps, error: stepsError } = await client
    .from('family_recipe_steps')
    .select('id, title, sort_order, content')
    .eq('recipe_id', input.recipeId)
    .order('sort_order', { ascending: true });

  if (stepsError) throw stepsError;

  const existing = (steps ?? []) as Array<{
    id: string;
    title: string;
    sort_order: number;
    content: string;
  }>;

  const rawMethod = input.instructions?.trim() || 'No instructions yet.';
  const tokenised = tokeniseIngredientMentions(
    rawMethod,
    structuredIngredients,
  );
  const methodContent = tokenised.content;

  const methodStep = existing.find((step) => step.title === 'Method');

  if (methodStep) {
    // Skip the write when the content is identical and already tokenised so
    // we avoid unnecessary DB churn on repeated saves. For recipes created
    // before tokenisation was introduced, `!contentHasIngredientTokens` forces
    // the update even when the raw instructions text has not changed.
    const alreadyUpToDate =
      methodStep.content === methodContent &&
      contentHasIngredientTokens(methodStep.content);

    if (!alreadyUpToDate) {
      const { error: updateStepError } = await client
        .from('family_recipe_steps')
        .update({
          content: methodContent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', methodStep.id);

      if (updateStepError) throw updateStepError;
      await replaceStepIngredientLinks(
        client,
        methodStep.id,
        tokenised.ingredientIds,
      );
    }
    return;
  }

  const { data: insertedStep, error: insertStepError } = await client
    .from('family_recipe_steps')
    .insert({
      recipe_id: input.recipeId,
      sort_order: 1,
      title: 'Method',
      content: methodContent,
      timer_seconds: null,
    })
    .select('id')
    .single();

  if (insertStepError) throw insertStepError;

  await replaceStepIngredientLinks(
    client,
    (insertedStep as { id: string }).id,
    tokenised.ingredientIds,
  );
}
