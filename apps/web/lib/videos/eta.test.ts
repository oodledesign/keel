import { describe, expect, it } from 'vitest';

import { estimateSecondsLeft, formatSecondsLeft } from './eta';

describe('estimateSecondsLeft', () => {
  it('waits for a usable signal', () => {
    expect(
      estimateSecondsLeft({
        fraction: 0.1,
        startFraction: 0.1,
        elapsedMs: 9000,
      }),
    ).toBeNull();
    expect(
      estimateSecondsLeft({
        fraction: 0.2,
        startFraction: 0.1,
        elapsedMs: 1000,
      }),
    ).toBeNull();
  });

  it('extrapolates from the observed rate', () => {
    // 50% gained in 60s → 60s left.
    expect(
      estimateSecondsLeft({
        fraction: 0.5,
        startFraction: 0,
        elapsedMs: 60000,
      }),
    ).toBe(60);
  });

  it('is zero when complete', () => {
    expect(
      estimateSecondsLeft({ fraction: 1, startFraction: 0, elapsedMs: 0 }),
    ).toBe(0);
  });
});

describe('formatSecondsLeft', () => {
  it('formats ranges', () => {
    expect(formatSecondsLeft(null)).toBeNull();
    expect(formatSecondsLeft(4)).toBe('a few seconds left');
    expect(formatSecondsLeft(42)).toBe('about 40s left');
    expect(formatSecondsLeft(61)).toBe('about 2 min left');
    expect(formatSecondsLeft(3900)).toBe('about 1h 5m left');
  });
});
