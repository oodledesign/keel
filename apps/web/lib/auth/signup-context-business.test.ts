import { beforeAll, describe, expect, it, vi } from 'vitest';

describe('buildBusinessSignupContext', () => {
  let buildBusinessSignupContext: typeof import('./signup-context-business').buildBusinessSignupContext;

  beforeAll(async () => {
    vi.stubEnv('NEXT_PUBLIC_BILLING_PROVIDER', 'stripe');
    const mod = await import('./signup-context-business');
    buildBusinessSignupContext = mod.buildBusinessSignupContext;
  });

  it('does not pre-select a paid plan for marketing business intent', () => {
    const context = buildBusinessSignupContext({
      profile: 'work_design',
      interval: 'month',
    });

    expect(context.showPlanConfirm).toBe(false);
    expect(context.badge).toBe('AUTH FIRST · PLAN AT THE END');
    expect(context.intent?.productId).toBeUndefined();
    expect(context.intent?.planId).toBeUndefined();
    expect(context.formSubtitle).toMatch(/company, one client, and a plan/i);
  });

  it('keeps seat confirm copy when a paid plan is already chosen', () => {
    const context = buildBusinessSignupContext({
      profile: 'work_design',
      productId: 'ozer-business-starter',
      planId: 'business-starter-monthly',
      interval: 'month',
      seats: 1,
    });

    expect(context.intent?.productId).toBe('ozer-business-starter');
    expect(context.subheading).toMatch(/Starter/i);
  });
});
