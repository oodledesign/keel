'use client';

import type { CrawlAccessSummary } from '~/lib/crawl/access-summary';

export function CrawlAccessBanner(props: { summary: CrawlAccessSummary }) {
  if (props.summary.severity === 'ok') {
    return null;
  }

  const styles =
    props.summary.severity === 'blocked'
      ? 'border-red-500/40 bg-red-500/10 text-red-100'
      : 'border-amber-500/40 bg-amber-500/10 text-amber-100';

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>
      <p className="font-medium">{props.summary.title}</p>
      <p className="mt-1 text-xs opacity-90">{props.summary.message}</p>
      {props.summary.usedBrowserFallback && props.summary.totalPages > 0 ? (
        <p className="mt-2 text-xs opacity-75">
          Browser fallback used for {props.summary.fallbackPageCount} of{' '}
          {props.summary.totalPages} sampled pages.
        </p>
      ) : null}
    </div>
  );
}
