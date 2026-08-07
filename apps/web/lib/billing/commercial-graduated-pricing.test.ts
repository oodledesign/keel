import { describe, expect, it } from 'vitest';

import {
  clampBillableSeats,
  estimateMonthlyGbp,
  freeSupportSeats,
  illustrativeTierForSeats,
  maxMembersForBillableSeats,
  portalPublishingAllowed,
} from './commercial-graduated-pricing';

describe('commercial graduated pricing', () => {
  it('estimates Solo / Team / Scale worked examples', () => {
    expect(estimateMonthlyGbp(1)).toBe(89);
    // 89 + 55×3 = 254
    expect(estimateMonthlyGbp(4)).toBe(254);
    // 89 + 55×6 + 39×3 = 89 + 330 + 117 = 536
    expect(estimateMonthlyGbp(10)).toBe(536);
  });

  it('returns free support seats by band', () => {
    expect(freeSupportSeats(1)).toBe(0);
    expect(freeSupportSeats(2)).toBe(2);
    expect(freeSupportSeats(7)).toBe(2);
    expect(freeSupportSeats(8)).toBe(4);
  });

  it('computes max memberships including free support', () => {
    expect(maxMembersForBillableSeats(1)).toBe(1);
    expect(maxMembersForBillableSeats(4)).toBe(6);
    expect(maxMembersForBillableSeats(10)).toBe(14);
  });

  it('gates portal publishing at 2+ billable seats', () => {
    expect(portalPublishingAllowed(1)).toBe(false);
    expect(portalPublishingAllowed(2)).toBe(true);
  });

  it('maps illustrative labels and clamps seats', () => {
    expect(illustrativeTierForSeats(1).id).toBe('solo');
    expect(illustrativeTierForSeats(5).id).toBe('team');
    expect(illustrativeTierForSeats(12).id).toBe('scale');
    expect(clampBillableSeats(0)).toBe(1);
    expect(clampBillableSeats(3.9)).toBe(3);
  });
});
