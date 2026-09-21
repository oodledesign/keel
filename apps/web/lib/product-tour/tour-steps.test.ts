import { describe, expect, it } from 'vitest';

import { getProductTourStepDefs } from './tour-steps';

describe('getProductTourStepDefs', () => {
  it('covers portal nav without workspace chrome', () => {
    const steps = getProductTourStepDefs('client_portal');
    const elements = steps.map((step) => step.element).filter(Boolean);

    expect(steps[0]?.title).toBe('Welcome to your portal');
    expect(elements).toEqual([
      '[data-tour="portal-nav-overview"]',
      '[data-tour="portal-nav-website"]',
      '[data-tour="portal-nav-projects"]',
      '[data-tour="portal-nav-meetings"]',
      '[data-tour="portal-nav-tasks"]',
      '[data-tour="portal-nav-messages"]',
      '[data-tour="portal-nav-services"]',
    ]);
    expect(
      steps.some((step) => step.element === '[data-tour="workspace-switcher"]'),
    ).toBe(false);
  });
});
