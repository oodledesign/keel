import 'server-only';

import type { CcIndexEntry } from './types';

const CC_INDEX_BASE = 'https://index.commoncrawl.org';

const FALLBACK_CRAWL_ID = 'CC-MAIN-2026-18';

export async function getLatestCrawlId(): Promise<string> {
  try {
    const res = await fetch(`${CC_INDEX_BASE}/collinfo.json`, {
      signal: AbortSignal.timeout(8000),
    });
    const colls = (await res.json()) as Array<{ id: string; name: string }>;
    return colls[0]?.id ?? FALLBACK_CRAWL_ID;
  } catch {
    return FALLBACK_CRAWL_ID;
  }
}

export async function discoverUrlsForDomain(
  domain: string,
  limit = 50,
): Promise<string[]> {
  const host = normaliseHost(domain);
  if (!host) return [];

  const crawlId = await getLatestCrawlId();
  const pattern = `*.${host}/*`;
  const indexUrl = `${CC_INDEX_BASE}/${crawlId}-index?url=${encodeURIComponent(pattern)}&output=json&limit=${limit}&fl=url,status,mime`;

  try {
    const res = await fetch(indexUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];

    const text = await res.text();
    const entries: CcIndexEntry[] = text
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as CcIndexEntry;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is CcIndexEntry => entry != null);

    return entries
      .filter(
        (entry) =>
          entry.status === '200' &&
          (entry.mime?.includes('html') ?? true),
      )
      .map((entry) => entry.url)
      .filter((url) => {
        try {
          const path = new URL(url).pathname.toLowerCase();
          return !path.match(/\.(jpg|jpeg|png|gif|svg|css|js|pdf|xml|json)$/);
        } catch {
          return false;
        }
      })
      .slice(0, limit);
  } catch (err) {
    console.error('[commoncrawl] CC Index API error:', err);
    return [];
  }
}

export async function urlExistsInCrawl(targetUrl: string): Promise<boolean> {
  const crawlId = await getLatestCrawlId();
  const indexUrl = `${CC_INDEX_BASE}/${crawlId}-index?url=${encodeURIComponent(targetUrl)}&output=json&limit=1`;

  try {
    const res = await fetch(indexUrl, { signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    return text.trim().length > 0;
  } catch {
    return false;
  }
}

function normaliseHost(domain: string): string {
  return domain
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim();
}
