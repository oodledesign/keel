import { describe, expect, it } from 'vitest';

import {
  contentHasIngredientTokens,
  convertAmountUnit,
  formatIngredientDisplay,
  parseIngredientLine,
  renderStepContent,
  tokeniseIngredientMentions,
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

  it('can hide amounts for method text', () => {
    expect(
      formatIngredientDisplay({
        name: 'pasta',
        amount: 200,
        unit: 'g',
        original_text: '200g pasta',
        servingsScale: 1,
        system: 'metric',
        includeAmount: false,
      }),
    ).toBe('pasta');
  });

  it('formats volumes as cups and spoons', () => {
    expect(
      formatIngredientDisplay({
        name: 'stock',
        amount: 240,
        unit: 'ml',
        original_text: '240ml stock',
        servingsScale: 1,
        system: 'cups',
      }),
    ).toBe('1 cup stock');

    expect(
      formatIngredientDisplay({
        name: 'oil',
        amount: 15,
        unit: 'ml',
        original_text: '15ml oil',
        servingsScale: 1,
        system: 'cups',
      }),
    ).toBe('1 tbsp oil');
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

  it('converts millilitres to cups', () => {
    const result = convertAmountUnit(120, 'ml', 'cups');
    expect(result.unit).toBe('cup');
    expect(result.amount).toBeCloseTo(0.5, 2);
  });

  it('converts oz to g in cups mode (mass stays metric)', () => {
    const result = convertAmountUnit(1, 'oz', 'cups');
    expect(result.unit).toBe('g');
    expect(result.amount).toBeCloseTo(28.35, 1);
  });

  it('converts lb to kg in cups mode', () => {
    const result = convertAmountUnit(1, 'lb', 'cups');
    expect(result.unit).toBe('kg');
    expect(result.amount).toBeCloseTo(0.454, 2);
  });
});

describe('tokeniseIngredientMentions', () => {
  it('replaces names with tokens and preserves existing tokens', () => {
    const onion = '11111111-1111-4111-8111-111111111111';
    const garlic = '22222222-2222-4222-8222-222222222222';

    const result = tokeniseIngredientMentions(
      'Chop: onion, garlic\nMeasure out: stock',
      [
        { id: onion, name: 'onion' },
        { id: garlic, name: 'garlic' },
        { id: '33333333-3333-4333-8333-333333333333', name: 'stock' },
      ],
    );

    expect(result.content).toContain(`{${onion}}`);
    expect(result.content).toContain(`{${garlic}}`);
    expect(result.ingredientIds).toContain(onion);
    expect(contentHasIngredientTokens(result.content)).toBe(true);
  });

  it('does not double-tokenise pre-existing tokens', () => {
    const onionId = '11111111-1111-4111-8111-111111111111';
    const garlicId = '22222222-2222-4222-8222-222222222222';

    // onion is already tokenised; garlic is plain text
    const result = tokeniseIngredientMentions(
      `Add {${onionId}} and garlic.`,
      [
        { id: onionId, name: 'onion' },
        { id: garlicId, name: 'garlic' },
      ],
    );

    expect(result.content).toBe(`Add {${onionId}} and {${garlicId}}.`);
    expect(result.ingredientIds).toContain(onionId);
    expect(result.ingredientIds).toContain(garlicId);
  });

  it('matches names without parenthetical notes', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const result = tokeniseIngredientMentions('Measure out: basmati rice', [
      { id, name: 'basmati rice (uncooked)' },
    ]);

    expect(result.content).toBe(`Measure out: {${id}}`);
  });
});
