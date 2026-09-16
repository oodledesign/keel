import { describe, expect, it } from 'vitest';

import {
  isEpcFieldOverridden,
  mergeEpcWithOverrides,
  overriddenEpcFields,
  parsePulledSnapshot,
  snapshotEpcFields,
} from './overrides';

const pulled = snapshotEpcFields({
  currentRating: 'E',
  potentialRating: 'C',
  lodgementDate: '2020-06-11',
  floorArea: 55,
  fuelType: 'mains gas',
  recommendationsSummary: 'Loft insulation',
});

describe('overriddenEpcFields', () => {
  it('returns empty when current matches the auto-pulled snapshot', () => {
    expect(overriddenEpcFields(pulled, pulled)).toEqual([]);
  });

  it('lists only the fields the surveyor changed', () => {
    expect(
      overriddenEpcFields(pulled, {
        ...pulled,
        currentRating: 'D',
        floorArea: 62,
        fuelType: '  mains gas  ',
      }),
    ).toEqual(['currentRating', 'floorArea']);
  });

  it('treats blank and null as the same', () => {
    expect(
      overriddenEpcFields(
        { ...pulled, fuelType: null },
        { ...pulled, fuelType: '   ' },
      ),
    ).toEqual([]);
  });
});

describe('mergeEpcWithOverrides', () => {
  it('keeps edited fields and takes a fresh pull for the rest', () => {
    const merged = mergeEpcWithOverrides(
      { ...pulled, currentRating: 'D', floorArea: 70 },
      { ...pulled, currentRating: 'C', fuelType: 'oil' },
      ['currentRating', 'fuelType'],
    );

    expect(merged).toEqual({
      currentRating: 'C',
      potentialRating: 'C',
      lodgementDate: '2020-06-11',
      floorArea: 70,
      fuelType: 'oil',
      recommendationsSummary: 'Loft insulation',
    });
  });
});

describe('parsePulledSnapshot', () => {
  it('reads camelCase or snake_case snapshots', () => {
    expect(
      parsePulledSnapshot({
        current_rating: 'E',
        potentialRating: 'C',
        floor_area: '55',
      }),
    ).toEqual({
      currentRating: 'E',
      potentialRating: 'C',
      lodgementDate: null,
      floorArea: 55,
      fuelType: null,
      recommendationsSummary: null,
    });
  });
});

describe('isEpcFieldOverridden', () => {
  it('ignores unknown field names', () => {
    expect(isEpcFieldOverridden('fuelType', ['fuelType', 'unknown'])).toBe(
      true,
    );
    expect(isEpcFieldOverridden('floorArea', ['fuelType'])).toBe(false);
  });
});
