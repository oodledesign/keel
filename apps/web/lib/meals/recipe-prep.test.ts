import { describe, expect, it } from 'vitest';

import { normalisePrepContent } from '~/lib/meals/recipe-prep-utils';

describe('normalisePrepContent', () => {
  it('keeps action groups as plain lines', () => {
    expect(
      normalisePrepContent('Chop: onion, garlic\nMeasure out: stock'),
    ).toBe('Chop: onion, garlic\nMeasure out: stock');
  });

  it('strips markdown fences and Prep headings', () => {
    expect(normalisePrepContent('```\nPrep:\nChop: onion\n```')).toBe(
      'Chop: onion',
    );
  });

  it('drops empty lines', () => {
    expect(normalisePrepContent('Chop: garlic\n\n\nGet out: pan')).toBe(
      'Chop: garlic\nGet out: pan',
    );
  });
});
