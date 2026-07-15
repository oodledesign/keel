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
        new URL('https://app.ozer.so/brand/ozer-wordmark-dark.png'),
      ),
    ).toBeNull();
  });

  it('serves OAuth discovery and consent paths on the app host', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.ozer.so');
    vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL', 'https://www.ozer.so');

    expect(
      resolveAppSubdomainRedirect(
        new URL('https://app.ozer.so/.well-known/oauth-protected-resource'),
      ),
    ).toBeNull();

    expect(
      resolveAppSubdomainRedirect(
        new URL('https://app.ozer.so/oauth/consent?authorization_id=test'),
      ),
    ).toBeNull();
  });

  it('serves public connect flows on the app host without redirecting to /app', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.ozer.so');
    vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL', 'https://www.ozer.so');

    expect(
      resolveAppSubdomainRedirect(
        new URL(
          'https://app.ozer.so/connect/signatures/75d71cf6fa47ff6e38f3bc444a621ffed7f1770f2b0995c9630da228093dc0fa',
        ),
      ),
    ).toBeNull();

    expect(
      resolveAppSubdomainRedirect(
        new URL('https://app.ozer.so/connect/signatures/success?provider=microsoft'),
      ),
    ).toBeNull();
  });

  it('serves public signature preview links on the app host without redirecting to /app', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.ozer.so');
    vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL', 'https://www.ozer.so');

    expect(
      resolveAppSubdomainRedirect(
        new URL(
          'https://app.ozer.so/preview/signatures/fc1b904adf6515e791949d181e36e1e1f3a8f239afa6ee6a3336b3e4cffe8881',
        ),
      ),
    ).toBeNull();

    expect(
      resolveAppSubdomainRedirect(
        new URL(
          'https://www.ozer.so/preview/signatures/fc1b904adf6515e791949d181e36e1e1f3a8f239afa6ee6a3336b3e4cffe8881',
        ),
      ),
    ).toBe(
      'https://app.ozer.so/preview/signatures/fc1b904adf6515e791949d181e36e1e1f3a8f239afa6ee6a3336b3e4cffe8881',
    );
  });

  it('serves public booking flows on the app host without redirecting to /app', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.ozer.so');
    vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL', 'https://www.ozer.so');

    expect(
      resolveAppSubdomainRedirect(new URL('https://app.ozer.so/book/acme')),
    ).toBeNull();
    expect(
      resolveAppSubdomainRedirect(
        new URL('https://app.ozer.so/book/acme/intro-call'),
      ),
    ).toBeNull();
    expect(
      resolveAppSubdomainRedirect(
        new URL(
          'https://app.ozer.so/book/manage/11111111-1111-1111-1111-111111111111',
        ),
      ),
    ).toBeNull();
  });

  it('serves API routes on the app host without redirecting to /app', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.ozer.so');
    vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL', 'https://www.ozer.so');

    expect(
      resolveAppSubdomainRedirect(
        new URL(
          'https://app.ozer.so/api/signatures/ms-delegated-auth?token=abc',
        ),
      ),
    ).toBeNull();

    expect(
      resolveAppSubdomainRedirect(
        new URL('https://app.ozer.so/api/signatures/ms-callback?admin_consent=True'),
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
