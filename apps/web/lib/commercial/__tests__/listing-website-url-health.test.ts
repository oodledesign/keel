import { describe, expect, it } from 'vitest';

import {
  isSafePublicProbeUrl,
  isWebsitePublicPageBroken,
  probePublicListingPageUrl,
} from '../listing-website-url-health';

const PUBLIC_URL =
  'https://www.bracketts.co.uk/property/20-21-chapman-way-tunbridge-wells/';

function jsonResponse(status: number, headers?: HeadersInit) {
  return new Response(null, { status, headers });
}

describe('isSafePublicProbeUrl', () => {
  it('allows public listing pages', () => {
    expect(isSafePublicProbeUrl(PUBLIC_URL)).toBe(true);
  });

  it('rejects localhost and feed URLs', () => {
    expect(isSafePublicProbeUrl('http://localhost/property/1')).toBe(false);
    expect(
      isSafePublicProbeUrl(
        'https://app.ozer.so/api/commercial/property-hive-feed?token=x',
      ),
    ).toBe(false);
  });
});

describe('probePublicListingPageUrl', () => {
  const resolveHost = async () => ['203.0.113.10'];

  it('treats 200 as healthy', async () => {
    const result = await probePublicListingPageUrl(PUBLIC_URL, {
      resolveHost,
      fetch: async () => jsonResponse(200),
    });
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('ok');
  });

  it('treats 404 as a broken public page', async () => {
    const result = await probePublicListingPageUrl(PUBLIC_URL, {
      resolveHost,
      fetch: async () => jsonResponse(404),
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(isWebsitePublicPageBroken(result)).toBe(true);
  });

  it('does not follow a redirect onto a private host', async () => {
    const result = await probePublicListingPageUrl(PUBLIC_URL, {
      resolveHost,
      fetch: async () =>
        jsonResponse(302, { location: 'http://127.0.0.1/admin' }),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unsafe_redirect');
    expect(isWebsitePublicPageBroken(result)).toBe(false);
  });

  it('retries GET when HEAD is not allowed', async () => {
    const methods: string[] = [];
    const result = await probePublicListingPageUrl(PUBLIC_URL, {
      resolveHost,
      fetch: async (_url, init) => {
        methods.push(String(init?.method));
        if (init?.method === 'HEAD') return jsonResponse(405);
        return jsonResponse(200);
      },
    });
    expect(methods).toEqual(['HEAD', 'GET']);
    expect(result.ok).toBe(true);
  });

  it('skips timeouts instead of marking the page broken', async () => {
    const result = await probePublicListingPageUrl(PUBLIC_URL, {
      resolveHost,
      fetch: async () => {
        const error = new Error('aborted');
        error.name = 'TimeoutError';
        throw error;
      },
    });
    expect(result.reason).toBe('timeout');
    expect(isWebsitePublicPageBroken(result)).toBe(false);
  });
});
