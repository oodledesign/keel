import { describe, expect, it } from 'vitest';

import { formatMinorUnits } from '~/lib/billing/plan-templates-types';

describe('portal billing display helpers', () => {
  it('shows subscription amounts from minor units', () => {
    expect(formatMinorUnits(4500, 'gbp', 'month')).toBe('£45.00/month');
  });
});
