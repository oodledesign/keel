import { describe, expect, it } from 'vitest';

import {
  leftoverMealTitle,
  nextEmptyDates,
  planLeftoverSlots,
  shouldSkipShoppingForMeal,
  suggestLeftoverDates,
} from '~/lib/meals/leftover-plan';

describe('leftoverMealTitle', () => {
  it('prefixes a source title', () => {
    expect(leftoverMealTitle('Chilli')).toBe('Leftovers: Chilli');
  });

  it('does not double-prefix leftovers', () => {
    expect(leftoverMealTitle('Leftovers: Chilli')).toBe('Leftovers: Chilli');
  });
});

describe('shouldSkipShoppingForMeal', () => {
  it('skips title leftovers and sourced leftovers', () => {
    expect(shouldSkipShoppingForMeal({ title: 'Leftovers' })).toBe(true);
    expect(
      shouldSkipShoppingForMeal({
        title: 'Chilli',
        leftover_source_entry_id: 'abc',
      }),
    ).toBe(true);
    expect(shouldSkipShoppingForMeal({ title: 'Chilli' })).toBe(false);
  });
});

describe('nextEmptyDates / suggestLeftoverDates', () => {
  const week = [
    '2026-09-14',
    '2026-09-15',
    '2026-09-16',
    '2026-09-17',
    '2026-09-18',
    '2026-09-19',
    '2026-09-20',
  ];

  it('picks the next empty days after a Sunday batch cook', () => {
    expect(
      nextEmptyDates({
        sourceDate: '2026-09-13',
        weekDates: week,
        occupiedDates: ['2026-09-16'],
        count: 2,
      }),
    ).toEqual(['2026-09-14', '2026-09-15']);
  });

  it('skips occupied days when suggesting leftovers', () => {
    expect(
      suggestLeftoverDates({
        sourceDate: '2026-09-14',
        weekDates: week,
        occupiedDates: ['2026-09-15', '2026-09-17'],
        count: 2,
      }),
    ).toEqual(['2026-09-16', '2026-09-18']);
  });
});

describe('planLeftoverSlots', () => {
  it('copies the source recipe onto leftover days', () => {
    expect(
      planLeftoverSlots({
        source: { id: 'entry-1', title: 'Chilli', recipe_id: 'rec-1' },
        targetDates: ['2026-09-15', '2026-09-16'],
      }),
    ).toEqual([
      {
        planDate: '2026-09-15',
        title: 'Leftovers: Chilli',
        recipeId: 'rec-1',
        leftoverSourceEntryId: 'entry-1',
        isBatchPrep: false,
      },
      {
        planDate: '2026-09-16',
        title: 'Leftovers: Chilli',
        recipeId: 'rec-1',
        leftoverSourceEntryId: 'entry-1',
        isBatchPrep: false,
      },
    ]);
  });
});
