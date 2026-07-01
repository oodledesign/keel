import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isAppSubdomainHostname,
  resolveAppSubdomainRedirect,
} from './app-subdomain-host';

describe('resolveAppSubdomainRedirect', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('redirects app routes from marketing host to app host', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.ozer.so');
    vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL', 'https://www.ozer.so');

    expect(
      resolveAppSubdomainRedirect(
        new URL('https://www.ozer.so/auth/sign-in?next=%2Fapp'),
      ),
    ).toBe('https://app.ozer.so/auth/sign-in?next=%2Fapp');

    expect(
      resolveAppSubdomainRedirect(new URL('https://ozer.so/app/potters')),
    ).toBe('https://app.ozer.so/app/potters');
  });

  it('redirects app host root to dashboard and marketing pages to www', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.ozer.so');
    vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL', 'https://www.ozer.so');

    expect(resolveAppSubdomainRedirect(new URL('https://app.ozer.so/'))).toBe(
      'https://app.ozer.so/app',
    );

    expect(
      resolveAppSubdomainRedirect(new URL('https://app.ozer.so/pricing')),
    ).toBe('https://www.ozer.so/pricing');
  });

  it('serves brand assets on the app host without redirecting to /app', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.ozer.so');
    vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL', 'https://www.ozer.so');

    expect(
      resolveAppSubdomainRedirect(
        new URL('https://app.ozer.so/brand/keel-white-transparent.png'),
      ),
    ).toBeNull();
  });

  it('locks app host even when env vars only list www marketing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.ozer.so');

    expect(isAppSubdomainHostname('app.ozer.so')).toBe(true);
    expect(resolveAppSubdomainRedirect(new URL('https://app.ozer.so/'))).toBe(
      'https://app.ozer.so/app',
    );
    expect(
      resolveAppSubdomainRedirect(new URL('https://app.ozer.so/personal')),
    ).toBe('https://www.ozer.so/personal');
  });

  it('does nothing when hosts are the same (local dev)', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
    vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL', 'http://localhost:3000');

    expect(
      resolveAppSubdomainRedirect(new URL('http://localhost:3000/auth/sign-in')),
    ).toBeNull();

    expect(resolveAppSubdomainRedirect(new URL('http://localhost:3000/'))).toBeNull();
    expect(
      resolveAppSubdomainRedirect(new URL('http://localhost:3000/pricing')),
    ).toBeNull();
  });

  it('does not treat app subdomain as an agency portal slug', async () => {
    const { extractAgencyPortalSlug } = await import('./agency-portal-host');
    expect(extractAgencyPortalSlug('app.ozer.so')).toBeNull();
  });
});
