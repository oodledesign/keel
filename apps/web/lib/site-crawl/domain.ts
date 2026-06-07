import 'server-only';

import { crawlFetch } from '~/lib/crawl/http-fetch';

export function normaliseHost(domain: string): string {
  return domain
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    ?.toLowerCase() ?? domain.toLowerCase();
}

export function projectDomainToStartUrl(domain: string): string {
  const host = normaliseHost(domain);
  return `https://${host}/`;
}

export function normaliseCrawlUrl(raw: string, host: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  if (/^(mailto:|tel:|javascript:|data:)/i.test(trimmed)) return null;

  try {
    const base = `https://${normaliseHost(host)}`;
    const parsed = new URL(trimmed, base);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    const normalisedHost = normaliseHost(host);
    if (parsed.hostname !== normalisedHost) return null;

    if (parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function isInternalUrl(url: string, host: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().replace(/^www\./, '') === normaliseHost(host);
  } catch {
    return false;
  }
}

export async function loadSitemapUrls(domain: string, limit: number): Promise<string[]> {
  const host = normaliseHost(domain);

  try {
    const { response } = await crawlFetch(`https://${host}/sitemap.xml`, {
      timeoutMs: 10_000,
    });
    if (!response.ok) return [];

    const xml = await response.text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((match) => normaliseCrawlUrl(match[1]!, host))
      .filter((url): url is string => Boolean(url));

    return [...new Set(urls)].slice(0, limit);
  } catch {
    return [];
  }
}

export function buildInitialQueue(domain: string, sitemapUrls: string[]): string[] {
  const startUrl = projectDomainToStartUrl(domain);
  const queue = [startUrl, ...sitemapUrls];
  return [...new Set(queue)];
}
