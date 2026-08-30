export function buildRecipeDetailPath(basePath: string, recipeId: string) {
  return `${basePath}/recipes/${recipeId}`;
}

export function buildRecipesListPath(basePath: string) {
  return `${basePath}?tab=recipes`;
}

export function buildShoppingPath(accountSlug?: string, weekStart?: string) {
  const base = accountSlug
    ? `/app/${accountSlug}/shopping`
    : '/app/life/family/shopping';
  return weekStart ? `${base}?week=${weekStart}` : base;
}
