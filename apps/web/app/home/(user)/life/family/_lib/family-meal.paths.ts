export function buildRecipeDetailPath(basePath: string, recipeId: string) {
  return `${basePath}/recipes/${recipeId}`;
}

export function buildRecipesListPath(basePath: string) {
  return `${basePath}?tab=recipes`;
}
