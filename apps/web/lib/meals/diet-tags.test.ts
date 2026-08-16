import { describe, expect, it } from 'vitest';

import {
  detectKeywordDietFlags,
  mergeDietTags,
  normaliseEdamamLabel,
} from '~/lib/meals/diet-tags';

describe('detectKeywordDietFlags', () => {
  it('flags meat as neither vegetarian nor vegan', () => {
    expect(detectKeywordDietFlags(['2 chicken thighs', '1 lemon'])).toEqual({
      vegetarian: false,
      vegan: false,
    });
  });

  it('flags honey as vegetarian but not vegan', () => {
    expect(detectKeywordDietFlags(['oats', '1 tbsp honey'])).toEqual({
      vegetarian: true,
      vegan: false,
    });
  });

  it('treats plant-only lists as vegan', () => {
    expect(
      detectKeywordDietFlags(['200g chickpeas', 'olive oil', 'garlic']),
    ).toEqual({
      vegetarian: true,
      vegan: true,
    });
  });

  it('catches fish sauce and gelatine', () => {
    expect(detectKeywordDietFlags(['2 tbsp fish sauce'])).toMatchObject({
      vegetarian: false,
      vegan: false,
    });
    expect(detectKeywordDietFlags(['2 sheets gelatine'])).toMatchObject({
      vegetarian: false,
      vegan: false,
    });
  });

  it('catches common UK plural forms: prawns, mussels, sardines, sausages', () => {
    expect(detectKeywordDietFlags(['300g king prawns', 'garlic butter'])).toMatchObject({
      vegetarian: false,
      vegan: false,
    });
    expect(detectKeywordDietFlags(['500g fresh mussels', 'white wine', 'cream'])).toMatchObject({
      vegetarian: false,
      vegan: false,
    });
    expect(detectKeywordDietFlags(['1 tin sardines in olive oil'])).toMatchObject({
      vegetarian: false,
      vegan: false,
    });
    expect(detectKeywordDietFlags(['4 pork sausages', 'mashed potato'])).toMatchObject({
      vegetarian: false,
      vegan: false,
    });
  });
});

describe('mergeDietTags', () => {
  it('lets the keyword pass win on vegetarian/vegan disagreement', () => {
    const tags = mergeDietTags({
      keyword: { vegetarian: false, vegan: false },
      edamamLabels: ['VEGAN', 'VEGETARIAN', 'LOW_CARB'],
    });

    expect(tags).toContain('low-carb');
    expect(tags).not.toContain('vegan');
    expect(tags).not.toContain('vegetarian');
  });

  it('adds vegan and vegetarian when keyword says vegan', () => {
    const tags = mergeDietTags({
      keyword: { vegetarian: true, vegan: true },
      edamamLabels: ['GLUTEN_FREE'],
    });

    expect(tags).toEqual(['gluten-free', 'vegan', 'vegetarian']);
  });
});

describe('normaliseEdamamLabel', () => {
  it('maps known labels and drops noise', () => {
    expect(normaliseEdamamLabel('LOW_CARB')).toBe('low-carb');
    expect(normaliseEdamamLabel('HIGH_FIBER')).toBe('high-fibre');
    expect(normaliseEdamamLabel('ALCOHOL_FREE')).toBeNull();
  });
});
