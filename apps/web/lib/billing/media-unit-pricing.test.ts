import { describe, expect, it } from 'vitest';

import {
  MEDIA_SUBSCRIPTION_TIERS,
  MEDIA_TOPUP_PACKS,
  assertTopupWorseThanStarter,
  estimateJobCost,
} from './media-unit-pricing';

describe('media unit pricing', () => {
  it('keeps top-up per-unit worse than Starter subscription', () => {
    expect(assertTopupWorseThanStarter()).toBe(true);
    const starter =
      MEDIA_SUBSCRIPTION_TIERS[0].priceGbp / MEDIA_SUBSCRIPTION_TIERS[0].units;
    for (const pack of MEDIA_TOPUP_PACKS) {
      expect(pack.priceGbp / pack.units).toBeGreaterThan(starter);
    }
  });

  it('estimates image and video costs via the shared helper', () => {
    expect(estimateJobCost('fal-ai/flux/schnell')).toBe(2);
    expect(estimateJobCost('fal-ai/flux/dev')).toBe(10);
    expect(
      estimateJobCost('fal-ai/minimax/video-01', { durationSeconds: 5 }),
    ).toBe(125);
  });
});
