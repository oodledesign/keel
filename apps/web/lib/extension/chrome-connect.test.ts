import { describe, expect, it } from 'vitest';

import {
  buildChromeExtensionRedirectURL,
  isAllowedChromeExtensionRedirectUri,
} from './chrome-connect';

describe('isAllowedChromeExtensionRedirectUri', () => {
  it('allows the Chrome identity callback host', () => {
    expect(
      isAllowedChromeExtensionRedirectUri(
        'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/',
      ),
    ).toBe(true);
  });

  it('allows a chrome-extension origin with a valid id', () => {
    expect(
      isAllowedChromeExtensionRedirectUri(
        'chrome-extension://abcdefghijklmnopabcdefghijklmnop/callback',
      ),
    ).toBe(true);
  });

  it('rejects arbitrary https redirects', () => {
    expect(
      isAllowedChromeExtensionRedirectUri('https://evil.example/steal'),
    ).toBe(false);
  });

  it('rejects credentials or hashes on the callback', () => {
    expect(
      isAllowedChromeExtensionRedirectUri(
        'https://user:pass@abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/',
      ),
    ).toBe(false);
  });
});

describe('buildChromeExtensionRedirectURL', () => {
  it('appends the connect code and state', () => {
    const url = buildChromeExtensionRedirectURL({
      redirectUri: 'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/',
      code: 'abc',
      state: 's1',
    });
    expect(url).toContain('code=abc');
    expect(url).toContain('state=s1');
  });

  it('throws on a disallowed redirect', () => {
    expect(() =>
      buildChromeExtensionRedirectURL({
        redirectUri: 'https://example.com/',
        code: 'abc',
        state: 's1',
      }),
    ).toThrow(/Invalid Chrome extension redirect URI/);
  });
});
