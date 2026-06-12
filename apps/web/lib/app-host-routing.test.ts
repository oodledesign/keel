import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAppSiteOrigin } from './app-host-routing';

describe('getAppSiteOrigin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers NEXT_PUBLIC_APP_SITE_URL when set', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_SITE_URL', 'https://app.keelos.so');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.keelos.so');
    vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL', 'https://www.keelos.so');

    expect(getAppSiteOrigin()).toBe('https://app.keelos.so');
  });

  it('infers app.{apex} in production when marketing is www.{apex}', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.keelos.so');
    vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL', 'https://www.keelos.so');

    expect(getAppSiteOrigin()).toBe('https://app.keelos.so');
  });

  it('infers app.{apex} from www marketing when only SITE_URL is set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.keelos.so');

    expect(getAppSiteOrigin()).toBe('https://app.keelos.so');
  });
});
