'use client';

import { useState } from 'react';

import Link from 'next/link';

import { PAGESPEED_PRIORITY_LABELS } from '~/lib/rankly-pages/recommendations';
import { scoreTone } from '~/lib/rankly-pages/score';
import type { RanklyPageDetail } from '~/lib/rankly-pages/types';
import {
  PAGE_RECOMMENDATION_CATEGORY_LABELS,
  PAGE_SCORE_LABELS,
} from '~/lib/rankly-pages/types';
import { pageDisplayPath } from '~/lib/rankly-pages/url';
import { SITE_CRAWL_ISSUE_LABELS } from '~/lib/site-crawl/types';

import { PageOptimizePanel } from './page-optimize-panel';

const PRIORITY_COLOURS = {
  high: 'bg-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_18%,transparent)] text-[var(--workspace-shell-text)]',
  medium:
    'bg-[color-mix(in_srgb,#F0C14B_18%,transparent)] text-[var(--workspace-shell-text)]',
  low: 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
} as const;

function formatScore(score: number | null | undefined): string {
  if (score == null) return '—';
  return String(score);
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function formatMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function ScoreBreakdownCard(props: { label: string; score: number | null }) {
  return (
    <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <p className="text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
        {props.label}
      </p>
      <p
        className={`mt-2 text-3xl font-semibold tabular-nums ${scoreTone(props.score)}`}
      >
        {formatScore(props.score)}
      </p>
    </div>
  );
}

function RecommendationRow(props: {
  recommendation: RanklyPageDetail['recommendations'][number];
}) {
  const [expanded, setExpanded] = useState(false);
  const rec = props.recommendation;

  return (
    <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
      <button
        type="button"
        className="flex w-full items-start gap-3 p-3 text-left"
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{rec.title}</span>
          <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">
            {PAGE_RECOMMENDATION_CATEGORY_LABELS[rec.category]}
            {' · '}
            {rec.source === 'site-crawl' ? 'Site crawl' : 'PageSpeed'}
          </span>
        </span>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-[10px] uppercase ${PRIORITY_COLOURS[rec.priority]}`}
        >
          {PAGESPEED_PRIORITY_LABELS[rec.priority]}
        </span>
        <span className="shrink-0 text-xs text-[var(--workspace-shell-text-muted)]">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded ? (
        <div className="space-y-2 border-t border-[color:var(--workspace-shell-border)] px-3 pt-2 pb-3">
          <p className="text-sm leading-relaxed text-[var(--workspace-shell-text-muted)]">
            {rec.detail}
          </p>
          {rec.action ? (
            <p className="rounded-md border border-[var(--ozer-accent)]/20 bg-[var(--ozer-accent)]/5 px-3 py-2 text-sm text-[var(--ozer-accent)]">
              {rec.action}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CrawlDataSection(props: { page: RanklyPageDetail }) {
  const crawl = props.page.crawl;
  if (!crawl) {
    return (
      <section className="space-y-2">
        <h2 className="text-sm font-medium">On-page data</h2>
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No crawl data for this URL yet. Run a site crawl to populate title,
          meta, and technical checks.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium">On-page data</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
          <p className="text-[10px] text-[var(--workspace-shell-text-muted)] uppercase">
            Title
          </p>
          <p className="mt-1 text-sm">{crawl.title || '—'}</p>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
            {crawl.title.length} characters
          </p>
        </div>
        <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
          <p className="text-[10px] text-[var(--workspace-shell-text-muted)] uppercase">
            Meta description
          </p>
          <p className="mt-1 text-sm">{crawl.meta_description || '—'}</p>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
            {crawl.meta_description.length} characters
          </p>
        </div>
        <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
          <p className="text-[10px] text-[var(--workspace-shell-text-muted)] uppercase">
            H1
          </p>
          <p className="mt-1 text-sm">{crawl.h1 || '—'}</p>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
            {crawl.h1_count} H1 tag{crawl.h1_count === 1 ? '' : 's'}
          </p>
        </div>
        <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
          <p className="text-[10px] text-[var(--workspace-shell-text-muted)] uppercase">
            Technical
          </p>
          <p className="mt-1 text-sm">
            HTTP {crawl.status_code}
            {crawl.indexable ? ' · Indexable' : ' · Noindex'}
          </p>
          <p className="mt-1 truncate text-xs text-[var(--workspace-shell-text-muted)]">
            Canonical: {crawl.canonical || '—'}
          </p>
        </div>
      </div>

      {(crawl.schema_types ?? []).length > 0 ? (
        <div>
          <p className="mb-2 text-xs text-[var(--workspace-shell-text-muted)] uppercase">
            Schema types
          </p>
          <div className="flex flex-wrap gap-1">
            {crawl.schema_types.map((type) => (
              <span
                key={type}
                className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--ozer-info)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-info)_12%,transparent)] px-2 py-0.5 text-xs text-[var(--workspace-shell-text)]"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {crawl.issues.length > 0 ? (
        <div>
          <p className="mb-2 text-xs text-[var(--workspace-shell-text-muted)] uppercase">
            Crawl issues
          </p>
          <ul className="space-y-1 text-sm">
            {crawl.issues.map((issue) => (
              <li
                key={`${issue.code}-${issue.message}`}
                className="rounded-md border border-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_25%,transparent)] bg-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_6%,transparent)] px-3 py-2"
              >
                <span className="font-medium text-[var(--workspace-shell-text)]">
                  {SITE_CRAWL_ISSUE_LABELS[issue.code]}
                </span>
                <span className="text-[var(--workspace-shell-text-muted)]">
                  {' '}
                  — {issue.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function PagespeedSection(props: {
  page: RanklyPageDetail;
  pagespeedDetailHref: string | null;
}) {
  const psi = props.page.pagespeed;
  if (!psi) {
    return (
      <section className="space-y-2">
        <h2 className="text-sm font-medium">PageSpeed</h2>
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No PageSpeed data for this URL yet.
        </p>
      </section>
    );
  }

  const strategies = [
    { label: 'Mobile', metrics: psi.mobile },
    { label: 'Desktop', metrics: psi.desktop },
  ].filter((item) => item.metrics != null);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">PageSpeed</h2>
        {props.pagespeedDetailHref ? (
          <Link
            href={props.pagespeedDetailHref}
            className="text-xs text-[var(--ozer-accent)] underline-offset-4 hover:underline"
          >
            Full PageSpeed history →
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {strategies.map(({ label, metrics }) =>
          metrics && !metrics.errorMsg ? (
            <div
              key={label}
              className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4"
            >
              <p className="text-xs text-[var(--workspace-shell-text-muted)] uppercase">
                {label}
              </p>
              <p
                className={`mt-2 text-2xl font-semibold tabular-nums ${scoreTone(metrics.performanceScore)}`}
              >
                {formatScore(metrics.performanceScore)}
                <span className="text-sm font-normal text-[var(--workspace-shell-text-muted)]">
                  {' '}
                  performance
                </span>
              </p>
              <p className="mt-2 text-xs text-[var(--workspace-shell-text-muted)]">
                LCP {formatMs(metrics.lcpMs)}
                {metrics.fetchedAt
                  ? ` · ${formatDate(metrics.fetchedAt)}`
                  : null}
              </p>
            </div>
          ) : (
            <div
              key={label}
              className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4"
            >
              <p className="text-xs text-[var(--workspace-shell-text-muted)] uppercase">
                {label}
              </p>
              <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
                {metrics?.errorMsg ?? 'Not checked yet'}
              </p>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

export function RanklyPageDetailView(props: {
  page: RanklyPageDetail;
  backHref: string;
  pagespeedDetailHref: string | null;
  accountId: string;
  projectId: string;
  country: string;
}) {
  const { page } = props;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-lg font-medium">
            {page.label}
            {page.isHomepage ? (
              <span className="ml-2 text-xs text-[var(--workspace-shell-text-muted)] uppercase">
                Homepage
              </span>
            ) : null}
          </p>
          <a
            href={page.url}
            target="_blank"
            rel="noreferrer"
            className="hover:text-primary text-xs text-[var(--workspace-shell-text-muted)] underline-offset-4 hover:underline"
          >
            {pageDisplayPath(page.url)}
          </a>
          {page.lastUpdatedAt ? (
            <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
              Last updated {formatDate(page.lastUpdatedAt)}
            </p>
          ) : null}
        </div>

        <div className="text-right">
          <p className="text-xs text-[var(--workspace-shell-text-muted)] uppercase">
            Overall score
          </p>
          <p
            className={`text-4xl font-semibold tabular-nums ${scoreTone(page.scores.overall)}`}
          >
            {formatScore(page.scores.overall)}
            {page.scores.overall != null ? (
              <span className="text-lg font-normal text-[var(--workspace-shell-text-muted)]">
                {' '}
                /100
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ScoreBreakdownCard
          label={PAGE_SCORE_LABELS.onPage}
          score={page.scores.onPage}
        />
        <ScoreBreakdownCard
          label={PAGE_SCORE_LABELS.performance}
          score={page.scores.performance}
        />
        <ScoreBreakdownCard
          label={PAGE_SCORE_LABELS.technical}
          score={page.scores.technical}
        />
        <ScoreBreakdownCard
          label={PAGE_SCORE_LABELS.schema}
          score={page.scores.schema}
        />
      </div>

      <CrawlDataSection page={page} />

      <PagespeedSection
        page={page}
        pagespeedDetailHref={props.pagespeedDetailHref}
      />

      <section className="space-y-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
        <h2 className="text-sm font-medium">URL optimization</h2>
        <PageOptimizePanel
          accountId={props.accountId}
          projectId={props.projectId}
          sourceUrl={page.url}
          country={props.country}
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Recommendations</h2>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {page.recommendations.length} item
            {page.recommendations.length === 1 ? '' : 's'} — specific to this
            page
          </p>
        </div>

        {page.recommendations.length === 0 ? (
          <p className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4 text-sm text-[var(--workspace-shell-text-muted)]">
            No issues found from the latest crawl and PageSpeed scans.
          </p>
        ) : (
          <div className="space-y-2">
            {page.recommendations.map((rec) => (
              <RecommendationRow key={rec.id} recommendation={rec} />
            ))}
          </div>
        )}
      </section>

      <Link
        href={props.backHref}
        className="inline-block text-sm text-[var(--workspace-shell-text-muted)] underline-offset-4 hover:underline"
      >
        ← Back to all pages
      </Link>
    </div>
  );
}
