import { describe, expect, it } from 'vitest';

import {
  extractIconCandidatesFromHtml,
  googleFaviconUrl,
  isBlockedLogoHostname,
  isPrivateOrReservedIp,
  wellKnownIconUrls,
} from './client-logo-icons';

describe('extractIconCandidatesFromHtml', () => {
  it('prefers apple-touch-icon over tiny favicons', () => {
    const html = `
      <link rel="icon" href="/favicon.ico" sizes="16x16" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    `;

    const urls = extractIconCandidatesFromHtml(html, 'https://acme.com/');
    expect(urls[0]).toBe('https://acme.com/apple-touch-icon.png');
    expect(urls).toContain('https://acme.com/favicon-32.png');
    expect(urls).toContain('https://acme.com/favicon.ico');
  });

  it('resolves absolute and protocol-relative hrefs', () => {
    const html = `
      <link rel="apple-touch-icon" href="//cdn.example.com/icon.png" />
      <link rel="icon" href="https://static.example.com/fav.png" sizes="96x96" />
    `;

    const urls = extractIconCandidatesFromHtml(html, 'https://acme.com/');
    expect(urls[0]).toBe('https://cdn.example.com/icon.png');
    expect(urls).toContain('https://static.example.com/fav.png');
  });

  it('skips non-http schemes', () => {
    const html = `<link rel="icon" href="data:image/png;base64,abc" />`;
    expect(extractIconCandidatesFromHtml(html, 'https://acme.com/')).toEqual(
      [],
    );
  });
});

describe('wellKnownIconUrls / googleFaviconUrl', () => {
  it('lists common paths', () => {
    expect(wellKnownIconUrls('https://acme.com')[0]).toBe(
      'https://acme.com/apple-touch-icon.png',
    );
  });

  it('builds google favicon urls', () => {
    expect(googleFaviconUrl('acme.com', 128)).toContain('domain=acme.com');
    expect(googleFaviconUrl('acme.com', 128)).toContain('sz=128');
  });
});

describe('isBlockedLogoHostname', () => {
  it('blocks localhost and IPs', () => {
    expect(isBlockedLogoHostname('localhost')).toBe(true);
    expect(isBlockedLogoHostname('127.0.0.1')).toBe(true);
    expect(isBlockedLogoHostname('acme.com')).toBe(false);
  });
});

describe('isPrivateOrReservedIp', () => {
  it('detects private ranges', () => {
    expect(isPrivateOrReservedIp('10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIp('::1')).toBe(true);
  });
});
