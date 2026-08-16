import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

import { callAI } from '~/lib/ai/router';
import {
  PREP_STEP_SORT_ORDER,
  PREP_STEP_TITLE,
  normalisePrepContent,
} from '~/lib/meals/recipe-prep-utils';
import { hashRecipeIngredients } from '~/lib/meals/recipe-nutrition';

export {
  PREP_STEP_SORT_ORDER,
  PREP_STEP_TITLE,
  normalisePrepContent,
} from '~/lib/meals/recipe-prep-utils';

type Client = SupabaseClient<Database>;

const PREP_FEATURE = 'recipe_prep' as const;

const PREP_SYSTEM_PROMPT = `You write a short mise-en-place Prep step for a family cook.

Return ONLY plain text (no markdown, no JSON, no title line). Group ingredients by action on separate lines, using British English. Prefer concise groups such as:
Chop: onion, garlic
Measure out: stock, spices
Get out: pan, chopping board

Rules:
- Only use ingredients from the list. Do not invent items.
- Skip grouping that adds no value (e.g. do not list "salt" under Measure unless useful).
- Prefer verbs: Chop, Slice, Dice, Mince, Measure out, Drain, Open, Get out, Soften, Bring to room temperature.
- One line per group. Max 8 lines.
- If almost nothing needs prep, return a single short line like "No special prep — ingredients are ready to use."
- Never wrap the answer in quotes or code fences.`;

export async function generatePrepContent(
  ingredients: string[],
  meter: { accountId: string; supabase: Client },
): Promise<string> {
  const list = ingredients.map((line) => line.trim()).filter(Boolean);
  if (list.length === 0) {
    return 'No special prep — ingredients are ready to use.';
  }

  const text = await callAI({
    feature: PREP_FEATURE,
    systemPrompt: PREP_SYSTEM_PROMPT,
    userPrompt: `Write the Prep step for these ingredients:\n${list.map((line) => `- ${line}`).join('\n')}`,
    accountId: meter.accountId,
    supabase: meter.supabase,
  });

  const normalised = normalisePrepContent(text);
  if (!normalised) {
    throw new Error('Prep generation returned empty content');
  }
  return normalised;
}

/**
 * Upsert the sort_order 0 Prep step when the ingredient hash changes.
 * Failures are logged by the caller — do not block recipe save.
 */
export async function refreshRecipePrepStep(input: {
  client: Client;
  recipeId: string;
  ingredients: string[];
  previousHash: string | null;
  accountId: string;
}): Promise<{ hash: string | null }> {
  const nextHash =
    input.ingredients.filter((line) => line.trim()).length > 0
      ? hashRecipeIngredients(input.ingredients)
      : null;

  if (nextHash && nextHash === input.previousHash) {
    const { data: existingPrep, error: existingError } = await input.client
      .from('family_recipe_steps')
      .select('id')
      .eq('recipe_id', input.recipeId)
      .eq('title', PREP_STEP_TITLE)
      .eq('sort_order', PREP_STEP_SORT_ORDER)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingPrep) {
      return { hash: nextHash };
    }
    // Hash matches but Prep step missing — fall through and regenerate.
  }

  if (!nextHash) {
    const { error: deleteError } = await input.client
      .from('family_recipe_steps')
      .delete()
      .eq('recipe_id', input.recipeId)
      .eq('title', PREP_STEP_TITLE)
      .eq('sort_order', PREP_STEP_SORT_ORDER);

    if (deleteError) throw deleteError;

    const { error: clearHashError } = await input.client
      .from('family_recipes')
      .update({
        prep_ingredients_hash: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.recipeId);

    if (clearHashError) throw clearHashError;
    return { hash: null };
  }

  const content = await generatePrepContent(input.ingredients, {
    accountId: input.accountId,
    supabase: input.client,
  });

  const { data: existing, error: readError } = await input.client
    .from('family_recipe_steps')
    .select('id')
    .eq('recipe_id', input.recipeId)
    .eq('title', PREP_STEP_TITLE)
    .eq('sort_order', PREP_STEP_SORT_ORDER)
    .maybeSingle();

  if (readError) throw readError;

  if (existing) {
    const { error: updateError } = await input.client
      .from('family_recipe_steps')
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (existing as { id: string }).id);

    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await input.client
      .from('family_recipe_steps')
      .insert({
        recipe_id: input.recipeId,
        sort_order: PREP_STEP_SORT_ORDER,
        title: PREP_STEP_TITLE,
        content,
        timer_seconds: null,
      });

    if (insertError) throw insertError;
  }

  const { error: hashError } = await input.client
    .from('family_recipes')
    .update({
      prep_ingredients_hash: nextHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.recipeId);

  if (hashError) throw hashError;

  return { hash: nextHash };
}
