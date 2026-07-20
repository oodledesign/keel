'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

import type {
  PagespeedPageHistory,
  PagespeedSnapshot,
} from '~/lib/pagespeed/types';

import { PagespeedRecommendations } from './pagespeed-recommendations';

const PagespeedHistoryChart = dynamic(
  () =>
    import('./pagespeed-history-chart').then(
      (mod) => mod.PagespeedHistoryChart,
    ),
  { ssr: false },
);

function scoreTone(score: number | null | undefined): string {
  if (score == null) return 'text-[var(--workspace-shell-text-muted)]';
  if (score >= 90) return 'text-[var(--ozer-accent)]';
  if (score >= 50) return 'text-amber-400';
  return 'text-[var(--ozer-accent-pressed,#C2452A)]';
}

function formatScore(score: number | null | undefined): string {
  if (score == null) return '—';
  return String(score);
}

function formatMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function formatScanDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function ScoreCard(props: {
  label: string;
  metrics: PagespeedSnapshot['mobile'];
}) {
  if (!props.metrics) {
    return (
      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
        <p className="text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          {props.label}
        </p>
        <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
          Not checked yet
        </p>
      </div>
    );
  }

  if (props.metrics.errorMsg) {
    return (
      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
        <p className="text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          {props.label}
        </p>
        <p className="mt-2 text-sm text-[var(--ozer-accent-pressed,#C2452A)]">
          {props.metrics.errorMsg}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <p className="text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
        {props.label}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[10px] text-[var(--workspace-shell-text-muted)] uppercase">
            Perf
          </p>
          <p
            className={`text-lg font-semibold tabular-nums ${scoreTone(props.metrics.performanceScore)}`}
          >
            {formatScore(props.metrics.performanceScore)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-[var(--workspace-shell-text-muted)] uppercase">
            A11y
          </p>
          <p
            className={`text-lg font-semibold tabular-nums ${scoreTone(props.metrics.accessibilityScore)}`}
          >
            {formatScore(props.metrics.accessibilityScore)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-[var(--workspace-shell-text-muted)] uppercase">
            Best
          </p>
          <p
            className={`text-lg font-semibold tabular-nums ${scoreTone(props.metrics.bestPracticesScore)}`}
          >
            {formatScore(props.metrics.bestPracticesScore)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-[var(--workspace-shell-text-muted)] uppercase">
            SEO
          </p>
          <p
            className={`text-lg font-semibold tabular-nums ${scoreTone(props.metrics.seoScore)}`}
          >
            {formatScore(props.metrics.seoScore)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-[var(--workspace-shell-text-muted)]">
        LCP {formatMs(props.metrics.lcpMs)}
        {props.metrics.fetchedAt
          ? ` · Checked ${formatScanDate(props.metrics.fetchedAt)}`
          : null}
      </p>
    </div>
  );
}

export function PagespeedPageDetail(props: {
  snapshot: PagespeedSnapshot;
  history: PagespeedPageHistory;
  backHref: string;
}) {
  const title = props.snapshot.label ?? props.snapshot.url;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {title}
            {props.snapshot.isHomepage ? (
              <span className="ml-2 text-xs text-[var(--workspace-shell-text-muted)] uppercase">
                Homepage
              </span>
            ) : null}
          </p>
          <a
            href={props.snapshot.url}
            target="_blank"
            rel="noreferrer"
            className="hover:text-primary text-xs text-[var(--workspace-shell-text-muted)] underline-offset-4 hover:underline"
          >
            {props.snapshot.url.replace(/^https?:\/\//, '')}
          </a>
          {props.snapshot.lastScannedAt ? (
            <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
              Last scanned{' '}
              <time dateTime={props.snapshot.lastScannedAt}>
                {formatScanDate(props.snapshot.lastScannedAt)}
              </time>
            </p>
          ) : null}
        </div>
        <Link
          href={props.backHref}
          className="text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
        >
          ← Back to PageSpeed
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ScoreCard label="Mobile" metrics={props.snapshot.mobile} />
        <ScoreCard label="Desktop" metrics={props.snapshot.desktop} />
      </div>

      <div className="overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
        <PagespeedHistoryChart history={props.history} />
      </div>

      <div className="overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
        <PagespeedRecommendations
          mobile={props.snapshot.mobile}
          desktop={props.snapshot.desktop}
          className="px-4 py-4"
        />
      </div>
    </div>
  );
}
