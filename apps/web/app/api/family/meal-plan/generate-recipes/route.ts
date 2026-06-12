import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { generateMealRecipes } from '~/lib/ai/meal-recipes-generate';
import { resolveMealPlanScope } from '~/home/(user)/life/family/_lib/server/family-meal.scope';
import {
  RECIPE_MEAL_TYPES,
  type MealPreferencesRow,
  type RecipeRow,
} from '~/home/(user)/life/family/_lib/schema/family-meal.schema';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  accountSlug: z.string().min(1).optional(),
  count: z.union([z.literal(5), z.literal(10)]),
  mealType: z.enum(RECIPE_MEAL_TYPES).default('dinner'),
  inspiration: z.string().trim().max(1_000).optional().default(''),
  favoriteDishes: z.string().trim().max(1_000).optional().default(''),
  useSavedFavorites: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const scope = await resolveMealPlanScope(parsed.data.accountSlug);

  const preferencesQuery =
    scope.kind === 'workspace'
      ? client
          .from('family_meal_preferences')
          .select('*')
          .eq('account_id', scope.accountId)
          .maybeSingle()
      : client
          .from('family_meal_preferences')
          .select('*')
          .eq('user_id', user.id)
          .is('account_id', null)
          .maybeSingle();

  const recipesQuery =
    scope.kind === 'workspace'
      ? client
          .from('family_recipes')
          .select('name, is_favorite')
          .eq('account_id', scope.accountId)
      : client
          .from('family_recipes')
          .select('name, is_favorite')
          .eq('user_id', user.id)
          .is('account_id', null);

  const [{ data: prefData }, { data: recipeData }] = await Promise.all([
    preferencesQuery,
    recipesQuery,
  ]);

  const preferences = prefData as MealPreferencesRow | null;
  const recipes = (recipeData ?? []) as Pick<RecipeRow, 'name' | 'is_favorite'>[];

  const favoriteRecipes = parsed.data.useSavedFavorites
    ? recipes.filter((r) => r.is_favorite).map((r) => r.name)
    : [];

  try {
    const generated = await generateMealRecipes({
      count: parsed.data.count,
      meal_type: parsed.data.mealType,
      dietary_requirements: preferences?.dietary_requirements ?? [],
      priorities: preferences?.priorities ?? [],
      disliked_ingredients: preferences?.disliked_ingredients ?? [],
      household_size: preferences?.household_size ?? 2,
      preference_notes: preferences?.notes ?? '',
      favorite_recipes: favoriteRecipes,
      favorite_dishes: parsed.data.favoriteDishes,
      inspiration: parsed.data.inspiration,
      use_saved_favorites: parsed.data.useSavedFavorites,
      existing_recipe_names: recipes.map((r) => r.name),
    });

    return NextResponse.json({ recipes: generated });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Could not generate recipes',
      },
      { status: 502 },
    );
  }
}
