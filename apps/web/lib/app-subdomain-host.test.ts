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
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.keelos.so');
    vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL', 'https://www.keelos.so');

    expect(
      resolveAppSubdomainRedirect(
        new URL('https://www.keelos.so/auth/sign-in?next=%2Fapp'),
      ),
    ).toBe('https://app.keelos.so/auth/sign-in?next=%2Fapp');

    expect(
      resolveAppSubdomainRedirect(new URL('https://keelos.so/app/work/potters')),
    ).toBe('https://app.keelos.so/app/work/potters');
  });

  it('redirects app host root to dashboard and marketing pages to www', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.keelos.so');
    vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL', 'https://www.keelos.so');

    expect(resolveAppSubdomainRedirect(new URL('https://app.keelos.so/'))).toBe(
      'https://app.keelos.so/app',
    );

    expect(
      resolveAppSubdomainRedirect(new URL('https://app.keelos.so/pricing')),
    ).toBe('https://www.keelos.so/pricing');
  });

  it('locks app host even when env vars only list www marketing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.keelos.so');

    expect(isAppSubdomainHostname('app.keelos.so')).toBe(true);
    expect(resolveAppSubdomainRedirect(new URL('https://app.keelos.so/'))).toBe(
      'https://app.keelos.so/app',
    );
    expect(
      resolveAppSubdomainRedirect(new URL('https://app.keelos.so/personal')),
    ).toBe('https://www.keelos.so/personal');
  });

  it('does nothing when hosts are the same (local dev)', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
    vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL', 'http://localhost:3000');

    expect(
      resolveAppSubdomainRedirect(new URL('http://localhost:3000/auth/sign-in')),
    ).toBeNull();
  });

  it('does not treat app subdomain as an agency portal slug', async () => {
    const { extractAgencyPortalSlug } = await import('./agency-portal-host');
    expect(extractAgencyPortalSlug('app.keelos.so')).toBeNull();
  });
});
