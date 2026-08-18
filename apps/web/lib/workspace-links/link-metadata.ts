import {
  extractIconCandidatesFromHtml,
  googleFaviconUrl,
  isBlockedLogoHostname,
  resolveIconUrlAgainstBase,
} from '~/lib/clients/client-logo-icons';

const WEAK_TITLES = new Set([
  'google docs',
  'google sheets',
  'google slides',
  'google drive',
  'untitled',
  'untitled document',
]);

export function normalizeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (isBlockedPublicUrl(parsed)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function isBlockedPublicUrl(parsed: URL): boolean {
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return isBlockedLogoHostname(host);
}

export function displayLinkHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function metaContent(
  html: string,
  attr: 'property' | 'name',
  value: string,
): string {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<meta\\b[^>]*\\b${attr}\\s*=\\s*["']${escaped}["'][^>]*>`,
    'i',
  );
  const tag = html.match(re)?.[0];
  if (!tag) return '';
  const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
  return decodeHtmlEntities(content).trim();
}

function firstMeta(html: string, keys: Array<[string, string]>): string {
  for (const [attr, value] of keys) {
    const content = metaContent(html, attr as 'property' | 'name', value);
    if (content) return content;
  }
  return '';
}

function pageTitle(html: string): string {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return '';
  return decodeHtmlEntities(match[1]).replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : '';
    });
}

function isWeakTitle(title: string): boolean {
  return WEAK_TITLES.has(title.trim().toLowerCase());
}

export type ParsedLinkMetadata = {
  title: string;
  description: string;
  ogImageUrl: string | null;
  faviconUrl: string | null;
};

export function parseLinkMetadataFromHtml(
  html: string,
  pageUrl: string,
): ParsedLinkMetadata {
  const ogTitle = firstMeta(html, [
    ['property', 'og:title'],
    ['name', 'og:title'],
    ['name', 'twitter:title'],
  ]);
  const documentTitle = pageTitle(html);
  const title = !isWeakTitle(ogTitle)
    ? ogTitle
    : !isWeakTitle(documentTitle)
      ? documentTitle
      : ogTitle || documentTitle;

  const description = firstMeta(html, [
    ['property', 'og:description'],
    ['name', 'og:description'],
    ['name', 'twitter:description'],
    ['name', 'description'],
  ]).slice(0, 4000);

  const ogImageRaw = firstMeta(html, [
    ['property', 'og:image'],
    ['name', 'og:image'],
    ['name', 'twitter:image'],
    ['name', 'twitter:image:src'],
  ]);
  const ogImageUrl = ogImageRaw
    ? resolveIconUrlAgainstBase(ogImageRaw, pageUrl)
    : null;

  const iconCandidates = extractIconCandidatesFromHtml(html, pageUrl);
  let faviconUrl = iconCandidates[0] ?? null;

  if (!faviconUrl) {
    try {
      faviconUrl = googleFaviconUrl(new URL(pageUrl).hostname, 64);
    } catch {
      faviconUrl = null;
    }
  }

  return {
    title: title.slice(0, 500),
    description,
    ogImageUrl,
    faviconUrl,
  };
}
