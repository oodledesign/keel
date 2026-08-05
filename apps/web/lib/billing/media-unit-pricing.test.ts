import { describe, expect, it } from 'vitest';

import {
  MEDIA_SUBSCRIPTION_TIERS,
  MEDIA_TOPUP_PACKS,
  assertTopupWorseThanStarter,
  estimateImageBatchCost,
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
    expect(estimateJobCost('fal-ai/nano-banana/edit')).toBe(4);
    expect(estimateJobCost('fal-ai/nano-banana-pro/edit')).toBe(15);
    expect(
      estimateJobCost('fal-ai/minimax/video-01', { durationSeconds: 5 }),
    ).toBe(125);
  });

  it('estimates image batches from quality + variations', () => {
    expect(
      estimateImageBatchCost({
        hasRefs: false,
        quality: 'draft',
        variations: 4,
      }),
    ).toBe(8);
    expect(
      estimateImageBatchCost({
        hasRefs: true,
        quality: 'draft',
        variations: 4,
      }),
    ).toBe(16);
    expect(
      estimateImageBatchCost({
        hasRefs: true,
        quality: 'quality',
        variations: 1,
      }),
    ).toBe(15);
  });
});
