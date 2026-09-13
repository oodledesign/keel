export function buildRecipeDetailPath(basePath: string, recipeId: string) {
  return `${basePath}/recipes/${recipeId}`;
}

export function buildRecipeCookPath(basePath: string, recipeId: string) {
  return `${basePath}/recipes/${recipeId}/cook`;
}

export function buildRecipesListPath(basePath: string) {
  return `${basePath}?tab=recipes`;
}

export function buildRecipeBooksListPath(basePath: string) {
  return `${basePath}?tab=books`;
}

export function buildRecipeBookDetailPath(basePath: string, bookId: string) {
  return `${basePath}/recipe-books/${bookId}`;
}

export function buildShoppingPath(accountSlug?: string, weekStart?: string) {
  const base = accountSlug
    ? `/app/${accountSlug}/shopping`
    : '/app/life/family/shopping';
  return weekStart ? `${base}?week=${weekStart}` : base;
}
