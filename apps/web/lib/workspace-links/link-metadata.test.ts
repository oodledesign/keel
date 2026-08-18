import { describe, expect, it } from 'vitest';

import {
  displayLinkHostname,
  normalizeLinkUrl,
  parseLinkMetadataFromHtml,
} from './link-metadata';

describe('normalizeLinkUrl', () => {
  it('adds https when the protocol is missing', () => {
    expect(normalizeLinkUrl('example.com/path')).toBe(
      'https://example.com/path',
    );
  });

  it('rejects localhost and private hosts', () => {
    expect(normalizeLinkUrl('http://localhost/secret')).toBeNull();
    expect(normalizeLinkUrl('http://127.0.0.1/')).toBeNull();
    expect(normalizeLinkUrl('http://192.168.0.10/')).toBeNull();
  });
});

describe('parseLinkMetadataFromHtml', () => {
  it('prefers Open Graph title, description, image, and favicon', () => {
    const html = `
      <html>
        <head>
          <title>Fallback title</title>
          <meta property="og:title" content="OG Title" />
          <meta property="og:description" content="OG Description" />
          <meta property="og:image" content="/cover.png" />
          <link rel="icon" href="/favicon.ico" />
        </head>
      </html>
    `;

    expect(parseLinkMetadataFromHtml(html, 'https://acme.com/page')).toEqual({
      title: 'OG Title',
      description: 'OG Description',
      ogImageUrl: 'https://acme.com/cover.png',
      faviconUrl: 'https://acme.com/favicon.ico',
    });
  });

  it('skips weak Google Docs titles in favour of the page title', () => {
    const html = `
      <title>Q2 budget</title>
      <meta property="og:title" content="Google Docs" />
    `;

    const parsed = parseLinkMetadataFromHtml(
      html,
      'https://docs.google.com/document/d/abc',
    );
    expect(parsed.title).toBe('Q2 budget');
  });
});

describe('displayLinkHostname', () => {
  it('strips www', () => {
    expect(displayLinkHostname('https://www.example.com/a')).toBe(
      'example.com',
    );
  });
});
