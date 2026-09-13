import { describe, expect, it } from 'vitest';

import {
  applyPantryToShoppingItems,
  pantryMatchesIngredient,
} from '~/lib/meals/shopping-pantry';

describe('pantryMatchesIngredient', () => {
  it('matches synonyms and singular forms', () => {
    expect(pantryMatchesIngredient('2 onions', 'onion')).toBe(true);
    expect(pantryMatchesIngredient('extra virgin olive oil', 'olive oil')).toBe(
      true,
    );
  });

  it('does not let a short token match everything', () => {
    expect(pantryMatchesIngredient('sunflower oil', 'oil')).toBe(false);
    expect(pantryMatchesIngredient('chicken stock', 'stock cube')).toBe(false);
  });
});

describe('applyPantryToShoppingItems', () => {
  it('flags matching items as in pantry', () => {
    const flagged = applyPantryToShoppingItems(
      [
        { name: 'onion', display_text: '3 onions' },
        { name: 'garlic', display_text: '4 garlic cloves' },
      ],
      ['onions'],
    );

    expect(flagged[0]?.in_pantry).toBe(true);
    expect(flagged[1]?.in_pantry).toBe(false);
  });
});
