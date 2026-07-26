import { describe, expect, it } from 'vitest';

import { pickMostFrequentAccountId } from './pick-most-frequent-account-id';

describe('pickMostFrequentAccountId', () => {
  it('returns the most common workspace', () => {
    expect(
      pickMostFrequentAccountId(['a', 'b', 'a', 'a', 'b', null]),
    ).toBe('a');
  });

  it('returns null when empty', () => {
    expect(pickMostFrequentAccountId([])).toBeNull();
  });
});
