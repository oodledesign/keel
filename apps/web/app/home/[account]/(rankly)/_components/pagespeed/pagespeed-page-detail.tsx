'use client';

import Link from 'next/link';

import type {
  PagespeedPageHistory,
  PagespeedSnapshot,
} from '~/lib/pagespeed/types';

import { PagespeedHistoryChart } from './pagespeed-history-chart';
import { PagespeedRecommendations } from './pagespeed-recommendations';

function scoreTone(score: number | null | undefined): string {
  if (score == null) return 'text-muted-foreground';
  if (score >= 90) return 'text-[var(--keel-teal)]';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
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

function ScoreCard(props: {
  label: string;
  metrics: PagespeedSnapshot['mobile'];
}) {
  if (!props.metrics) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <p className="text-muted-foreground text-xs uppercase tracking-wide">
          {props.label}
        </p>
        <p className="text-muted-foreground mt-2 text-sm">Not checked yet</p>
      </div>
    );
  }

  if (props.metrics.errorMsg) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <p className="text-muted-foreground text-xs uppercase tracking-wide">
          {props.label}
        </p>
        <p className="mt-2 text-sm text-red-400">{props.metrics.errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">
        {props.label}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground text-[10px] uppercase">Perf</p>
          <p
            className={`text-lg font-semibold tabular-nums ${scoreTone(props.metrics.performanceScore)}`}
          >
            {formatScore(props.metrics.performanceScore)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] uppercase">A11y</p>
          <p
            className={`text-lg font-semibold tabular-nums ${scoreTone(props.metrics.accessibilityScore)}`}
          >
            {formatScore(props.metrics.accessibilityScore)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] uppercase">Best</p>
          <p
            className={`text-lg font-semibold tabular-nums ${scoreTone(props.metrics.bestPracticesScore)}`}
          >
            {formatScore(props.metrics.bestPracticesScore)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] uppercase">SEO</p>
          <p
            className={`text-lg font-semibold tabular-nums ${scoreTone(props.metrics.seoScore)}`}
          >
            {formatScore(props.metrics.seoScore)}
          </p>
        </div>
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        LCP {formatMs(props.metrics.lcpMs)}
        {props.metrics.fetchedAt
          ? ` · Checked ${new Date(props.metrics.fetchedAt).toLocaleString()}`
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
              <span className="text-muted-foreground ml-2 text-xs uppercase">
                Homepage
              </span>
            ) : null}
          </p>
          <a
            href={props.snapshot.url}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-primary text-xs underline-offset-4 hover:underline"
          >
            {props.snapshot.url.replace(/^https?:\/\//, '')}
          </a>
        </div>
        <Link
          href={props.backHref}
          className="text-muted-foreground text-sm hover:text-white"
        >
          ← Back to PageSpeed
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ScoreCard label="Mobile" metrics={props.snapshot.mobile} />
        <ScoreCard label="Desktop" metrics={props.snapshot.desktop} />
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-black/10">
        <PagespeedHistoryChart history={props.history} />
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-black/10">
        <PagespeedRecommendations
          mobile={props.snapshot.mobile}
          desktop={props.snapshot.desktop}
          className="px-4 py-4"
        />
      </div>
    </div>
  );
}
