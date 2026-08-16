import { describe, expect, it } from 'vitest';

import {
  isInstagramRecipeUrl,
  isoDurationToMinutes,
  mapSchemaOrgRecipe,
} from '~/lib/ai/recipe-extract-utils';

describe('isoDurationToMinutes', () => {
  it('parses common ISO-8601 cook times', () => {
    expect(isoDurationToMinutes('PT45M')).toBe(45);
    expect(isoDurationToMinutes('PT1H30M')).toBe(90);
    expect(isoDurationToMinutes('PT2H')).toBe(120);
    expect(isoDurationToMinutes('P1DT2H')).toBe(1560);
  });

  it('returns null for invalid values', () => {
    expect(isoDurationToMinutes(null)).toBeNull();
    expect(isoDurationToMinutes('45 minutes')).toBeNull();
    expect(isoDurationToMinutes('')).toBeNull();
  });
});

describe('isInstagramRecipeUrl', () => {
  it('accepts post and reel links', () => {
    expect(isInstagramRecipeUrl('https://www.instagram.com/p/AbCdEf123/')).toBe(
      true,
    );
    expect(
      isInstagramRecipeUrl('https://instagram.com/reel/AbCdEf123/?igsh=1'),
    ).toBe(true);
  });

  it('rejects non-recipe Instagram paths', () => {
    expect(isInstagramRecipeUrl('https://www.instagram.com/explore/')).toBe(
      false,
    );
    expect(isInstagramRecipeUrl('https://example.com/p/x')).toBe(false);
  });
});

describe('mapSchemaOrgRecipe', () => {
  it('maps a schema.org Recipe object into family_recipes draft fields', () => {
    const draft = mapSchemaOrgRecipe({
      '@type': 'Recipe',
      name: 'Lemon chicken',
      description: 'Weeknight favourite',
      recipeIngredient: ['4 chicken thighs', '1 lemon'],
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Season the chicken' },
        { '@type': 'HowToStep', text: 'Roast for 35 minutes' },
      ],
      recipeCuisine: 'Mediterranean',
      recipeCategory: 'Dinner',
      prepTime: 'PT15M',
      cookTime: 'PT35M',
      recipeYield: '4 servings',
    });

    expect(draft).toMatchObject({
      name: 'Lemon chicken',
      description: 'Weeknight favourite',
      ingredients: ['4 chicken thighs', '1 lemon'],
      meal_type: 'dinner',
      prep_minutes: 15,
      cook_minutes: 35,
      servings: 4,
      is_favorite: false,
      source: 'ai',
    });
    expect(draft?.instructions).toContain('Season the chicken');
    expect(draft?.tags).toEqual(
      expect.arrayContaining(['Mediterranean', 'Dinner']),
    );
  });
});
