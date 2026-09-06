import { beforeAll, describe, expect, it, vi } from 'vitest';

import pathsConfig from '~/config/paths.config';

describe('marketing signup URLs', () => {
  let MARKETING_FREE_SIGNUP_URL: string;
  let buildBusinessOnboardingSignupUrl: () => string;

  beforeAll(async () => {
    vi.stubEnv('NEXT_PUBLIC_BILLING_PROVIDER', 'stripe');
    const mod = await import('./pricing-marketing');
    MARKETING_FREE_SIGNUP_URL = mod.MARKETING_FREE_SIGNUP_URL;
    buildBusinessOnboardingSignupUrl = mod.buildBusinessOnboardingSignupUrl;
  });

  it('sends Start free / Sign Up straight to auth with business onboarding next', () => {
    const url = new URL(MARKETING_FREE_SIGNUP_URL, 'http://ozer.local');

    expect(url.pathname).toBe(pathsConfig.auth.signUp);
    expect(url.searchParams.get('intent')).toBe('business');
    expect(url.searchParams.get('next')).toBe(
      pathsConfig.app.businessOnboarding,
    );
    expect(MARKETING_FREE_SIGNUP_URL).toBe(buildBusinessOnboardingSignupUrl());
  });
});
