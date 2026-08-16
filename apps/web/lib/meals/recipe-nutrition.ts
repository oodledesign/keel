import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createHash } from 'node:crypto';

import type { Database } from '@kit/supabase/database';

import { detectKeywordDietFlags, mergeDietTags } from '~/lib/meals/diet-tags';

type Client = SupabaseClient<Database>;

const EDAMAM_NUTRITION_URL = 'https://api.edamam.com/api/nutrition-details';

export type RecipeNutritionValues = {
  calories_per_serving: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  diet_tags: string[];
  nutrition_computed_at: string | null;
  nutrition_pending: boolean;
};

export function hashRecipeIngredients(ingredients: string[]): string {
  const normalised = ingredients
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean)
    .join('\n');
  return createHash('sha256').update(normalised).digest('hex');
}

function getEdamamCredentials(): { appId: string; appKey: string } | null {
  const appId = process.env.EDAMAM_APP_ID?.trim();
  const appKey = process.env.EDAMAM_APP_KEY?.trim();
  if (!appId || !appKey) return null;
  return { appId, appKey };
}

function nutrientQuantity(
  totalNutrients: unknown,
  code: string,
): number | null {
  if (!totalNutrients || typeof totalNutrients !== 'object') return null;
  const entry = (totalNutrients as Record<string, unknown>)[code];

  const readQuantity = (value: unknown): number | null => {
    if (!value || typeof value !== 'object') return null;
    const quantity = (value as { quantity?: unknown }).quantity;
    return typeof quantity === 'number' && Number.isFinite(quantity)
      ? quantity
      : null;
  };

  if (Array.isArray(entry)) {
    return readQuantity(entry[0]);
  }

  return readQuantity(entry);
}

function roundMacro(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

type EdamamAnalysis = {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  yield: number | null;
  labels: string[];
};

async function analyseRecipeWithEdamam(input: {
  title: string;
  ingredients: string[];
  servings: number | null;
}): Promise<EdamamAnalysis> {
  const credentials = getEdamamCredentials();
  if (!credentials) {
    throw new Error('Edamam credentials are not configured');
  }

  const url = new URL(EDAMAM_NUTRITION_URL);
  url.searchParams.set('app_id', credentials.appId);
  url.searchParams.set('app_key', credentials.appKey);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      title: input.title,
      ingr: input.ingredients,
      ...(input.servings && input.servings > 0
        ? { yield: String(input.servings) }
        : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Edamam nutrition failed (HTTP ${response.status})${body ? `: ${body.slice(0, 200)}` : ''}`,
    );
  }

  const json = (await response.json()) as {
    calories?: unknown;
    yield?: unknown;
    dietLabels?: unknown;
    healthLabels?: unknown;
    totalNutrients?: unknown;
  };

  const labels = [
    ...(Array.isArray(json.dietLabels)
      ? json.dietLabels.filter(
          (item): item is string => typeof item === 'string',
        )
      : []),
    ...(Array.isArray(json.healthLabels)
      ? json.healthLabels.filter(
          (item): item is string => typeof item === 'string',
        )
      : []),
  ];

  return {
    calories:
      typeof json.calories === 'number' && Number.isFinite(json.calories)
        ? json.calories
        : null,
    protein_g: nutrientQuantity(json.totalNutrients, 'PROCNT'),
    carbs_g: nutrientQuantity(json.totalNutrients, 'CHOCDF'),
    fat_g: nutrientQuantity(json.totalNutrients, 'FAT'),
    yield:
      typeof json.yield === 'number' && json.yield > 0
        ? json.yield
        : input.servings && input.servings > 0
          ? input.servings
          : 1,
    labels,
  };
}

export function computeDietTagsOnly(ingredients: string[]): string[] {
  return mergeDietTags({
    keyword: detectKeywordDietFlags(ingredients),
    edamamLabels: [],
  });
}

export async function computeRecipeNutrition(input: {
  title: string;
  ingredients: string[];
  servings: number | null;
}): Promise<RecipeNutritionValues> {
  const keyword = detectKeywordDietFlags(input.ingredients);
  const now = new Date().toISOString();

  if (input.ingredients.length === 0) {
    return {
      calories_per_serving: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      diet_tags: mergeDietTags({ keyword, edamamLabels: [] }),
      nutrition_computed_at: now,
      nutrition_pending: false,
    };
  }

  try {
    const analysis = await analyseRecipeWithEdamam(input);
    const servings = analysis.yield && analysis.yield > 0 ? analysis.yield : 1;

    return {
      calories_per_serving:
        analysis.calories == null
          ? null
          : Math.max(0, Math.round(analysis.calories / servings)),
      protein_g: roundMacro(
        analysis.protein_g == null ? null : analysis.protein_g / servings,
      ),
      carbs_g: roundMacro(
        analysis.carbs_g == null ? null : analysis.carbs_g / servings,
      ),
      fat_g: roundMacro(
        analysis.fat_g == null ? null : analysis.fat_g / servings,
      ),
      diet_tags: mergeDietTags({
        keyword,
        edamamLabels: analysis.labels,
      }),
      nutrition_computed_at: now,
      nutrition_pending: false,
    };
  } catch {
    return {
      calories_per_serving: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      diet_tags: mergeDietTags({ keyword, edamamLabels: [] }),
      nutrition_computed_at: null,
      nutrition_pending: true,
    };
  }
}

export async function persistRecipeNutrition(
  client: Client,
  recipeId: string,
  nutrition: RecipeNutritionValues,
): Promise<void> {
  const { error } = await client
    .from('family_recipes')
    .update({
      calories_per_serving: nutrition.calories_per_serving,
      protein_g: nutrition.protein_g,
      carbs_g: nutrition.carbs_g,
      fat_g: nutrition.fat_g,
      diet_tags: nutrition.diet_tags,
      nutrition_computed_at: nutrition.nutrition_computed_at,
      nutrition_pending: nutrition.nutrition_pending,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recipeId);

  if (error) {
    throw error;
  }
}

export async function refreshRecipeNutrition(input: {
  client: Client;
  recipeId: string;
  title: string;
  ingredients: string[];
  servings: number | null;
}): Promise<RecipeNutritionValues> {
  const nutrition = await computeRecipeNutrition({
    title: input.title,
    ingredients: input.ingredients,
    servings: input.servings,
  });

  await persistRecipeNutrition(input.client, input.recipeId, nutrition);
  return nutrition;
}

export function ingredientsChanged(
  previous: string[] | null | undefined,
  next: string[],
): boolean {
  return hashRecipeIngredients(previous ?? []) !== hashRecipeIngredients(next);
}
