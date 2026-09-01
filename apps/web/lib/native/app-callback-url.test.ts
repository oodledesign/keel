import { describe, expect, it } from 'vitest';

import {
  NATIVE_APP_CALLBACK_HREF,
  buildNativeAppCallbackHref,
  isNativeAuthCallback,
  nativeAuthBouncePath,
} from './app-callback-url';

describe('buildNativeAppCallbackHref', () => {
  it('hops to the custom scheme with no query or hash', () => {
    expect(buildNativeAppCallbackHref('', '')).toBe(NATIVE_APP_CALLBACK_HREF);
  });

  it('forwards the Supabase query and hash fragment', () => {
    expect(
      buildNativeAppCallbackHref('?code=pkce-code', '#type=magiclink'),
    ).toBe(`${NATIVE_APP_CALLBACK_HREF}?code=pkce-code#type=magiclink`);
  });
});

describe('isNativeAuthCallback', () => {
  it('accepts the HTTPS bounce and the custom scheme', () => {
    expect(isNativeAuthCallback('https://app.ozer.so/auth/native')).toBe(true);
    expect(isNativeAuthCallback('https://app.ozer.so/auth/native/')).toBe(true);
    expect(isNativeAuthCallback('/auth/native')).toBe(true);
    expect(isNativeAuthCallback('so.ozer.app://auth-callback')).toBe(true);
  });

  it('rejects web post-auth paths', () => {
    expect(isNativeAuthCallback('/home')).toBe(false);
    expect(isNativeAuthCallback('https://app.ozer.so/auth/callback')).toBe(
      false,
    );
    expect(isNativeAuthCallback(null)).toBe(false);
  });
});

describe('nativeAuthBouncePath', () => {
  it('keeps token_hash on the bounce so the app can verify', () => {
    expect(nativeAuthBouncePath('hash-1', 'magiclink')).toBe(
      '/auth/native?token_hash=hash-1&type=magiclink',
    );
  });
});
