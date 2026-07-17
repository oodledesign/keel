import 'server-only';

import type { SiteCrawlPageRow } from './types';
import { SITE_CRAWL_ISSUE_LABELS } from './types';

function escapeCsv(
  value: string | number | boolean | null | undefined,
): string {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function siteCrawlPagesToCsv(pages: SiteCrawlPageRow[]): string {
  const headers = [
    'URL',
    'Final URL',
    'Status code',
    'Title',
    'Meta description',
    'H1',
    'H1 count',
    'Canonical',
    'Word count',
    'Indexable',
    'Internal links out',
    'External links out',
    'Schema types',
    'Schema JSON',
    'Issues',
    'Crawl error',
  ];

  const rows = pages.map((page) =>
    [
      page.url,
      page.final_url ?? '',
      page.status_code,
      page.title,
      page.meta_description,
      page.h1,
      page.h1_count,
      page.canonical,
      page.word_count,
      page.indexable ? 'yes' : 'no',
      page.internal_links_out,
      page.external_links_out,
      (page.schema_types ?? []).join('; '),
      page.schema_objects?.length ? JSON.stringify(page.schema_objects) : '',
      page.issues
        .map((issue) => SITE_CRAWL_ISSUE_LABELS[issue.code] ?? issue.code)
        .join('; '),
      page.crawl_error ?? '',
    ]
      .map(escapeCsv)
      .join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}
