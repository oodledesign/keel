import 'server-only';

import {
  type ParsedLinkMetadata,
  isBlockedPublicUrl,
  parseLinkMetadataFromHtml,
} from './link-metadata';

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 512_000;
const FETCH_UA =
  'Mozilla/5.0 (compatible; OzerLinkPreview/1.0; +https://ozer.so)';

function assertPublicHttpUrl(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https links can be fetched');
  }
  if (isBlockedPublicUrl(parsed)) {
    throw new Error('That URL cannot be fetched');
  }
  return parsed;
}

async function fetchPageHtml(
  url: string,
): Promise<{ html: string; finalUrl: string }> {
  const headers = {
    'User-Agent': FETCH_UA,
    Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.8',
  };

  let response = await fetch(url, {
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  let finalUrl = url;

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) {
      throw new Error('Could not fetch URL (redirect with no location)');
    }
    const redirectUrl = new URL(location, url).href;
    assertPublicHttpUrl(redirectUrl);
    response = await fetch(redirectUrl, {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    finalUrl = redirectUrl;
  }

  if (!response.ok) {
    throw new Error(`Could not fetch URL (HTTP ${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_HTML_BYTES) {
    throw new Error('Page is too large to preview');
  }

  return {
    html: new TextDecoder('utf-8', { fatal: false }).decode(buffer),
    finalUrl,
  };
}

export async function fetchLinkMetadata(
  url: string,
): Promise<ParsedLinkMetadata> {
  assertPublicHttpUrl(url);
  const { html, finalUrl } = await fetchPageHtml(url);
  return parseLinkMetadataFromHtml(html, finalUrl);
}
