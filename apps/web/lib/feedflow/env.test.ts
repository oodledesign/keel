import { afterEach, describe, expect, it, vi } from 'vitest';

import { getOptionalInstagram } from './env';

describe('getOptionalInstagram', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers FEEDFLOW_INSTAGRAM_* names', () => {
    vi.stubEnv('FEEDFLOW_INSTAGRAM_APP_ID', 'ff-app');
    vi.stubEnv('FEEDFLOW_INSTAGRAM_APP_SECRET', 'ff-secret');
    vi.stubEnv(
      'FEEDFLOW_INSTAGRAM_REDIRECT_URI',
      'https://app.ozer.so/api/feedflow/auth/instagram/callback',
    );
    vi.stubEnv('INSTAGRAM_APP_ID', 'legacy-app');
    vi.stubEnv('INSTAGRAM_APP_SECRET', 'legacy-secret');
    vi.stubEnv('INSTAGRAM_REDIRECT_URI', 'https://example.com/legacy/callback');

    expect(getOptionalInstagram()).toEqual({
      appId: 'ff-app',
      appSecret: 'ff-secret',
      redirectUri: 'https://app.ozer.so/api/feedflow/auth/instagram/callback',
    });
  });

  it('falls back to INSTAGRAM_* when Feedflow names are absent', () => {
    vi.stubEnv('INSTAGRAM_APP_ID', 'legacy-app');
    vi.stubEnv('INSTAGRAM_APP_SECRET', 'legacy-secret');
    vi.stubEnv(
      'INSTAGRAM_REDIRECT_URI',
      'https://app.ozer.so/api/feedflow/auth/instagram/callback',
    );

    expect(getOptionalInstagram()).toEqual({
      appId: 'legacy-app',
      appSecret: 'legacy-secret',
      redirectUri: 'https://app.ozer.so/api/feedflow/auth/instagram/callback',
    });
  });

  it('never uses Auto-Reply META_INSTAGRAM_* credentials', () => {
    vi.stubEnv('FEEDFLOW_INSTAGRAM_APP_ID', '');
    vi.stubEnv('FEEDFLOW_INSTAGRAM_APP_SECRET', '');
    vi.stubEnv('FEEDFLOW_INSTAGRAM_REDIRECT_URI', '');
    vi.stubEnv('INSTAGRAM_APP_ID', '');
    vi.stubEnv('INSTAGRAM_APP_SECRET', '');
    vi.stubEnv('INSTAGRAM_REDIRECT_URI', '');
    vi.stubEnv('META_INSTAGRAM_APP_ID', 'meta-app');
    vi.stubEnv('META_INSTAGRAM_APP_SECRET', 'meta-secret');
    vi.stubEnv(
      'META_REDIRECT_URI',
      'https://app.ozer.so/api/instagram-autoreply/auth/instagram/callback',
    );
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.ozer.so');

    expect(getOptionalInstagram()).toBeNull();
  });

  it('defaults the redirect URI from the site URL when id and secret exist', () => {
    vi.stubEnv('FEEDFLOW_INSTAGRAM_APP_ID', 'ff-app');
    vi.stubEnv('FEEDFLOW_INSTAGRAM_APP_SECRET', 'ff-secret');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.ozer.so/');

    expect(getOptionalInstagram()?.redirectUri).toBe(
      'https://app.ozer.so/api/feedflow/auth/instagram/callback',
    );
  });
});
