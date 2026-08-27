import { describe, expect, it } from 'vitest';

import { estimateWorkspacePlanCharge } from './workspace-plan-estimate';

describe('estimateWorkspacePlanCharge', () => {
  it('estimates commercial graduated monthly charge', () => {
    const result = estimateWorkspacePlanCharge({
      productId: 'ozer-commercial-property',
      billableSeats: 4,
      subscriptionItems: [
        {
          price_amount: null,
          quantity: 4,
          type: 'per_seat',
          interval: 'month',
        },
      ],
    });

    expect(result).toEqual({
      amountMinor: 25400,
      currency: 'gbp',
      interval: 'month',
      isEstimate: true,
    });
  });

  it('estimates business graduated yearly charge', () => {
    const result = estimateWorkspacePlanCharge({
      productId: 'ozer-business',
      billableSeats: 4,
      subscriptionItems: [
        {
          price_amount: null,
          quantity: 4,
          type: 'per_seat',
          interval: 'year',
        },
      ],
      planInterval: 'year',
    });

    expect(result).toEqual({
      amountMinor: 95000,
      currency: 'gbp',
      interval: 'year',
      isEstimate: true,
    });
  });

  it('uses stored line-item amounts for flat plans', () => {
    const result = estimateWorkspacePlanCharge({
      productId: 'ozer-community',
      billableSeats: 1,
      subscriptionItems: [
        {
          price_amount: 1200,
          quantity: 1,
          type: 'flat',
          interval: 'month',
        },
      ],
    });

    expect(result).toEqual({
      amountMinor: 1200,
      currency: 'gbp',
      interval: 'month',
      isEstimate: false,
    });
  });
});
