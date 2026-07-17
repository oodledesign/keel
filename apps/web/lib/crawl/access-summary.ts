import type { CrawlFetchProfile } from './http-fetch';
import { isBlockedCrawlStatus } from './http-fetch';

export type CrawlAccessPage = {
  url: string;
  statusCode: number;
  fetchProfile?: CrawlFetchProfile;
  botBlockedInitially?: boolean;
  wordCount?: number;
  crawlFailed?: boolean;
};

export type CrawlAccessSummary = {
  severity: 'ok' | 'warning' | 'blocked';
  title: string;
  message: string;
  usedBrowserFallback: boolean;
  stillBlocked: boolean;
  blockedPageCount: number;
  fallbackPageCount: number;
  totalPages: number;
};

function isHomepageUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return pathname === '/' || pathname === '';
  } catch {
    return url.endsWith('/');
  }
}

export function analyzeCrawlAccess(
  pages: CrawlAccessPage[],
): CrawlAccessSummary {
  const fallbackPages = pages.filter(
    (page) =>
      page.fetchProfile === 'browser_fallback' || page.botBlockedInitially,
  );
  const blockedPages = pages.filter(
    (page) =>
      page.crawlFailed ||
      isBlockedCrawlStatus(page.statusCode) ||
      (page.statusCode === 0 && page.wordCount === 0),
  );

  const homepage = pages.find((page) => isHomepageUrl(page.url)) ?? pages[0];
  const homepageBlocked =
    !homepage ||
    homepage.crawlFailed ||
    isBlockedCrawlStatus(homepage.statusCode) ||
    (homepage.statusCode === 200 &&
      (homepage.wordCount ?? 0) < 50 &&
      homepage.botBlockedInitially);

  const stillBlocked = Boolean(
    homepageBlocked && blockedPages.length === pages.length,
  );
  const usedBrowserFallback = fallbackPages.length > 0;

  if (stillBlocked) {
    return {
      severity: 'blocked',
      title: 'Crawler blocked — scores may be unreliable',
      message:
        'This site returned 403 Forbidden (or similar) even with a browser-like request. Hosting or WAF bot protection is blocking automated access. Allowlist SEO and AI crawlers in your host or CDN settings, then re-run the audit.',
      usedBrowserFallback,
      stillBlocked: true,
      blockedPageCount: blockedPages.length,
      fallbackPageCount: fallbackPages.length,
      totalPages: pages.length,
    };
  }

  if (usedBrowserFallback) {
    return {
      severity: 'warning',
      title: 'Bot protection detected — browser fallback used',
      message:
        'The site blocked Rankly’s crawler user-agent but allowed a browser-like request, so on-page scores reflect your live content. AI crawlers (GPTBot, ClaudeBot, etc.) may still be blocked unless you allowlist them in hosting or WAF settings.',
      usedBrowserFallback: true,
      stillBlocked: false,
      blockedPageCount: blockedPages.length,
      fallbackPageCount: fallbackPages.length,
      totalPages: pages.length,
    };
  }

  return {
    severity: 'ok',
    title: 'Crawl access OK',
    message: 'Pages were fetched successfully with the Rankly crawler.',
    usedBrowserFallback: false,
    stillBlocked: false,
    blockedPageCount: blockedPages.length,
    fallbackPageCount: 0,
    totalPages: pages.length,
  };
}
