import type { PagespeedSnapshot } from '~/lib/pagespeed/types';
import type { SiteCrawlIssueCode } from '~/lib/site-crawl/types';
import type { SiteCrawlPageRow } from '~/lib/site-crawl/types';

import type { PageScoreBreakdown } from './types';

const ISSUE_PENALTIES: Partial<Record<SiteCrawlIssueCode, number>> = {
  missing_title: 18,
  title_too_long: 6,
  title_too_short: 4,
  missing_meta_description: 12,
  meta_too_long: 5,
  missing_h1: 10,
  multiple_h1: 8,
  missing_canonical: 6,
  noindex: 20,
  non_200_status: 25,
  crawl_failed: 30,
  duplicate_title: 8,
  duplicate_meta: 6,
  malformed_schema: 10,
  missing_schema: 5,
  schema_missing_type: 8,
  schema_incomplete: 8,
};

const SCHEMA_ISSUE_CODES = new Set<SiteCrawlIssueCode>([
  'malformed_schema',
  'missing_schema',
  'schema_missing_type',
  'schema_incomplete',
]);

const ON_PAGE_ISSUE_CODES = new Set<SiteCrawlIssueCode>([
  'missing_title',
  'title_too_long',
  'title_too_short',
  'missing_meta_description',
  'meta_too_long',
  'missing_h1',
  'multiple_h1',
  'duplicate_title',
  'duplicate_meta',
]);

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreFromIssues(
  issues: SiteCrawlPageRow['issues'],
  allowed: Set<SiteCrawlIssueCode>,
): number | null {
  const relevant = issues.filter((issue) => allowed.has(issue.code));
  if (!issues.length && relevant.length === 0) return null;

  let score = 100;
  for (const issue of relevant) {
    score -= ISSUE_PENALTIES[issue.code] ?? 4;
  }

  return clampScore(score);
}

function onPageScore(crawl: SiteCrawlPageRow | null): number | null {
  if (!crawl) return null;
  return scoreFromIssues(crawl.issues, ON_PAGE_ISSUE_CODES) ?? 100;
}

function schemaScore(crawl: SiteCrawlPageRow | null): number | null {
  if (!crawl) return null;

  const schemaIssues = crawl.issues.filter((issue) =>
    SCHEMA_ISSUE_CODES.has(issue.code),
  );
  const hasTypes = (crawl.schema_types ?? []).length > 0;

  if (!hasTypes && schemaIssues.length === 0) {
    return 55;
  }

  let score = 100;
  for (const issue of schemaIssues) {
    score -= ISSUE_PENALTIES[issue.code] ?? 8;
  }

  return clampScore(score);
}

function technicalScore(crawl: SiteCrawlPageRow | null): number | null {
  if (!crawl) return null;

  let score = 100;

  if (crawl.status_code !== 200) score -= 35;
  if (!crawl.indexable) score -= 25;
  if (!crawl.canonical.trim()) score -= 10;
  if (crawl.crawl_error) score -= 30;

  for (const issue of crawl.issues) {
    if (issue.code === 'non_200_status') score -= 10;
    if (issue.code === 'noindex') score -= 10;
    if (issue.code === 'missing_canonical') score -= 5;
    if (issue.code === 'crawl_failed') score -= 15;
  }

  return clampScore(score);
}

function performanceScore(pagespeed: PagespeedSnapshot | null): number | null {
  if (!pagespeed) return null;

  const scores = [
    pagespeed.mobile?.performanceScore,
    pagespeed.desktop?.performanceScore,
  ].filter((value): value is number => value != null);

  if (!scores.length) return null;
  return clampScore(
    scores.reduce((sum, value) => sum + value, 0) / scores.length,
  );
}

function weightedOverall(parts: {
  onPage: number | null;
  performance: number | null;
  technical: number | null;
  schema: number | null;
}): number | null {
  const weights: Array<[keyof typeof parts, number]> = [
    ['onPage', 0.4],
    ['performance', 0.35],
    ['technical', 0.15],
    ['schema', 0.1],
  ];

  let totalWeight = 0;
  let weighted = 0;

  for (const [key, weight] of weights) {
    const value = parts[key];
    if (value != null) {
      weighted += value * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return null;
  return clampScore(weighted / totalWeight);
}

export function computePageScores(input: {
  crawl: SiteCrawlPageRow | null;
  pagespeed: PagespeedSnapshot | null;
}): PageScoreBreakdown {
  const onPage = onPageScore(input.crawl);
  const performance = performanceScore(input.pagespeed);
  const technical = technicalScore(input.crawl);
  const schema = schemaScore(input.crawl);

  return {
    onPage,
    performance,
    technical,
    schema,
    overall: weightedOverall({ onPage, performance, technical, schema }),
  };
}

export function scoreTone(score: number | null | undefined): string {
  if (score == null) return 'text-muted-foreground';
  if (score >= 90) return 'text-[var(--ozer-accent)]';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}
