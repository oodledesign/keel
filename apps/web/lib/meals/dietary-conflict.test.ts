import { describe, expect, it } from 'vitest';

import {
  findDietaryConflicts,
  findHouseholdDietaryConflicts,
  recipeMatchesDietaryFilter,
} from '~/lib/meals/dietary-conflict';

const chilli = {
  name: 'Beef chilli',
  diet_tags: [],
  ingredients: ['500g beef mince', '2 onions', '400g tomatoes'],
};

const dal = {
  name: 'Lentil dal',
  diet_tags: ['vegan', 'vegetarian'],
  ingredients: ['200g red lentils', '1 onion', '1 tsp cumin'],
};

const pesto = {
  name: 'Basil pesto pasta',
  diet_tags: ['vegetarian'],
  ingredients: ['200g pasta', '50g pine nuts', 'parmesan', 'basil'],
};

describe('recipeMatchesDietaryFilter', () => {
  it('keeps vegan recipes when vegan is required', () => {
    expect(recipeMatchesDietaryFilter(dal, ['vegan'])).toBe(true);
    expect(recipeMatchesDietaryFilter(chilli, ['vegan'])).toBe(false);
  });

  it('treats vegan recipes as vegetarian', () => {
    expect(recipeMatchesDietaryFilter(dal, ['vegetarian'])).toBe(true);
    expect(recipeMatchesDietaryFilter(chilli, ['vegetarian'])).toBe(false);
  });

  it('filters nut-free against nut ingredients', () => {
    expect(recipeMatchesDietaryFilter(pesto, ['nut-free'])).toBe(false);
    expect(recipeMatchesDietaryFilter(dal, ['nut-free'])).toBe(true);
  });
});

describe('findDietaryConflicts', () => {
  it('warns when a vegetarian person is assigned meat', () => {
    const conflicts = findDietaryConflicts({
      recipe: chilli,
      person: {
        name: 'Sam',
        dietary_tags: ['vegetarian'],
        excluded_ingredients: [],
      },
    });

    expect(conflicts.map((row) => row.message)).toEqual([
      'Beef chilli is not vegetarian for Sam',
    ]);
  });

  it('warns on excluded ingredients', () => {
    const conflicts = findDietaryConflicts({
      recipe: chilli,
      person: {
        name: 'Alex',
        dietary_tags: [],
        excluded_ingredients: ['onion'],
      },
    });

    expect(conflicts[0]).toMatchObject({
      kind: 'ingredient',
      ingredient: 'onion',
    });
  });

  it('warns nut-free people about nut recipes', () => {
    const conflicts = findDietaryConflicts({
      recipe: pesto,
      person: {
        name: 'Jo',
        dietary_tags: ['nut-free'],
        excluded_ingredients: [],
      },
    });

    expect(conflicts[0]?.tag).toBe('nut-free');
  });

  it('does not warn when tags match', () => {
    expect(
      findDietaryConflicts({
        recipe: dal,
        person: {
          name: 'Sam',
          dietary_tags: ['vegan'],
          excluded_ingredients: [],
        },
      }),
    ).toEqual([]);
  });
});

describe('findHouseholdDietaryConflicts', () => {
  it('includes household-level dietary requirements', () => {
    const conflicts = findHouseholdDietaryConflicts({
      recipe: chilli,
      people: [],
      householdDietaryTags: ['vegetarian'],
    });

    expect(conflicts[0]?.message).toContain('the household');
  });
});
