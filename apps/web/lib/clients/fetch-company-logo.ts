import 'server-only';

import { lookup } from 'node:dns/promises';

import { resolveClientLogoDomain } from './client-logo-domain';
import {
  extractIconCandidatesFromHtml,
  googleFaviconUrl,
  isBlockedLogoHostname,
  isPrivateOrReservedIp,
  wellKnownIconUrls,
} from './client-logo-icons';

const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const HTML_MAX_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 8_000;
const OVERALL_DEADLINE_MS = 20_000;
const MIN_USEFUL_BYTES = 64;
const MAX_REDIRECTS = 3;
const MAX_HTML_ICON_CANDIDATES = 5;
const MAX_IMAGE_ATTEMPTS = 10;

const BROWSER_UA =
  'Mozilla/5.0 (compatible; OzerLogoBot/1.0; +https://ozer.app)';

type LogoResult = {
  domain: string;
  bytes: Buffer;
  contentType: string;
  extension: string;
};

/** Always available — no third-party logo API key required. */
export function isCompanyLogoFetchConfigured() {
  return true;
}

/** @deprecated Use isCompanyLogoFetchConfigured */
export function isLogoDevConfigured() {
  return isCompanyLogoFetchConfigured();
}

function extensionForContentType(contentType: string): string {
  if (contentType.includes('svg')) return 'svg';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('ico') || contentType.includes('x-icon')) {
    return 'ico';
  }
  return 'png';
}

async function assertHostnameSafeToFetch(hostname: string): Promise<boolean> {
  if (isBlockedLogoHostname(hostname)) return false;

  try {
    const results = await lookup(hostname, { all: true, verbatim: true });
    if (results.length === 0) return false;
    return results.every((entry) => !isPrivateOrReservedIp(entry.address));
  } catch {
    return false;
  }
}

async function readBodyWithCap(
  response: Response,
  maxBytes: number,
): Promise<Buffer | null> {
  const contentLength = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return null;
  }

  if (!response.body) {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) return null;
    return Buffer.from(arrayBuffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function fetchFollowingSafeRedirects(
  startUrl: string,
  init: {
    accept: string;
    signal: AbortSignal;
  },
): Promise<{ response: Response; finalUrl: string } | null> {
  let currentUrl = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      return null;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    if (!(await assertHostnameSafeToFetch(parsed.hostname))) {
      return null;
    }

    const response = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Accept: init.accept,
        'User-Agent': BROWSER_UA,
      },
      signal: init.signal,
      cache: 'no-store',
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || hop === MAX_REDIRECTS) return null;
      try {
        currentUrl = new URL(location, currentUrl).toString();
      } catch {
        return null;
      }
      continue;
    }

    return { response, finalUrl: currentUrl };
  }

  return null;
}

async function fetchImageBytes(
  url: string,
  signal: AbortSignal,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  try {
    const followed = await fetchFollowingSafeRedirects(url, {
      accept: 'image/*,*/*;q=0.8',
      signal,
    });
    if (!followed) return null;

    const { response } = followed;
    if (!response.ok) return null;

    const contentType = (
      response.headers.get('content-type') ?? ''
    ).toLowerCase();

    if (
      contentType.includes('text/html') ||
      contentType.includes('application/json') ||
      contentType.includes('text/plain')
    ) {
      return null;
    }

    const bytes = await readBodyWithCap(response, LOGO_MAX_BYTES);
    if (!bytes || bytes.byteLength < MIN_USEFUL_BYTES) return null;

    const head = bytes.subarray(0, 64).toString('utf8').trimStart();
    const looksLikeSvg =
      head.startsWith('<svg') ||
      head.startsWith('<?xml') ||
      head.includes('<svg');
    const looksLikeHtml =
      head.startsWith('<!DOCTYPE') ||
      head.startsWith('<html') ||
      head.startsWith('<HTML');

    if (looksLikeHtml) return null;

    const resolvedType = looksLikeSvg
      ? 'image/svg+xml'
      : contentType.startsWith('image/')
        ? contentType.split(';')[0]!.trim()
        : contentType.includes('icon')
          ? 'image/x-icon'
          : null;

    if (!resolvedType) return null;

    return { bytes, contentType: resolvedType };
  } catch {
    return null;
  }
}

async function fetchHomepageHtml(
  origin: string,
  signal: AbortSignal,
): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const followed = await fetchFollowingSafeRedirects(origin, {
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      signal,
    });
    if (!followed) return null;

    const { response, finalUrl } = followed;
    if (!response.ok) return null;

    const contentType = (
      response.headers.get('content-type') ?? ''
    ).toLowerCase();
    if (
      contentType &&
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml')
    ) {
      return null;
    }

    const bytes = await readBodyWithCap(response, HTML_MAX_BYTES);
    if (!bytes) return null;

    return { html: bytes.toString('utf8'), finalUrl };
  } catch {
    return null;
  }
}

/**
 * Fetch a company icon for a domain (apple-touch / favicon cascade) and
 * return bytes to store in our own storage — no Logo.dev / rehost license.
 *
 * Order:
 * 1. apple-touch-icon / icon links from the homepage HTML
 * 2. Common well-known paths on the origin
 * 3. Google favicon service (sz=128, then 64)
 */
export async function fetchCompanyLogoBytes(input: {
  domain?: string | null;
  website?: string | null;
  email?: string | null;
}): Promise<LogoResult> {
  const domain = resolveClientLogoDomain(input);
  if (!domain) {
    throw new Error(
      'Enter a company domain, or use a work email (not Gmail/Outlook/etc.).',
    );
  }

  if (isBlockedLogoHostname(domain)) {
    throw new Error('That domain cannot be used for logo lookup.');
  }

  if (!(await assertHostnameSafeToFetch(domain))) {
    throw new Error('That domain cannot be used for logo lookup.');
  }

  const overall = AbortSignal.timeout(OVERALL_DEADLINE_MS);
  const origin = `https://${domain}`;
  const candidateUrls: string[] = [];
  const seen = new Set<string>();

  const push = (url: string | null | undefined) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    candidateUrls.push(url);
  };

  const homepage = await fetchHomepageHtml(origin, overall);
  if (homepage) {
    for (const href of extractIconCandidatesFromHtml(
      homepage.html,
      homepage.finalUrl,
    ).slice(0, MAX_HTML_ICON_CANDIDATES)) {
      push(href);
    }
  }

  for (const href of wellKnownIconUrls(origin)) {
    push(href);
  }

  push(googleFaviconUrl(domain, 128));
  push(googleFaviconUrl(domain, 64));

  let attempts = 0;
  for (const url of candidateUrls) {
    if (overall.aborted) break;
    if (attempts >= MAX_IMAGE_ATTEMPTS) break;
    attempts += 1;

    const image = await fetchImageBytes(url, overall);
    if (!image) continue;

    return {
      domain,
      bytes: image.bytes,
      contentType: image.contentType,
      extension: extensionForContentType(image.contentType),
    };
  }

  throw new Error(`No logo found for ${domain}.`);
}
