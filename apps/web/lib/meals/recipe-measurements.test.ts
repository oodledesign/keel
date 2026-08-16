import { describe, expect, it } from 'vitest';

import {
  convertAmountUnit,
  formatIngredientDisplay,
  parseIngredientLine,
  renderStepContent,
} from '~/lib/meals/recipe-measurements';

describe('parseIngredientLine', () => {
  it('parses metric amounts with units', () => {
    expect(parseIngredientLine('200g pasta')).toMatchObject({
      amount: 200,
      unit: 'g',
      name: 'pasta',
    });
  });

  it('parses spoon measures', () => {
    expect(parseIngredientLine('2 tbsp olive oil')).toMatchObject({
      amount: 2,
      unit: 'tbsp',
      name: 'olive oil',
    });
  });

  it('keeps bare names', () => {
    expect(parseIngredientLine('salt')).toMatchObject({
      amount: null,
      unit: null,
      name: 'salt',
    });
  });
});

describe('formatIngredientDisplay', () => {
  it('scales with servings and converts to imperial', () => {
    expect(
      formatIngredientDisplay({
        name: 'pasta',
        amount: 200,
        unit: 'g',
        original_text: '200g pasta',
        servingsScale: 2,
        system: 'imperial',
      }),
    ).toMatch(/^14(\.\d+)? oz pasta$/);
  });
});

describe('renderStepContent', () => {
  it('replaces ingredient tokens with live scaled values', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const text = renderStepContent({
      content: `Add {${id}} and stir.`,
      ingredientsById: new Map([
        [
          id,
          {
            name: 'stock',
            amount: 500,
            unit: 'ml',
            original_text: '500ml stock',
          },
        ],
      ]),
      stepMultipliers: new Map([[id, 0.5]]),
      servingsScale: 1,
      system: 'metric',
    });

    expect(text).toBe('Add 250 ml stock and stir.');
  });
});

describe('convertAmountUnit', () => {
  it('converts grams to ounces', () => {
    const result = convertAmountUnit(28.3495, 'g', 'imperial');
    expect(result.unit).toBe('oz');
    expect(result.amount).toBeCloseTo(1, 2);
  });
});
