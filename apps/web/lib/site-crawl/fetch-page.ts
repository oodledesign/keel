import 'server-only';

import { load } from 'cheerio';

import { crawlFetch } from '~/lib/crawl/http-fetch';

import { normaliseCrawlUrl, normaliseHost } from './domain';
import type { CrawledPageResult, SiteCrawlIssue } from './types';
import { detectPageIssues } from './issues';

function parseRobotsNoindex($: ReturnType<typeof load>): boolean {
  const robots = $('meta[name="robots"]').attr('content')?.toLowerCase() ?? '';
  return robots.includes('noindex');
}

export async function fetchAndParsePage(
  url: string,
  domain: string,
): Promise<CrawledPageResult> {
  const host = normaliseHost(domain);

  try {
    const { response, profile, botBlockedInitially } = await crawlFetch(url, {
      timeoutMs: 12_000,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const finalUrl = response.url || url;

    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      const issues = detectPageIssues({
        statusCode: response.status,
        title: '',
        metaDescription: '',
        h1Count: 0,
        canonical: '',
        indexable: true,
        crawlFailed: false,
      });

      return {
        url,
        finalUrl,
        statusCode: response.status,
        title: '',
        metaDescription: '',
        h1: '',
        h1Count: 0,
        canonical: '',
        wordCount: 0,
        indexable: true,
        internalLinksOut: 0,
        externalLinksOut: 0,
        internalLinks: [],
        issues,
        crawlError: null,
        fetchProfile: profile,
        botBlockedInitially,
      };
    }

    const html = await response.text();
    const $ = load(html);

    const title = $('title').first().text().trim();
    const metaDescription = $('meta[name="description"]').attr('content')?.trim() ?? '';
    const canonical = $('link[rel="canonical"]').attr('href')?.trim() ?? '';
    const h1s = $('h1')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);
    const indexable = !parseRobotsNoindex($);

    const internalLinks = new Set<string>();
    let externalLinksOut = 0;

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const absolute = normaliseCrawlUrl(href, host);
      if (absolute) {
        internalLinks.add(absolute);
      } else if (/^https?:\/\//i.test(href)) {
        externalLinksOut += 1;
      }
    });

    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = bodyText ? bodyText.split(' ').filter(Boolean).length : 0;

    const issues = detectPageIssues({
      statusCode: response.status,
      title,
      metaDescription,
      h1Count: h1s.length,
      canonical,
      indexable,
      crawlFailed: false,
    });

    return {
      url,
      finalUrl,
      statusCode: response.status,
      title,
      metaDescription,
      h1: h1s[0] ?? '',
      h1Count: h1s.length,
      canonical,
      wordCount,
      indexable,
      internalLinksOut: internalLinks.size,
      externalLinksOut,
      internalLinks: [...internalLinks],
      issues,
      crawlError: null,
      fetchProfile: profile,
      botBlockedInitially,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fetch failed';
    const issues: SiteCrawlIssue[] = [
      { code: 'crawl_failed', message },
      { code: 'non_200_status', message: 'Request failed' },
    ];

    return {
      url,
      finalUrl: url,
      statusCode: 0,
      title: '',
      metaDescription: '',
      h1: '',
      h1Count: 0,
      canonical: '',
      wordCount: 0,
      indexable: true,
      internalLinksOut: 0,
      externalLinksOut: 0,
      internalLinks: [],
      issues,
      crawlError: message,
    };
  }
}
