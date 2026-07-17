import 'server-only';

import { load } from 'cheerio';

import { fetchPageHtmlWithFirecrawl } from '~/lib/firecrawl/scrape-page';

const MAX_CHARS = 12_000;

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** Block loopback / RFC1918 / link-local targets (SSRF guard). */
function isPrivateOrLocalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return true;
    }

    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '[::1]' ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return true;
    }

    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split('.').map(Number);
      if (a === 10 || a === 127 || a === 0) return true;
      if (a === 169 && b === 254) return true;
      if (a === 192 && b === 168) return true;
      if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
    }

    return false;
  } catch {
    return true;
  }
}

function htmlToMainText(html: string): { title: string; text: string } {
  const $ = load(html);
  const title = $('title').first().text().trim();

  $(
    'script, style, noscript, iframe, svg, nav, footer, header, .cookie-banner, #cookie-consent',
  ).remove();

  const metaDesc = $('meta[name="description"]').attr('content')?.trim() ?? '';
  const headings = $('h1, h2')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 24)
    .join('\n');

  const body = $('main, article, [role="main"], body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  const text = [metaDesc, headings, body].filter(Boolean).join('\n\n');
  return { title, text: text.slice(0, MAX_CHARS) };
}

async function fetchHtmlFallback(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'OzerSiteStudio/1.0 (+https://ozer.so)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Fetch a URL and extract main text for brief AI context.
 * Prefers Firecrawl (existing Rankly/competitor path), falls back to fetch + cheerio.
 */
export async function fetchUrlContentForBrief(url: string): Promise<{
  text: string;
  title: string;
  method: 'firecrawl' | 'fetch' | 'empty';
  normalizedUrl: string;
}> {
  const normalizedUrl = normalizeUrl(url.trim());

  if (isPrivateOrLocalUrl(normalizedUrl)) {
    return { text: '', title: '', method: 'empty', normalizedUrl };
  }

  const firecrawlHtml = await fetchPageHtmlWithFirecrawl(normalizedUrl);
  if (firecrawlHtml) {
    const parsed = htmlToMainText(firecrawlHtml);
    return {
      ...parsed,
      method: parsed.text ? 'firecrawl' : 'empty',
      normalizedUrl,
    };
  }

  const html = await fetchHtmlFallback(normalizedUrl);
  if (!html) {
    return { text: '', title: '', method: 'empty', normalizedUrl };
  }

  const parsed = htmlToMainText(html);
  return {
    ...parsed,
    method: parsed.text ? 'fetch' : 'empty',
    normalizedUrl,
  };
}
