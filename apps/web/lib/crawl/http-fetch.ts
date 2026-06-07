export const RANKLY_CRAWL_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Rankly/1.0; +https://rankly.app)',
  Accept:
    'text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.8',
};

export const BROWSER_CRAWL_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
};

export type CrawlFetchProfile = 'rankly' | 'browser_fallback';

export type CrawlFetchResult = {
  response: Response;
  profile: CrawlFetchProfile;
  /** Set when the Rankly user-agent was blocked before browser fallback. */
  botBlockedInitially: boolean;
  initialStatusCode: number | null;
};

const BLOCKED_STATUSES = new Set([401, 403, 407, 429]);

export function isBlockedCrawlStatus(status: number): boolean {
  return BLOCKED_STATUSES.has(status);
}

export async function crawlFetch(
  url: string,
  options?: { timeoutMs?: number },
): Promise<CrawlFetchResult> {
  const timeoutMs = options?.timeoutMs ?? 12_000;

  const botResponse = await fetch(url, {
    headers: RANKLY_CRAWL_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!isBlockedCrawlStatus(botResponse.status)) {
    return {
      response: botResponse,
      profile: 'rankly',
      botBlockedInitially: false,
      initialStatusCode: null,
    };
  }

  const browserResponse = await fetch(url, {
    headers: BROWSER_CRAWL_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });

  return {
    response: browserResponse,
    profile: 'browser_fallback',
    botBlockedInitially: true,
    initialStatusCode: botResponse.status,
  };
}
