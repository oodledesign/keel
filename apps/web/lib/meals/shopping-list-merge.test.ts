import { describe, expect, it } from 'vitest';

import {
  categoriseIngredient,
  mergeShoppingIngredients,
  parseAndMergeIngredientLines,
  scaleShoppingIngredient,
} from '~/lib/meals/shopping-list-merge';

describe('mergeShoppingIngredients', () => {
  it('merges the same ingredient with the same unit', () => {
    const merged = parseAndMergeIngredientLines(['2 onions', '1 onion']);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      amount: 3,
      unit: null,
      display_text: '3 onions',
    });
  });

  it('keeps different units split (tbsp vs kg)', () => {
    const merged = parseAndMergeIngredientLines([
      '2 tbsp olive oil',
      '1 kg olive oil',
    ]);

    expect(merged).toHaveLength(2);
    const units = merged.map((item) => item.unit).sort();
    expect(units).toEqual(['kg', 'tbsp']);
  });

  it('merges case and synonym variants of olive oil', () => {
    const merged = parseAndMergeIngredientLines([
      '2 tbsp Olive Oil',
      '1 tbsp extra virgin olive oil',
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      amount: 3,
      unit: 'tbsp',
    });
    expect(merged[0]!.display_text.toLowerCase()).toContain('olive oil');
  });

  it('merges compatible mass units (g + kg)', () => {
    const merged = parseAndMergeIngredientLines(['500g pasta', '1kg pasta']);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      amount: 1.5,
      unit: 'kg',
      display_text: '1.5 kg pasta',
    });
  });

  it('leaves unparseable lines as their own rows', () => {
    const merged = parseAndMergeIngredientLines([
      'salt and pepper to taste',
      'juice of 1 lemon',
      '2 onions',
    ]);

    expect(merged.map((item) => item.display_text)).toEqual(
      expect.arrayContaining([
        '2 onions',
        'salt and pepper to taste',
        'juice of 1 lemon',
      ]),
    );
    expect(merged.filter((item) => item.is_unparsed)).toHaveLength(2);
  });

  it('does not invent a merge across unrelated names', () => {
    const merged = mergeShoppingIngredients([
      { name: 'onion', amount: 2, unit: null, original_text: '2 onions' },
      {
        name: 'garlic',
        amount: 3,
        unit: null,
        original_text: '3 garlic cloves',
      },
    ]);

    expect(merged).toHaveLength(2);
  });
});

describe('categoriseIngredient', () => {
  it('groups common shop sections', () => {
    expect(categoriseIngredient('onion')).toBe('produce');
    expect(categoriseIngredient('chicken thighs')).toBe('meat_fish');
    expect(categoriseIngredient('cheddar')).toBe('dairy');
    expect(categoriseIngredient('olive oil')).toBe('store_cupboard');
    expect(categoriseIngredient('mystery mix')).toBe('other');
  });
});

describe('scaleShoppingIngredient', () => {
  it('scales amounts when a factor is provided', () => {
    expect(
      scaleShoppingIngredient(
        { name: 'pasta', amount: 200, unit: 'g', original_text: '200g pasta' },
        2,
      ).amount,
    ).toBe(400);
  });

  it('leaves lines without amounts untouched', () => {
    expect(
      scaleShoppingIngredient(
        { name: 'salt', amount: null, unit: null, original_text: 'salt' },
        3,
      ),
    ).toEqual({
      name: 'salt',
      amount: null,
      unit: null,
      original_text: 'salt',
    });
  });
});
