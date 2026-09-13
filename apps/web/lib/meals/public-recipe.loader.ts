import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type {
  RecipeIngredientRow,
  RecipeMealType,
  RecipeSource,
  RecipeStepRow,
  RecipeStructure,
} from '~/home/(user)/life/family/_lib/schema/family-meal.schema';

import { isUsableShareToken } from './public-recipe-share';

export type PublicRecipeView = {
  id: string;
  name: string;
  description: string | null;
  ingredients: string[];
  instructions: string | null;
  tags: string[];
  mealType: RecipeMealType;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  source: RecipeSource;
  sourceLabel: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  caloriesPerServing: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  dietTags: string[];
  structure: RecipeStructure;
  publicShareToken: string | null;
};

export type PublicRecipeBookView = {
  id: string;
  name: string;
  description: string | null;
  recipes: PublicRecipeView[];
};

type RecipeShareRow = {
  id: string;
  name: string;
  description: string | null;
  ingredients: string[] | null;
  instructions: string | null;
  tags: string[] | null;
  meal_type: string;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  source: string;
  source_label: string | null;
  source_url: string | null;
  image_url: string | null;
  calories_per_serving: number | null;
  protein_g: number | string | null;
  carbs_g: number | string | null;
  fat_g: number | string | null;
  diet_tags: string[] | null;
  public_share_enabled?: boolean | null;
  public_share_token?: string | null;
};

const RECIPE_SELECT =
  'id, name, description, ingredients, instructions, tags, meal_type, prep_minutes, cook_minutes, servings, source, source_label, source_url, image_url, calories_per_serving, protein_g, carbs_g, fat_g, diet_tags, public_share_enabled, public_share_token';

function adminClient() {
  return getSupabaseServerAdminClient() as unknown as SupabaseClient;
}

function fromAdmin(client: SupabaseClient, table: string) {
  return (
    client as unknown as {
      from: (name: string) => ReturnType<SupabaseClient['from']>;
    }
  ).from(table);
}

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function loadRecipeStructure(
  client: SupabaseClient,
  recipeId: string,
): Promise<RecipeStructure> {
  const [ingredientsResult, stepsResult] = await Promise.all([
    client
      .from('family_recipe_ingredients')
      .select('id, recipe_id, sort_order, name, amount, unit, original_text')
      .eq('recipe_id', recipeId)
      .order('sort_order', { ascending: true }),
    client
      .from('family_recipe_steps')
      .select('id, recipe_id, sort_order, title, content, timer_seconds')
      .eq('recipe_id', recipeId)
      .order('sort_order', { ascending: true }),
  ]);

  const ingredients = (ingredientsResult.data ?? []).map((row) => {
    const r = row as {
      id: string;
      recipe_id: string;
      sort_order: number;
      name: string;
      amount: number | string | null;
      unit: string | null;
      original_text: string;
    };
    return {
      id: r.id,
      recipe_id: r.recipe_id,
      sort_order: r.sort_order,
      name: r.name,
      amount: r.amount == null ? null : Number(r.amount),
      unit: r.unit,
      original_text: r.original_text,
    } satisfies RecipeIngredientRow;
  });

  const stepsRaw = (stepsResult.data ?? []) as Array<{
    id: string;
    recipe_id: string;
    sort_order: number;
    title: string;
    content: string;
    timer_seconds: number | null;
  }>;

  const stepIds = stepsRaw.map((step) => step.id);
  const multipliersByStep = new Map<string, Record<string, number>>();

  if (stepIds.length > 0) {
    const { data: links } = await client
      .from('family_recipe_step_ingredients')
      .select('step_id, ingredient_id, quantity_multiplier')
      .in('step_id', stepIds);

    for (const link of links ?? []) {
      const row = link as {
        step_id: string;
        ingredient_id: string;
        quantity_multiplier: number | string;
      };
      const current = multipliersByStep.get(row.step_id) ?? {};
      current[row.ingredient_id] = Number(row.quantity_multiplier) || 1;
      multipliersByStep.set(row.step_id, current);
    }
  }

  const steps: RecipeStepRow[] = stepsRaw.map((step) => ({
    ...step,
    ingredient_multipliers: multipliersByStep.get(step.id) ?? {},
  }));

  return { ingredients, steps };
}

function toPublicRecipeView(
  row: RecipeShareRow,
  structure: RecipeStructure,
): PublicRecipeView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ingredients: row.ingredients ?? [],
    instructions: row.instructions,
    tags: row.tags ?? [],
    mealType: (row.meal_type as RecipeMealType) ?? 'any',
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    servings: row.servings,
    source: (row.source as RecipeSource) ?? 'manual',
    sourceLabel: row.source_label,
    sourceUrl: row.source_url,
    imageUrl: row.image_url,
    caloriesPerServing: row.calories_per_serving,
    proteinG: asNumber(row.protein_g),
    carbsG: asNumber(row.carbs_g),
    fatG: asNumber(row.fat_g),
    dietTags: row.diet_tags ?? [],
    structure,
    publicShareToken:
      row.public_share_enabled && isUsableShareToken(row.public_share_token)
        ? row.public_share_token
        : null,
  };
}

export async function loadPublicRecipeByToken(
  token: string,
): Promise<PublicRecipeView | null> {
  const normalized = token.trim();
  if (!isUsableShareToken(normalized)) {
    return null;
  }

  const admin = adminClient();
  const { data, error } = await admin
    .from('family_recipes')
    .select(RECIPE_SELECT)
    .eq('public_share_token', normalized)
    .eq('public_share_enabled', true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as RecipeShareRow;
  const structure = await loadRecipeStructure(admin, row.id);
  return toPublicRecipeView(row, structure);
}

export async function loadPublicRecipeBookByToken(
  token: string,
): Promise<PublicRecipeBookView | null> {
  const normalized = token.trim();
  if (!isUsableShareToken(normalized)) {
    return null;
  }

  const admin = adminClient();
  const { data: book, error } = await fromAdmin(admin, 'family_recipe_books')
    .select('id, name, description')
    .eq('public_share_token', normalized)
    .eq('public_share_enabled', true)
    .maybeSingle();

  if (error || !book) {
    return null;
  }

  const bookRow = book as {
    id: string;
    name: string;
    description: string | null;
  };

  const { data: items, error: itemsError } = await fromAdmin(
    admin,
    'family_recipe_book_items',
  )
    .select('recipe_id, sort_order')
    .eq('book_id', bookRow.id)
    .order('sort_order', { ascending: true });

  if (itemsError) {
    console.error('[public-recipe] load book items:', itemsError.message);
    return {
      id: bookRow.id,
      name: bookRow.name,
      description: bookRow.description,
      recipes: [],
    };
  }

  const orderedIds = (items ?? []).map(
    (item) => (item as { recipe_id: string }).recipe_id,
  );

  if (orderedIds.length === 0) {
    return {
      id: bookRow.id,
      name: bookRow.name,
      description: bookRow.description,
      recipes: [],
    };
  }

  const { data: recipeRows, error: recipesError } = await admin
    .from('family_recipes')
    .select(RECIPE_SELECT)
    .in('id', orderedIds);

  if (recipesError) {
    console.error('[public-recipe] load book recipes:', recipesError.message);
    return {
      id: bookRow.id,
      name: bookRow.name,
      description: bookRow.description,
      recipes: [],
    };
  }

  const byId = new Map(
    ((recipeRows ?? []) as RecipeShareRow[]).map((row) => [row.id, row]),
  );

  const recipes: PublicRecipeView[] = [];
  for (const recipeId of orderedIds) {
    const row = byId.get(recipeId);
    if (!row) continue;
    const structure = await loadRecipeStructure(admin, row.id);
    recipes.push(toPublicRecipeView(row, structure));
  }

  return {
    id: bookRow.id,
    name: bookRow.name,
    description: bookRow.description,
    recipes,
  };
}
