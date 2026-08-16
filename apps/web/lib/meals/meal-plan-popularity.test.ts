import { describe, expect, it } from 'vitest';

import {
  MEAL_PLAN_FAVOURITE_WEIGHT,
  type WeightedRecipeCandidate,
  buildWeightedRecipeLibrary,
  popularityScore,
} from '~/lib/meals/meal-plan-popularity';

function recipe(
  partial: Partial<WeightedRecipeCandidate> &
    Pick<WeightedRecipeCandidate, 'id' | 'name'>,
): WeightedRecipeCandidate {
  return {
    tags: [],
    meal_type: 'dinner',
    popularity_score: 0,
    times_cooked: 0,
    avg_rating: null,
    is_favorite: false,
    ...partial,
  };
}

describe('popularityScore', () => {
  it('weights repeated cooks above a single perfect rating', () => {
    const oncePerfect = popularityScore(5, 1);
    const sixTimesGood = popularityScore(4.5, 6);
    expect(sixTimesGood).toBeGreaterThan(oncePerfect);
  });

  it('treats missing ratings as zero', () => {
    expect(popularityScore(null, 10)).toBe(0);
  });
});

describe('buildWeightedRecipeLibrary', () => {
  it('returns the full library when smaller than the pool', () => {
    const input = [
      recipe({ id: '1', name: 'A', popularity_score: 5 }),
      recipe({ id: '2', name: 'B', popularity_score: 1 }),
    ];
    expect(buildWeightedRecipeLibrary(input, { poolSize: 10 })).toHaveLength(2);
  });

  it('keeps roughly favouriteWeight of slots from the top-scoring band', () => {
    const input = Array.from({ length: 20 }, (_, i) =>
      recipe({
        id: String(i),
        name: `Recipe ${i}`,
        popularity_score: 20 - i,
      }),
    );

    const pool = buildWeightedRecipeLibrary(input, {
      poolSize: 10,
      favouriteWeight: MEAL_PLAN_FAVOURITE_WEIGHT,
    });

    expect(pool).toHaveLength(10);

    const favouriteSlots = Math.round(10 * MEAL_PLAN_FAVOURITE_WEIGHT);
    const topIds = new Set(
      [...input]
        .sort((a, b) => b.popularity_score - a.popularity_score)
        .slice(0, favouriteSlots)
        .map((r) => r.id),
    );
    const fromTop = pool.filter((r) => topIds.has(r.id)).length;
    expect(fromTop).toBe(favouriteSlots);
  });
});
