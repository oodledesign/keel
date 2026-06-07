import 'server-only';

import type { SiteCrawlIssue, SiteCrawlIssueCode, SiteCrawlIssueSummary } from './types';

export function detectPageIssues(input: {
  statusCode: number;
  title: string;
  metaDescription: string;
  h1Count: number;
  canonical: string;
  indexable: boolean;
  crawlFailed: boolean;
}): SiteCrawlIssue[] {
  const issues: SiteCrawlIssue[] = [];

  if (input.crawlFailed) {
    issues.push({ code: 'crawl_failed', message: 'Page could not be fetched' });
  }

  if (input.statusCode !== 200) {
    issues.push({
      code: 'non_200_status',
      message: `HTTP ${input.statusCode || 'error'}`,
    });
  }

  if (!input.title.trim()) {
    issues.push({ code: 'missing_title', message: 'Missing title tag' });
  } else {
    if (input.title.length > 60) {
      issues.push({ code: 'title_too_long', message: 'Title exceeds 60 characters' });
    }
    if (input.title.length < 30) {
      issues.push({ code: 'title_too_short', message: 'Title under 30 characters' });
    }
  }

  if (!input.metaDescription.trim()) {
    issues.push({
      code: 'missing_meta_description',
      message: 'Missing meta description',
    });
  } else if (input.metaDescription.length > 160) {
    issues.push({
      code: 'meta_too_long',
      message: 'Meta description exceeds 160 characters',
    });
  }

  if (input.h1Count === 0) {
    issues.push({ code: 'missing_h1', message: 'Missing H1' });
  } else if (input.h1Count > 1) {
    issues.push({ code: 'multiple_h1', message: `${input.h1Count} H1 tags found` });
  }

  if (!input.canonical.trim() && input.statusCode === 200) {
    issues.push({ code: 'missing_canonical', message: 'Missing canonical URL' });
  }

  if (!input.indexable) {
    issues.push({ code: 'noindex', message: 'Page has noindex directive' });
  }

  return issues;
}

export function summariseIssues(
  pages: Array<{ issues: SiteCrawlIssue[] }>,
): SiteCrawlIssueSummary {
  const summary: SiteCrawlIssueSummary = {};

  for (const page of pages) {
    for (const issue of page.issues) {
      summary[issue.code] = (summary[issue.code] ?? 0) + 1;
    }
  }

  return summary;
}

export function applyDuplicateIssues(
  pages: Array<{
    id: string;
    title: string;
    meta_description: string;
    issues: SiteCrawlIssue[];
  }>,
): Array<{ id: string; issues: SiteCrawlIssue[] }> {
  const titleCounts = new Map<string, number>();
  const metaCounts = new Map<string, number>();

  for (const page of pages) {
    const titleKey = page.title.trim().toLowerCase();
    if (titleKey) {
      titleCounts.set(titleKey, (titleCounts.get(titleKey) ?? 0) + 1);
    }

    const metaKey = page.meta_description.trim().toLowerCase();
    if (metaKey) {
      metaCounts.set(metaKey, (metaCounts.get(metaKey) ?? 0) + 1);
    }
  }

  return pages.map((page) => {
    const issues = [...page.issues];
    const titleKey = page.title.trim().toLowerCase();
    if (titleKey && (titleCounts.get(titleKey) ?? 0) > 1) {
      issues.push({ code: 'duplicate_title', message: 'Duplicate title on other pages' });
    }

    const metaKey = page.meta_description.trim().toLowerCase();
    if (metaKey && (metaCounts.get(metaKey) ?? 0) > 1) {
      issues.push({
        code: 'duplicate_meta',
        message: 'Duplicate meta description on other pages',
      });
    }

    return { id: page.id, issues };
  });
}

export function countIssueType(
  summary: SiteCrawlIssueSummary,
  code: SiteCrawlIssueCode,
): number {
  return summary[code] ?? 0;
}
