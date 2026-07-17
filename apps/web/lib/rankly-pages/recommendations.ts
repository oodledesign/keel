import { PAGESPEED_PRIORITY_LABELS } from '~/lib/pagespeed/recommendations';
import type { PagespeedSnapshot } from '~/lib/pagespeed/types';
import type { SiteCrawlIssue } from '~/lib/site-crawl/types';
import { SITE_CRAWL_ISSUE_LABELS } from '~/lib/site-crawl/types';
import type { SiteCrawlPageRow } from '~/lib/site-crawl/types';

import type { PageRecommendation } from './types';

function crawlIssuePriority(
  code: SiteCrawlIssue['code'],
): PageRecommendation['priority'] {
  switch (code) {
    case 'missing_title':
    case 'missing_h1':
    case 'missing_meta_description':
    case 'noindex':
    case 'non_200_status':
    case 'crawl_failed':
    case 'malformed_schema':
      return 'high';
    case 'title_too_long':
    case 'meta_too_long':
    case 'multiple_h1':
    case 'missing_canonical':
    case 'schema_incomplete':
    case 'schema_missing_type':
      return 'medium';
    default:
      return 'low';
  }
}

function recommendationCategory(
  code: SiteCrawlIssue['code'],
): PageRecommendation['category'] {
  if (
    code.startsWith('schema') ||
    code === 'malformed_schema' ||
    code === 'missing_schema'
  ) {
    return 'schema';
  }

  if (
    code === 'non_200_status' ||
    code === 'noindex' ||
    code === 'missing_canonical' ||
    code === 'crawl_failed'
  ) {
    return 'technical';
  }

  return 'on-page';
}

function recommendationFromCrawlIssue(
  page: SiteCrawlPageRow,
  issue: SiteCrawlIssue,
): PageRecommendation {
  const category = recommendationCategory(issue.code);
  const priority = crawlIssuePriority(issue.code);
  const label = SITE_CRAWL_ISSUE_LABELS[issue.code];

  switch (issue.code) {
    case 'missing_title':
      return {
        id: `crawl-${issue.code}`,
        category,
        priority,
        title: 'Add a title tag',
        detail: `This page has no <title> element. Search engines and browsers need one to understand the page topic.`,
        source: 'site-crawl',
        action: page.h1
          ? `Draft from your H1: "${page.h1}"`
          : 'Write a unique title under 60 characters that describes this page.',
      };

    case 'title_too_long':
      return {
        id: `crawl-${issue.code}`,
        category,
        priority,
        title: 'Shorten the title tag',
        detail: `Your title is ${page.title.length} characters. Google usually shows about 50–60. Current title: "${page.title}"`,
        source: 'site-crawl',
        action: 'Trim filler words and front-load the primary keyword.',
      };

    case 'title_too_short':
      return {
        id: `crawl-${issue.code}`,
        category,
        priority,
        title: 'Expand the title tag',
        detail: `Your title is only ${page.title.length} characters: "${page.title}". Aim for 30–60 characters with a clear keyword and brand where appropriate.`,
        source: 'site-crawl',
      };

    case 'missing_meta_description':
      return {
        id: `crawl-${issue.code}`,
        category,
        priority,
        title: 'Write a meta description',
        detail: `There is no meta description on this URL. Snippets in search results often come from this field.`,
        source: 'site-crawl',
        action: page.h1
          ? `Start from the H1 "${page.h1}" and summarise the page in 120–155 characters with a clear benefit.`
          : 'Add a unique 120–155 character summary with a call to action.',
      };

    case 'meta_too_long':
      return {
        id: `crawl-${issue.code}`,
        category,
        priority,
        title: 'Shorten the meta description',
        detail: `Your meta description is ${page.meta_description.length} characters (recommended max ~160). Current: "${page.meta_description}"`,
        source: 'site-crawl',
        action:
          'Cut secondary phrases and keep the core value proposition in the first 155 characters.',
      };

    case 'missing_h1':
      return {
        id: `crawl-${issue.code}`,
        category,
        priority,
        title: 'Add a single H1 heading',
        detail: `No H1 was found in the HTML. Each page should have one primary heading that matches search intent.`,
        source: 'site-crawl',
        action: page.title
          ? `Consider aligning an H1 with your title: "${page.title}"`
          : 'Add one H1 near the top of the main content.',
      };

    case 'multiple_h1':
      return {
        id: `crawl-${issue.code}`,
        category,
        priority,
        title: 'Use only one H1',
        detail: `We found ${page.h1_count} H1 tags. Keep one main H1 and demote the others to H2/H3. Current primary H1: "${page.h1 || '—'}"`,
        source: 'site-crawl',
      };

    case 'missing_canonical':
      return {
        id: `crawl-${issue.code}`,
        category,
        priority: 'medium',
        title: 'Add a canonical URL',
        detail: `No rel="canonical" link was found. This helps consolidate ranking signals when duplicate or parameterized URLs exist.`,
        source: 'site-crawl',
        action: `Point the canonical to ${page.url}`,
      };

    case 'noindex':
      return {
        id: `crawl-${issue.code}`,
        category: 'technical',
        priority: 'high',
        title: 'Remove noindex if this page should rank',
        detail: `A robots noindex directive blocks indexing. Only keep this if the page is intentionally hidden from search.`,
        source: 'site-crawl',
      };

    case 'non_200_status':
      return {
        id: `crawl-${issue.code}`,
        category: 'technical',
        priority: 'high',
        title: 'Fix HTTP status',
        detail: `This URL returned HTTP ${page.status_code}. Search engines cannot reliably index error pages.`,
        source: 'site-crawl',
      };

    default:
      return {
        id: `crawl-${issue.code}-${issue.message}`,
        category,
        priority,
        title: label,
        detail: issue.message,
        source: 'site-crawl',
      };
  }
}

function pagespeedRecommendations(
  pagespeed: PagespeedSnapshot,
  url: string,
): PageRecommendation[] {
  const path = url.replace(/^https?:\/\/[^/]+/, '') || '/';
  const items: PageRecommendation[] = [];

  for (const strategy of ['mobile', 'desktop'] as const) {
    const metrics = pagespeed[strategy];
    if (!metrics || metrics.errorMsg) continue;

    const lcp = metrics.lcpMs;
    const context =
      lcp != null
        ? ` On this page (${strategy}), LCP is ${lcp >= 1000 ? `${(lcp / 1000).toFixed(1)}s` : `${Math.round(lcp)}ms`}.`
        : ` On this page (${strategy}).`;

    for (const rec of metrics.recommendations) {
      items.push({
        id: `psi-${strategy}-${rec.auditId}`,
        category: 'performance',
        priority: rec.priority,
        title: rec.title,
        detail: `${rec.description}${context}${
          rec.displayValue ? ` Lighthouse measured: ${rec.displayValue}.` : ''
        }`,
        source: 'pagespeed',
        action:
          rec.savingsMs != null && rec.savingsMs > 0
            ? `Estimated savings on ${path} (${strategy}): ~${Math.round(rec.savingsMs)}ms.`
            : undefined,
      });
    }
  }

  return items;
}

export function buildPageRecommendations(input: {
  crawl: SiteCrawlPageRow | null;
  pagespeed: PagespeedSnapshot | null;
  url: string;
}): PageRecommendation[] {
  const seen = new Set<string>();
  const recommendations: PageRecommendation[] = [];

  for (const issue of input.crawl?.issues ?? []) {
    const rec = recommendationFromCrawlIssue(input.crawl!, issue);
    const key = `${rec.id}-${rec.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    recommendations.push(rec);
  }

  if (input.pagespeed) {
    for (const rec of pagespeedRecommendations(input.pagespeed, input.url)) {
      const key = `${rec.id}-${rec.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      recommendations.push(rec);
    }
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return recommendations.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  );
}

export { PAGESPEED_PRIORITY_LABELS };
