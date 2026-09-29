import { describe, expect, it } from 'vitest';

import {
  computeWipStageForecasts,
  formatWipStageForecast,
  wipStageForecast,
} from './wip-stage-forecasts';

describe('computeWipStageForecasts', () => {
  it('counts instructions and sums fees per normalised stage', () => {
    const forecasts = computeWipStageForecasts([
      { stage: 'billed', value: 10_000 },
      { stage: 'completed_exchanged', value: 2_500 },
      { stage: 'under_offer', value: 4_000 },
      { stage: 'under_offer_negotiating', value: 250 },
      { stage: 'negotiating', value: 800 },
      { stage: 'current', value: null },
      { stage: 'managed', value: Number.NaN },
    ]);

    expect(wipStageForecast(forecasts, 'billed')).toEqual({
      count: 1,
      fee: 10_000,
    });
    expect(wipStageForecast(forecasts, 'completed')).toEqual({
      count: 1,
      fee: 2_500,
    });
    expect(wipStageForecast(forecasts, 'under_offer')).toEqual({
      count: 2,
      fee: 4_250,
    });
    expect(wipStageForecast(forecasts, 'negotiating')).toEqual({
      count: 1,
      fee: 800,
    });
    expect(wipStageForecast(forecasts, 'current')).toEqual({
      count: 1,
      fee: 0,
    });
    expect(wipStageForecast(forecasts, 'potential')).toEqual({
      count: 0,
      fee: 0,
    });
  });

  it('formats a count and GBP fee', () => {
    expect(formatWipStageForecast({ count: 3, fee: 12500 })).toBe(
      '3 · £12,500',
    );
  });
});
