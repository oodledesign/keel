/**
 * Share of the meal-plan candidate pool drawn from higher-scoring recipes.
 * The remainder is drawn from everything else so generation does not loop the
 * same handful of meals. Tunable without a redeploy.
 */
export const MEAL_PLAN_FAVOURITE_WEIGHT = 0.7;

/** Default size of the recipe library sent to the meal-plan model. */
export const MEAL_PLAN_LIBRARY_POOL_SIZE = 40;

export type RecipePopularityRow = {
  recipe_id: string;
  times_cooked: number;
  avg_rating: number | null;
  popularity_score: number;
};

export type WeightedRecipeCandidate = {
  id: string;
  name: string;
  tags: string[];
  meal_type: string;
  popularity_score: number;
  times_cooked: number;
  avg_rating: number | null;
  is_favorite: boolean;
};

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

function takeRandom<T>(items: T[], count: number): T[] {
  if (count <= 0 || items.length === 0) return [];
  if (count >= items.length) return shuffleInPlace([...items]);
  return shuffleInPlace([...items]).slice(0, count);
}

/**
 * Build a weighted candidate pool for meal-plan generation.
 * Roughly `favouriteWeight` of slots come from the higher-scoring half of the
 * library; the rest come from lower-scoring recipes for variety.
 */
export function buildWeightedRecipeLibrary(
  recipes: WeightedRecipeCandidate[],
  options?: {
    poolSize?: number;
    favouriteWeight?: number;
  },
): WeightedRecipeCandidate[] {
  const poolSize = Math.min(
    options?.poolSize ?? MEAL_PLAN_LIBRARY_POOL_SIZE,
    recipes.length,
  );
  const favouriteWeight = Math.min(
    1,
    Math.max(0, options?.favouriteWeight ?? MEAL_PLAN_FAVOURITE_WEIGHT),
  );

  if (recipes.length === 0 || poolSize === 0) return [];
  if (recipes.length <= poolSize) {
    return shuffleInPlace([...recipes]);
  }

  const sorted = [...recipes].sort((a, b) => {
    if (b.popularity_score !== a.popularity_score) {
      return b.popularity_score - a.popularity_score;
    }
    if (Number(b.is_favorite) !== Number(a.is_favorite)) {
      return Number(b.is_favorite) - Number(a.is_favorite);
    }
    return a.name.localeCompare(b.name);
  });

  const favouriteSlots = Math.max(1, Math.round(poolSize * favouriteWeight));
  const otherSlots = Math.max(0, poolSize - favouriteSlots);

  // Top-scored recipes fill the favourite share; the remainder is sampled from
  // everything else so generation does not loop the same handful of meals.
  const selectedFavourites = sorted.slice(0, favouriteSlots);
  const remaining = sorted.slice(favouriteSlots);
  const selectedOthers = takeRandom(remaining, otherSlots);

  return shuffleInPlace([...selectedFavourites, ...selectedOthers]);
}

export function popularityScore(
  avgRating: number | null | undefined,
  timesCooked: number,
): number {
  const rating =
    typeof avgRating === 'number' && Number.isFinite(avgRating) ? avgRating : 0;
  const cooked = Math.max(0, timesCooked);
  return rating * Math.log(cooked + 1);
}
