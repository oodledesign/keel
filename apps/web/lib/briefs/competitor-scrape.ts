import 'server-only';

import { load } from 'cheerio';

import type { CompetitorPage } from './types';

function extractJsonLdTypes($: ReturnType<typeof load>): string[] {
  const types: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() ?? '') as Record<string, unknown>;
      const t = parsed['@type'];
      if (typeof t === 'string') types.push(t);
      if (Array.isArray(t)) types.push(...t.filter((v) => typeof v === 'string'));
    } catch {
      // ignore malformed JSON-LD
    }
  });
  return [...new Set(types)];
}

function estimateWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function scrapeCompetitorPage(url: string): Promise<CompetitorPage> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; Rankly/1.0; +https://rankly.app)',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = load(html);

  $('nav, footer, header, script, style, .cookie-banner, #cookie-consent').remove();

  return {
    url,
    title: $('title').text().trim(),
    metaDesc: $('meta[name="description"]').attr('content') ?? '',
    ogImage: $('meta[property="og:image"]').attr('content') ?? '',
    twitterCard: $('meta[name="twitter:card"]').attr('content') ?? '',
    jsonLdTypes: extractJsonLdTypes($),
    bylinePresent:
      $('[rel="author"], [itemprop="author"], .author, .byline').length > 0,
    h1s: $('h1')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean),
    h2s: $('h2')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean),
    h3s: $('h3')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .slice(0, 12),
    wordCount: estimateWordCount($('body').text()),
    tableCount: $('table').length,
    codeBlockCount: $('pre, code').length,
    imageCount: $('img').length,
  };
}

export async function scrapeTopCompetitors(
  urls: string[],
): Promise<CompetitorPage[]> {
  const results = await Promise.allSettled(
    urls.slice(0, 3).map(scrapeCompetitorPage),
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      url: urls[index] ?? '',
      title: 'Scrape failed',
      metaDesc: '',
      ogImage: '',
      twitterCard: '',
      jsonLdTypes: [],
      bylinePresent: false,
      h1s: [],
      h2s: [],
      h3s: [],
      wordCount: 0,
      tableCount: 0,
      codeBlockCount: 0,
      imageCount: 0,
      scrapeFailed: true,
    };
  });
}
