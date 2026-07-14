import { describe, expect, it } from 'vitest';

import {
  formatMinorUnits,
  planTemplateKindLabel,
} from './plan-templates-types';

describe('plan-templates-types', () => {
  it('formats minor units with interval', () => {
    expect(formatMinorUnits(4500, 'gbp', 'month')).toBe('£45.00/month');
    expect(formatMinorUnits(12000, 'gbp', 'year')).toBe('£120.00/year');
  });

  it('labels kinds in British English product terms', () => {
    expect(planTemplateKindLabel('hosting')).toBe('Hosting');
    expect(planTemplateKindLabel('care_plan')).toBe('Care plan');
  });
});
