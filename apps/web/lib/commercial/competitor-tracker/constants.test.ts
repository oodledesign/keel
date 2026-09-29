import { describe, expect, it } from 'vitest';

import {
  COMPETITOR_CATEGORIES,
  COMPETITOR_CATEGORY_LABELS,
  normalizeCompetitorCategory,
} from './constants';

describe('competitor categories', () => {
  it('offers exactly the agreed categories', () => {
    expect([...COMPETITOR_CATEGORIES]).toEqual([
      'industrial',
      'offices',
      'retail',
      'investments',
      'land',
    ]);
    expect(COMPETITOR_CATEGORY_LABELS.retail).toBe('Retail (Class E)');
  });

  it('normalises common spellings, including the old development value', () => {
    expect(normalizeCompetitorCategory('Office')).toBe('offices');
    expect(normalizeCompetitorCategory('Class E')).toBe('retail');
    expect(normalizeCompetitorCategory('Investment')).toBe('investments');
    expect(normalizeCompetitorCategory('development')).toBe('land');
    expect(normalizeCompetitorCategory('Land')).toBe('land');
    expect(normalizeCompetitorCategory('unknown')).toBe('industrial');
  });
});
