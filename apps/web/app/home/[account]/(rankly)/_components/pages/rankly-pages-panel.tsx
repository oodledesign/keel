'use client';

import Link from 'next/link';

import { scoreTone } from '~/lib/rankly-pages/score';
import type { RanklyPageSummary } from '~/lib/rankly-pages/types';
import { PAGE_SCORE_LABELS } from '~/lib/rankly-pages/types';
import { pageDisplayPath } from '~/lib/rankly-pages/url';

import { ranklyPagesDetailPath } from '../../_lib/rankly-project-paths';

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

function ScoreMini(props: { label: string; score: number | null }) {
  return (
    <div className="text-center">
      <p className="text-muted-foreground text-[10px] uppercase">
        {props.label}
      </p>
      <p
        className={`text-sm font-medium tabular-nums ${scoreTone(props.score)}`}
      >
        {formatScore(props.score)}
      </p>
    </div>
  );
}

function DataSourceBadge(props: { label: string; active: boolean }) {
  return (
    <span
      className={
        props.active
          ? 'inline-flex rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[10px] text-[var(--workspace-shell-text)]/90 uppercase'
          : 'text-muted-foreground/60 inline-flex rounded-full border border-[color:var(--workspace-shell-border)] px-2 py-0.5 text-[10px] uppercase'
      }
    >
      {props.label}
    </span>
  );
}

function PageRow(props: {
  account: string;
  projectId: string;
  page: RanklyPageSummary;
}) {
  const href = ranklyPagesDetailPath(
    props.account,
    props.projectId,
    props.page.pageKey,
  );

  return (
    <tr className="border-t border-[color:var(--workspace-shell-border)] hover:bg-[var(--workspace-shell-sidebar-accent)]">
      <td className="px-4 py-3">
        <Link href={href} className="group block min-w-0">
          <p className="font-medium group-hover:text-[var(--ozer-accent)]">
            {props.page.label}
            {props.page.isHomepage ? (
              <span className="text-muted-foreground ml-2 text-[10px] uppercase">
                Homepage
              </span>
            ) : null}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {pageDisplayPath(props.page.url)}
          </p>
        </Link>
      </td>
      <td className="px-4 py-3 text-center">
        <Link href={href} className="inline-block">
          <span
            className={`text-2xl font-semibold tabular-nums ${scoreTone(props.page.scores.overall)}`}
          >
            {formatScore(props.page.scores.overall)}
          </span>
          {props.page.scores.overall != null ? (
            <span className="text-muted-foreground text-xs"> /100</span>
          ) : null}
        </Link>
      </td>
      <td className="hidden px-4 py-3 lg:table-cell">
        <div className="grid grid-cols-4 gap-2">
          <ScoreMini label="SEO" score={props.page.scores.onPage} />
          <ScoreMini label="Perf" score={props.page.scores.performance} />
          <ScoreMini label="Tech" score={props.page.scores.technical} />
          <ScoreMini label="Schema" score={props.page.scores.schema} />
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {props.page.recommendationCount > 0 ? (
          <span className="text-amber-300">
            {props.page.recommendationCount}
          </span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <div className="flex flex-wrap gap-1">
          <DataSourceBadge label="Crawl" active={props.page.hasCrawlData} />
          <DataSourceBadge label="PSI" active={props.page.hasPagespeedData} />
        </div>
      </td>
      <td className="text-muted-foreground hidden px-4 py-3 text-xs xl:table-cell">
        {formatDate(props.page.lastUpdatedAt) ?? '—'}
      </td>
    </tr>
  );
}

export function RanklyPagesPanel(props: {
  account: string;
  projectId: string;
  pages: RanklyPageSummary[];
  meta: {
    pageCount: number;
    crawlJobDone: boolean;
    hasPagespeed: boolean;
  };
  siteCrawlerHref: string;
  pagespeedHref: string;
}) {
  const scoredPages = props.pages.filter((page) => page.scores.overall != null);
  const avgScore =
    scoredPages.length > 0
      ? Math.round(
          scoredPages.reduce(
            (sum, page) => sum + (page.scores.overall ?? 0),
            0,
          ) / scoredPages.length,
        )
      : null;

  if (props.pages.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          No page data yet. Run a{' '}
          <Link
            href={props.siteCrawlerHref}
            className="text-[var(--ozer-accent)] underline-offset-4 hover:underline"
          >
            site crawl
          </Link>{' '}
          or add URLs in{' '}
          <Link
            href={props.pagespeedHref}
            className="text-[var(--ozer-accent)] underline-offset-4 hover:underline"
          >
            PageSpeed
          </Link>{' '}
          to build your page inventory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Pages with data
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {props.meta.pageCount}
          </p>
        </div>
        <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Average score
          </p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${scoreTone(avgScore)}`}
          >
            {formatScore(avgScore)}
            {avgScore != null ? (
              <span className="text-muted-foreground text-sm font-normal">
                {' '}
                /100
              </span>
            ) : null}
          </p>
        </div>
        <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Data sources
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <DataSourceBadge
              label="Site crawl"
              active={props.meta.crawlJobDone}
            />
            <DataSourceBadge
              label="PageSpeed"
              active={props.meta.hasPagespeed}
            />
          </div>
        </div>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Scores combine on-page SEO (40%), performance (35%), technical health
        (15%), and structured data (10%) from your latest crawl and PageSpeed
        scans. Recommendations on each page are tailored to that URL&apos;s
        actual title, meta, headings, and Lighthouse metrics.
      </p>

      <div className="overflow-x-auto rounded-lg border border-[color:var(--workspace-shell-border)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-muted-foreground bg-black/30 text-left text-xs tracking-wide uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Page</th>
              <th className="px-4 py-3 text-center font-medium">Score</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">
                Breakdown
              </th>
              <th className="px-4 py-3 text-right font-medium">Fixes</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                Sources
              </th>
              <th className="hidden px-4 py-3 font-medium xl:table-cell">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {props.pages.map((page) => (
              <PageRow
                key={page.pageKey}
                account={props.account}
                projectId={props.projectId}
                page={page}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-muted-foreground hidden text-[10px] uppercase lg:grid lg:grid-cols-4 lg:gap-2 lg:px-4">
        {Object.values(PAGE_SCORE_LABELS).map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}
