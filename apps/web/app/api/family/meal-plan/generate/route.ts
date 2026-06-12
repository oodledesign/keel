import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { generateMealPlan } from '~/lib/ai/meal-plan-generate';
import { chunkDates } from '~/home/(user)/life/family/_lib/server/family-meal.dates';
import { resolveMealPlanScope } from '~/home/(user)/life/family/_lib/server/family-meal.scope';
import type {
  MealPreferencesRow,
  RecipeRow,
} from '~/home/(user)/life/family/_lib/schema/family-meal.schema';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  mode: z.enum(['generate', 'fill']).default('generate'),
  accountSlug: z.string().min(1).optional(),
  dates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .min(1)
    .max(31),
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
          .select('id, name, tags, meal_type')
          .eq('account_id', scope.accountId)
      : client
          .from('family_recipes')
          .select('id, name, tags, meal_type')
          .eq('user_id', user.id)
          .is('account_id', null);

  const [{ data: prefData }, { data: recipeData }] = await Promise.all([
    preferencesQuery,
    recipesQuery,
  ]);

  const preferences = prefData as MealPreferencesRow | null;
  const recipes = (recipeData ?? []) as Pick<
    RecipeRow,
    'id' | 'name' | 'tags' | 'meal_type'
  >[];

  try {
    const basePayload = {
      dietary_requirements: preferences?.dietary_requirements ?? [],
      priorities: preferences?.priorities ?? [],
      disliked_ingredients: preferences?.disliked_ingredients ?? [],
      household_size: preferences?.household_size ?? 2,
      notes: preferences?.notes ?? '',
      recipe_library: recipes.map((r) => ({
        name: r.name,
        tags: r.tags,
        meal_type: r.meal_type,
      })),
    };

    const meals = [];
    for (const chunk of chunkDates(parsed.data.dates, 7)) {
      const chunkMeals = await generateMealPlan({
        ...basePayload,
        dates: chunk,
      });
      meals.push(...chunkMeals);
    }

    const recipeByName = new Map(
      recipes.map((r) => [r.name.trim().toLowerCase(), r.id]),
    );

    const suggestions = meals.map((meal) => ({
      date: meal.date,
      title: meal.title,
      description: meal.description,
      tags: meal.tags,
      recipeId: meal.recipe_match
        ? (recipeByName.get(meal.recipe_match.trim().toLowerCase()) ?? null)
        : null,
    }));

    return NextResponse.json({ meals: suggestions });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Could not generate meal plan',
      },
      { status: 502 },
    );
  }
}
