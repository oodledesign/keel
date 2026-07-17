import 'server-only';

import { loadPagespeedSnapshots } from '~/lib/pagespeed/db';
import { pageLabelFromUrl } from '~/lib/pagespeed/domain';
import type { PagespeedSnapshot } from '~/lib/pagespeed/types';
import {
  loadLatestSiteCrawlJob,
  loadSiteCrawlPages,
} from '~/lib/site-crawl/db';
import type { SiteCrawlPageRow } from '~/lib/site-crawl/types';

import { buildPageRecommendations } from './recommendations';
import { computePageScores } from './score';
import type { RanklyPageDetail, RanklyPageSummary } from './types';
import { normalizeProjectPageUrl, pageKeyFromUrl, pageUrlKey } from './url';

type MergedPage = {
  url: string;
  label: string;
  isHomepage: boolean;
  crawl: SiteCrawlPageRow | null;
  pagespeed: PagespeedSnapshot | null;
  pagespeedPageId: string | null;
  lastUpdatedAt: string | null;
};

function isHomepageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname === '/' || parsed.pathname === '';
  } catch {
    return false;
  }
}

function buildLabel(
  url: string,
  crawl: SiteCrawlPageRow | null,
  pagespeed: PagespeedSnapshot | null,
): string {
  if (pagespeed?.label) return pagespeed.label;
  if (pagespeed?.isHomepage || (crawl?.url && isHomepageUrl(crawl.url))) {
    return 'Homepage';
  }
  return pageLabelFromUrl(url, isHomepageUrl(url));
}

function latestTimestamp(
  crawl: SiteCrawlPageRow | null,
  pagespeed: PagespeedSnapshot | null,
): string | null {
  const timestamps = [
    crawl?.crawled_at,
    pagespeed?.lastScannedAt,
    pagespeed?.mobile?.fetchedAt,
    pagespeed?.desktop?.fetchedAt,
  ]
    .filter(Boolean)
    .map((value) => new Date(String(value)).getTime())
    .filter((value) => !Number.isNaN(value));

  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

function toSummary(page: MergedPage): RanklyPageSummary {
  const scores = computePageScores({
    crawl: page.crawl,
    pagespeed: page.pagespeed,
  });
  const recommendations = buildPageRecommendations({
    crawl: page.crawl,
    pagespeed: page.pagespeed,
    url: page.url,
  });

  return {
    pageKey: pageKeyFromUrl(page.url),
    url: page.url,
    label: page.label,
    isHomepage: page.isHomepage,
    scores,
    recommendationCount: recommendations.length,
    hasCrawlData: page.crawl != null,
    hasPagespeedData: page.pagespeed != null,
    lastUpdatedAt: page.lastUpdatedAt,
  };
}

async function loadLatestCrawlPages(
  projectId: string,
): Promise<SiteCrawlPageRow[]> {
  const job = await loadLatestSiteCrawlJob(projectId);
  if (!job || job.status !== 'done') return [];
  return loadSiteCrawlPages(job.id, 2000);
}

async function mergeProjectPages(projectId: string): Promise<MergedPage[]> {
  const [crawlPages, pagespeedSnapshots] = await Promise.all([
    loadLatestCrawlPages(projectId),
    loadPagespeedSnapshots(projectId),
  ]);

  const merged = new Map<string, MergedPage>();

  for (const crawl of crawlPages) {
    const url = normalizeProjectPageUrl(crawl.url);
    const key = pageUrlKey(url);

    merged.set(key, {
      url,
      label: buildLabel(url, crawl, null),
      isHomepage: isHomepageUrl(url),
      crawl,
      pagespeed: null,
      pagespeedPageId: null,
      lastUpdatedAt: latestTimestamp(crawl, null),
    });
  }

  for (const snapshot of pagespeedSnapshots) {
    const url = normalizeProjectPageUrl(snapshot.url);
    const key = pageUrlKey(url);
    const existing = merged.get(key);

    const row: MergedPage = existing ?? {
      url,
      label: buildLabel(url, null, snapshot),
      isHomepage: snapshot.isHomepage || isHomepageUrl(url),
      crawl: null,
      pagespeed: null,
      pagespeedPageId: null,
      lastUpdatedAt: null,
    };

    row.pagespeed = snapshot;
    row.pagespeedPageId = snapshot.pageId;
    row.label = buildLabel(url, row.crawl, snapshot);
    row.isHomepage = row.isHomepage || snapshot.isHomepage;
    row.lastUpdatedAt = latestTimestamp(row.crawl, snapshot);
    merged.set(key, row);
  }

  return [...merged.values()]
    .filter((page) => page.crawl != null || page.pagespeed != null)
    .sort((a, b) => {
      if (a.isHomepage !== b.isHomepage) return a.isHomepage ? -1 : 1;
      return a.url.localeCompare(b.url);
    });
}

export async function loadRanklyPageInventory(
  projectId: string,
): Promise<RanklyPageSummary[]> {
  const pages = await mergeProjectPages(projectId);
  return pages.map(toSummary);
}

export async function loadRanklyPageDetail(
  projectId: string,
  pageKey: string,
): Promise<RanklyPageDetail | null> {
  const pages = await mergeProjectPages(projectId);
  const match = pages.find((page) => pageKeyFromUrl(page.url) === pageKey);
  if (!match) return null;

  const summary = toSummary(match);
  const recommendations = buildPageRecommendations({
    crawl: match.crawl,
    pagespeed: match.pagespeed,
    url: match.url,
  });

  return {
    ...summary,
    crawl: match.crawl,
    pagespeed: match.pagespeed,
    pagespeedPageId: match.pagespeedPageId,
    recommendations,
  };
}

export async function loadRanklyPageInventoryMeta(projectId: string): Promise<{
  pageCount: number;
  crawlJobDone: boolean;
  hasPagespeed: boolean;
}> {
  const [crawlPages, pagespeedSnapshots, job] = await Promise.all([
    loadLatestCrawlPages(projectId),
    loadPagespeedSnapshots(projectId),
    loadLatestSiteCrawlJob(projectId),
  ]);

  const keys = new Set<string>();
  for (const page of crawlPages)
    keys.add(pageUrlKey(normalizeProjectPageUrl(page.url)));
  for (const snapshot of pagespeedSnapshots) {
    keys.add(pageUrlKey(normalizeProjectPageUrl(snapshot.url)));
  }

  return {
    pageCount: keys.size,
    crawlJobDone: job?.status === 'done',
    hasPagespeed: pagespeedSnapshots.some(
      (row) => row.mobile != null || row.desktop != null,
    ),
  };
}
