import { detectKeywordDietFlags } from '~/lib/meals/diet-tags';

export type DietaryConflictKind = 'diet' | 'ingredient';

export type DietaryConflict = {
  kind: DietaryConflictKind;
  tag?: string;
  ingredient?: string;
  message: string;
};

export type DietaryPerson = {
  id?: string;
  name: string;
  dietary_tags: string[];
  excluded_ingredients: string[];
};

export type DietaryRecipeInput = {
  name: string;
  diet_tags: string[];
  ingredients: string[];
  tags?: string[];
};

const NUT_PATTERNS =
  /\b(?:nuts?|peanuts?|almonds?|cashews?|walnuts?|hazelnuts?|pistachios?|pecans?|macadamia|peanut\s*butter|almond\s*butter|nut\s*butter)\b/i;

const GLUTEN_PATTERNS =
  /\b(?:wheat|flour|bread|pasta|spaghetti|noodle|barley|rye|couscous|semolina|breadcrumb|seitan|soy\s*sauce)\b/i;

const DAIRY_PATTERNS =
  /\b(?:milk|butter|cheese|cream|yoghurt|yogurt|ghee|whey|casein|parmesan|mozzarella|cheddar|feta|ricotta)\b/i;

function uniqueLower(values: string[]): string[] {
  return [
    ...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean)),
  ];
}

function recipeHasTag(recipe: DietaryRecipeInput, tag: string): boolean {
  const needle = tag.trim().toLowerCase();
  if (!needle) return false;
  const tags = [
    ...recipe.diet_tags,
    ...(recipe.tags ?? []),
  ].map((value) => value.trim().toLowerCase());
  return tags.includes(needle);
}

function ingredientHaystack(recipe: DietaryRecipeInput): string {
  return recipe.ingredients.join('\n');
}

function ingredientContains(recipe: DietaryRecipeInput, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return false;
  return recipe.ingredients.some((line) =>
    line.toLowerCase().includes(needle),
  );
}

/**
 * Whether a recipe is compatible with a required dietary tag (filter).
 * Unknown tags pass if the recipe lists that tag, otherwise they pass
 * (do not hide the library for custom labels we cannot evaluate).
 */
export function recipeMatchesDietaryFilter(
  recipe: DietaryRecipeInput,
  requiredTags: string[],
): boolean {
  const tags = uniqueLower(requiredTags);
  if (tags.length === 0) return true;

  const keyword = detectKeywordDietFlags(recipe.ingredients);

  for (const tag of tags) {
    if (tag === 'vegan') {
      if (!(recipeHasTag(recipe, 'vegan') || keyword.vegan)) return false;
      continue;
    }
    if (tag === 'vegetarian') {
      if (
        !(
          recipeHasTag(recipe, 'vegetarian') ||
          recipeHasTag(recipe, 'vegan') ||
          keyword.vegetarian
        )
      ) {
        return false;
      }
      continue;
    }
    if (tag === 'nut-free') {
      if (recipeHasTag(recipe, 'nut-free')) continue;
      if (NUT_PATTERNS.test(ingredientHaystack(recipe))) return false;
      continue;
    }
    if (tag === 'gluten-free') {
      if (recipeHasTag(recipe, 'gluten-free')) continue;
      if (GLUTEN_PATTERNS.test(ingredientHaystack(recipe))) return false;
      continue;
    }
    if (tag === 'dairy-free') {
      if (recipeHasTag(recipe, 'dairy-free') || recipeHasTag(recipe, 'vegan')) {
        continue;
      }
      if (DAIRY_PATTERNS.test(ingredientHaystack(recipe))) return false;
      continue;
    }
    if (!recipeHasTag(recipe, tag)) {
      return false;
    }
  }

  return true;
}

export function findDietaryConflicts(input: {
  recipe: DietaryRecipeInput;
  person: DietaryPerson;
}): DietaryConflict[] {
  const conflicts: DietaryConflict[] = [];
  const { recipe, person } = input;
  const who = person.name.trim() || 'Someone';
  const tags = uniqueLower(person.dietary_tags);
  const keyword = detectKeywordDietFlags(recipe.ingredients);
  const haystack = ingredientHaystack(recipe);

  for (const tag of tags) {
    if (tag === 'vegan' && !(recipeHasTag(recipe, 'vegan') || keyword.vegan)) {
      conflicts.push({
        kind: 'diet',
        tag,
        message: `${recipe.name} is not vegan for ${who}`,
      });
    }
    if (
      tag === 'vegetarian' &&
      !(
        recipeHasTag(recipe, 'vegetarian') ||
        recipeHasTag(recipe, 'vegan') ||
        keyword.vegetarian
      )
    ) {
      conflicts.push({
        kind: 'diet',
        tag,
        message: `${recipe.name} is not vegetarian for ${who}`,
      });
    }
    if (tag === 'nut-free' && !recipeHasTag(recipe, 'nut-free')) {
      if (NUT_PATTERNS.test(haystack)) {
        conflicts.push({
          kind: 'diet',
          tag,
          message: `${recipe.name} may contain nuts (${who} is nut-free)`,
        });
      }
    }
    if (tag === 'gluten-free' && !recipeHasTag(recipe, 'gluten-free')) {
      if (GLUTEN_PATTERNS.test(haystack)) {
        conflicts.push({
          kind: 'diet',
          tag,
          message: `${recipe.name} may contain gluten (${who} is gluten-free)`,
        });
      }
    }
    if (
      tag === 'dairy-free' &&
      !recipeHasTag(recipe, 'dairy-free') &&
      !recipeHasTag(recipe, 'vegan')
    ) {
      if (DAIRY_PATTERNS.test(haystack)) {
        conflicts.push({
          kind: 'diet',
          tag,
          message: `${recipe.name} may contain dairy (${who} is dairy-free)`,
        });
      }
    }
  }

  for (const ingredient of uniqueLower(person.excluded_ingredients)) {
    if (ingredientContains(recipe, ingredient)) {
      conflicts.push({
        kind: 'ingredient',
        ingredient,
        message: `${recipe.name} includes ${ingredient} (${who} avoids it)`,
      });
    }
  }

  return conflicts;
}

export function findHouseholdDietaryConflicts(input: {
  recipe: DietaryRecipeInput;
  people: DietaryPerson[];
  householdDietaryTags?: string[];
  householdDislikes?: string[];
}): DietaryConflict[] {
  const people = [...input.people];
  const householdTags = uniqueLower(input.householdDietaryTags ?? []);
  const householdDislikes = uniqueLower(input.householdDislikes ?? []);

  if (householdTags.length > 0 || householdDislikes.length > 0) {
    people.push({
      name: 'the household',
      dietary_tags: householdTags,
      excluded_ingredients: householdDislikes,
    });
  }

  const seen = new Set<string>();
  const conflicts: DietaryConflict[] = [];
  for (const person of people) {
    for (const conflict of findDietaryConflicts({
      recipe: input.recipe,
      person,
    })) {
      if (seen.has(conflict.message)) continue;
      seen.add(conflict.message);
      conflicts.push(conflict);
    }
  }
  return conflicts;
}
