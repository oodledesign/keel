import { describe, expect, it } from 'vitest';

import { computePeaks } from './audio-waveform.client';

describe('computePeaks', () => {
  it('normalizes peaks to 0–1', () => {
    const data = new Float32Array([0, 0.5, -1, 0.25, 0, 0]);
    const peaks = computePeaks(data, 3);
    expect(peaks).toHaveLength(3);
    expect(Math.max(...peaks)).toBeCloseTo(1, 5);
    expect(peaks.every((p) => p >= 0 && p <= 1)).toBe(true);
  });

  it('returns zeros for empty input', () => {
    expect(computePeaks(new Float32Array(), 4)).toEqual([0, 0, 0, 0]);
  });
});
