'use client';

import type { CrawlAccessSummary } from '~/lib/crawl/access-summary';

export function CrawlAccessBanner(props: { summary: CrawlAccessSummary }) {
  if (props.summary.severity === 'ok') {
    return null;
  }

  const styles =
    props.summary.severity === 'blocked'
      ? 'border-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_12%,transparent)] text-[var(--workspace-shell-text)]'
      : 'border-[color-mix(in_srgb,#F0C14B_35%,transparent)] bg-[color-mix(in_srgb,#F0C14B_12%,transparent)] text-[var(--workspace-shell-text)]';

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
