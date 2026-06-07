import 'server-only';

import { load } from 'cheerio';

import type {
  CrawlResult,
  JsonLdBlock,
  LlmsTxtResult,
  PageCrawl,
  RobotsResult,
  SitemapResult,
} from './types';

const CRAWL_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Rankly/1.0; +https://rankly.app)',
  Accept: 'text/html,application/xml,text/plain,*/*',
};

const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'Google-Extended',
  'Bytespider',
  'CCBot',
];

export function normaliseDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    ?.toLowerCase() ?? domain;
}

function extractBotSection(
  text: string,
  bot: string,
): { disallowsAll: boolean } | null {
  const sections = text.split(/(?=User-agent:\s*)/i);
  const section = sections.find((part) =>
    new RegExp(`User-agent:\\s*${bot}\\b`, 'i').test(part),
  );
  if (!section) return null;

  const disallows = [...section.matchAll(/Disallow:\s*(.+)/gi)].map((m) =>
    m[1]?.trim(),
  );
  const disallowsAll = disallows.some(
    (path) => path === '/' || path === '/*',
  );

  return { disallowsAll };
}

export async function crawlRobots(domain: string): Promise<RobotsResult> {
  const host = normaliseDomain(domain);

  try {
    const res = await fetch(`https://${host}/robots.txt`, {
      headers: CRAWL_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    const blocked: string[] = [];
    const allowed: string[] = [];

    for (const bot of AI_BOTS) {
      const botSection = extractBotSection(text, bot);
      if (botSection?.disallowsAll) blocked.push(bot);
      else allowed.push(bot);
    }

    const wildcardBlocked =
      /User-agent:\s*\*[\s\S]*?Disallow:\s*\/(?:\s|$)/im.test(text);

    return { present: true, raw: text, blocked, allowed, wildcardBlocked };
  } catch {
    return {
      present: false,
      raw: '',
      blocked: [],
      allowed: [],
      wildcardBlocked: false,
    };
  }
}

export async function crawlLlmsTxt(domain: string): Promise<LlmsTxtResult> {
  const host = normaliseDomain(domain);

  try {
    const res = await fetch(`https://${host}/llms.txt`, {
      headers: CRAWL_HEADERS,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { present: false };
    const text = await res.text();
    return {
      present: true,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      raw: text.slice(0, 8000),
    };
  } catch {
    return { present: false };
  }
}

export async function crawlSitemap(domain: string): Promise<SitemapResult> {
  const host = normaliseDomain(domain);

  try {
    const res = await fetch(`https://${host}/sitemap.xml`, {
      headers: CRAWL_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { present: false, urlCount: 0 };
    const text = await res.text();
    const urlCount = (text.match(/<loc>/g) ?? []).length;
    const lastmod = text.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? null;
    return { present: true, urlCount, lastmod };
  } catch {
    return { present: false, urlCount: 0 };
  }
}

export function extractAllJsonLd($: ReturnType<typeof load>): JsonLdBlock[] {
  const blocks: JsonLdBlock[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() ?? '') as Record<string, unknown>;
      const items = (parsed['@graph'] as Record<string, unknown>[] | undefined) ?? [
        parsed,
      ];

      for (const item of items) {
        const typeValue = item['@type'];
        const types = Array.isArray(typeValue)
          ? typeValue.map(String)
          : [String(typeValue ?? 'Unknown')];

        for (const type of types) {
          blocks.push({
            type,
            raw: item,
            hasKnowsAbout: Boolean(item.knowsAbout),
            hasSameAs: Boolean(item.sameAs),
            hasAuthor: Boolean(item.author),
            hasReviewer: Boolean(item.reviewer),
            hasContactPoint: Boolean(item.contactPoint),
          });
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  return blocks;
}

export function detectFaqPattern($: ReturnType<typeof load>): boolean {
  const hasFaqSchema = $('script[type="application/ld+json"]')
    .text()
    .includes('FAQPage');
  const faqHeadings = $('h2, h3').filter((_, el) => {
    const text = $(el).text();
    return (
      text.includes('?') ||
      /^(what|how|why|when|can|is|are|do|does)\b/i.test(text.trim())
    );
  }).length;

  return hasFaqSchema || faqHeadings >= 3;
}

function detectLastUpdated($: ReturnType<typeof load>): boolean {
  const text = $('body').text();
  return /last updated|updated on|published|modified/i.test(text.slice(0, 8000));
}

function detectContactInfo($: ReturnType<typeof load>): boolean {
  const text = $('body').text().toLowerCase();
  const hasTel = $('a[href^="tel:"]').length > 0;
  const hasMail = $('a[href^="mailto:"]').length > 0;
  return hasTel || hasMail || text.includes('contact us');
}

export function scoreUrlImportance(url: string, domain: string): number {
  const host = normaliseDomain(domain);
  const path = url
    .replace(`https://${host}`, '')
    .replace(`https://www.${host}`, '')
    .toLowerCase();

  let score = 0;
  if (path === '/' || path === '') score += 100;
  if (/\/(about|who-we-are|about-us)/.test(path)) score += 80;
  if (/\/(services?|solutions?|what-we-do|offerings?)/.test(path)) score += 70;
  if (/\/(contact|get-in-touch)/.test(path)) score += 50;
  if (/\/(blog|insights?|resources?|articles?)/.test(path)) score += 40;

  const depth = (path.match(/\//g) ?? []).length;
  score -= depth * 5;
  if (/\/(tag|category|author|page\/\d)/.test(path)) score -= 30;

  return score;
}

async function selectPagesToCrawl(
  domain: string,
  sitemap: SitemapResult,
): Promise<string[]> {
  const host = normaliseDomain(domain);
  const homepage = `https://${host}`;

  if (!sitemap.present || sitemap.urlCount === 0) {
    return [homepage];
  }

  try {
    const res = await fetch(`https://${host}/sitemap.xml`, {
      headers: CRAWL_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    const xml = await res.text();
    const allUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);

    const scored = allUrls
      .map((url) => ({ url, score: scoreUrlImportance(url, host) }))
      .sort((a, b) => b.score - a.score);

    const selected = [homepage];
    for (const item of scored) {
      if (selected.length >= 10) break;
      if (!selected.includes(item.url)) selected.push(item.url);
    }

    return selected.slice(0, 10);
  } catch {
    return [homepage];
  }
}

export async function crawlPage(url: string, domain: string): Promise<PageCrawl> {
  const res = await fetch(url, {
    headers: CRAWL_HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  const html = await res.text();
  const $ = load(html);

  $('nav, footer, header, script, style, .cookie-banner, #cookie-consent').remove();

  const rawBodyText = $('body').text().trim();
  const isJsRendered = rawBodyText.length < 200 && $('script').length > 3;
  const host = normaliseDomain(domain);

  const internalLinkCount = $(`a[href^="/"], a[href*="${host}"]`).length;
  const externalLinkCount = $('a[href^="http"]')
    .filter((_, el) => {
      const href = $(el).attr('href') ?? '';
      return !href.includes(host);
    })
    .length;

  return {
    url,
    statusCode: res.status,
    title: $('title').text().trim(),
    metaDesc: $('meta[name="description"]').attr('content') ?? '',
    canonical: $('link[rel="canonical"]').attr('href') ?? '',
    ogTitle: $('meta[property="og:title"]').attr('content') ?? '',
    ogDesc: $('meta[property="og:description"]').attr('content') ?? '',
    ogImage: $('meta[property="og:image"]').attr('content') ?? '',
    twitterCard: $('meta[name="twitter:card"]').attr('content') ?? '',
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
      .slice(0, 15),
    jsonLd: extractAllJsonLd($),
    bylinePresent:
      $('[rel="author"], [itemprop="author"], .author, .byline, [class*="author"]')
        .length > 0,
    tableCount: $('table').length,
    faqPatternPresent: detectFaqPattern($),
    wordCount: rawBodyText.split(/\s+/).filter(Boolean).length,
    isJsRendered,
    lastUpdatedVisible: detectLastUpdated($),
    hasTldr: /tl;dr|tldr|key takeaway|summary/i.test(rawBodyText.slice(0, 5000)),
    contactInfoPresent: detectContactInfo($),
    internalLinkCount,
    externalLinkCount,
  };
}

export async function crawlPages(
  domain: string,
  sitemap: SitemapResult,
): Promise<PageCrawl[]> {
  const urls = await selectPagesToCrawl(domain, sitemap);
  const pages: PageCrawl[] = [];

  for (const url of urls) {
    try {
      pages.push(await crawlPage(url, domain));
    } catch {
      pages.push({
        url,
        statusCode: 0,
        title: 'Crawl failed',
        metaDesc: '',
        canonical: '',
        ogTitle: '',
        ogDesc: '',
        ogImage: '',
        twitterCard: '',
        h1s: [],
        h2s: [],
        h3s: [],
        jsonLd: [],
        bylinePresent: false,
        tableCount: 0,
        faqPatternPresent: false,
        wordCount: 0,
        isJsRendered: false,
        lastUpdatedVisible: false,
        hasTldr: false,
        contactInfoPresent: false,
        internalLinkCount: 0,
        externalLinkCount: 0,
        crawlFailed: true,
      });
    }
  }

  return pages;
}

export async function crawlSite(domain: string): Promise<CrawlResult> {
  const [robotsTxt, llmsTxt, sitemap] = await Promise.all([
    crawlRobots(domain),
    crawlLlmsTxt(domain),
    crawlSitemap(domain),
  ]);

  const pages = await crawlPages(domain, sitemap);

  return { robotsTxt, llmsTxt, sitemap, pages };
}
