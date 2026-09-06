import { beforeAll, describe, expect, it, vi } from 'vitest';

import pathsConfig from '~/config/paths.config';

describe('signup next helpers', () => {
  let resolveSignupNext: typeof import('./signup-next').resolveSignupNext;
  let parseIntentFromNext: typeof import('./signup-next').parseIntentFromNext;
  let isBusinessOnboardingPath: typeof import('./signup-next').isBusinessOnboardingPath;
  let isBusinessSignupIntent: typeof import('./signup-context-business').isBusinessSignupIntent;

  beforeAll(async () => {
    vi.stubEnv('NEXT_PUBLIC_BILLING_PROVIDER', 'stripe');
    const next = await import('./signup-next');
    resolveSignupNext = next.resolveSignupNext;
    parseIntentFromNext = next.parseIntentFromNext;
    isBusinessOnboardingPath = next.isBusinessOnboardingPath;
    const business = await import('./signup-context-business');
    isBusinessSignupIntent = business.isBusinessSignupIntent;
  });

  it('keeps an explicit next path', () => {
    expect(resolveSignupNext('/setup?profile=family', 'business')).toBe(
      '/setup?profile=family',
    );
  });

  it('maps intent=business to /setup/business', () => {
    expect(resolveSignupNext(undefined, 'business')).toBe(
      pathsConfig.app.businessOnboarding,
    );
  });

  it('treats /setup/business as a business workspace intent', () => {
    const intent = parseIntentFromNext(pathsConfig.app.businessOnboarding);

    expect(isBusinessOnboardingPath(pathsConfig.app.businessOnboarding)).toBe(
      true,
    );
    expect(intent?.profile).toBe('work_design');
    expect(isBusinessSignupIntent(intent)).toBe(true);
    expect(intent?.productId).toBeUndefined();
    expect(intent?.planId).toBeUndefined();
  });

  it('still reads plan query params on /setup', () => {
    const intent = parseIntentFromNext(
      '/setup?profile=work_design&product=business-starter',
    );

    expect(intent?.profile).toBe('work_design');
    expect(intent?.productId).toBe('ozer-business-starter');
  });
});
