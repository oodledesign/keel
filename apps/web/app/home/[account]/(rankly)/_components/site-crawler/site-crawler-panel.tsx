'use client';

import { useMemo, useState } from 'react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { analyzeCrawlAccess } from '~/lib/crawl/access-summary';
import type {
  SiteCrawlIssueCode,
  SiteCrawlIssueSummary,
  SiteCrawlJobRow,
  SiteCrawlPageRow,
} from '~/lib/site-crawl/types';
import {
  SITE_CRAWL_ISSUE_LABELS,
  SITE_CRAWL_URL_LIMIT_OPTIONS,
} from '~/lib/site-crawl/types';

import { CrawlAccessBanner } from '../crawl-access-banner';
import { SiteCrawlJobPoller } from './site-crawl-job-poller';

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

function statusTone(code: number): string {
  if (code >= 200 && code < 300) return 'text-[var(--ozer-accent)]';
  if (code >= 300 && code < 400) return 'text-amber-400';
  return 'text-red-400';
}

function IssueBadge({ code }: { code: SiteCrawlIssueCode }) {
  return (
    <span className="inline-flex rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-200">
      {SITE_CRAWL_ISSUE_LABELS[code]}
    </span>
  );
}

function SchemaTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-200">
      {type}
    </span>
  );
}

function SchemaDetailDialog(props: {
  page: SiteCrawlPageRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const objects = props.page?.schema_objects ?? [];
  const types = props.page?.schema_types ?? [];
  const schemaIssues = (props.page?.issues ?? []).filter((issue) =>
    [
      'malformed_schema',
      'missing_schema',
      'schema_missing_type',
      'schema_incomplete',
    ].includes(issue.code),
  );

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <DialogHeader>
          <DialogTitle>Structured data</DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">
            {props.page?.url}
          </DialogDescription>
        </DialogHeader>

        {schemaIssues.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-sm font-medium text-amber-100">Schema issues</p>
            <ul className="space-y-1 text-xs text-amber-100/90">
              {schemaIssues.map((issue) => (
                <li key={`${issue.code}-${issue.message}`}>
                  {SITE_CRAWL_ISSUE_LABELS[issue.code]}: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {types.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {types.map((type) => (
              <SchemaTypeBadge key={type} type={type} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No JSON-LD found on this page.
          </p>
        )}

        {objects.length > 0 ? (
          <div className="space-y-3">
            {objects.map((object, index) => (
              <pre
                key={`${props.page?.id}-schema-${index}`}
                className="overflow-x-auto rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/30 p-3 text-xs leading-relaxed"
              >
                {JSON.stringify(object, null, 2)}
              </pre>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard(props: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <p className="text-muted-foreground text-xs tracking-wide uppercase">
        {props.label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{props.value}</p>
      {props.hint ? (
        <p className="text-muted-foreground mt-1 text-xs">{props.hint}</p>
      ) : null}
    </div>
  );
}

export function SiteCrawlerPanel(props: {
  accountId: string;
  projectId: string;
  domain: string;
  latestJob: SiteCrawlJobRow | null;
  pages: SiteCrawlPageRow[];
  defaultUrlLimit: number;
}) {
  const [urlLimit, setUrlLimit] = useState(props.defaultUrlLimit);
  const [starting, setStarting] = useState(false);
  const [issueFilter, setIssueFilter] = useState<SiteCrawlIssueCode | 'all'>(
    'all',
  );
  const [schemaPage, setSchemaPage] = useState<SiteCrawlPageRow | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(
    props.latestJob &&
      (props.latestJob.status === 'pending' ||
        props.latestJob.status === 'running')
      ? props.latestJob.id
      : null,
  );

  const summary: SiteCrawlIssueSummary = props.latestJob?.issue_summary ?? {};

  const filteredPages = useMemo(() => {
    if (issueFilter === 'all') return props.pages;
    return props.pages.filter((page) =>
      page.issues.some((issue) => issue.code === issueFilter),
    );
  }, [issueFilter, props.pages]);

  const startCrawl = async () => {
    setStarting(true);
    try {
      const res = await fetch('/api/rankly/site-crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          accountId: props.accountId,
          urlLimit,
        }),
      });
      const json = (await res.json()) as ApiResponse<{
        jobId: string;
        alreadyRunning: boolean;
      }>;
      if (!json.ok) throw new Error(json.error.message);

      setActiveJobId(json.data.jobId);
      if (json.data.alreadyRunning) {
        toast.message('Resuming site crawl…');
      } else {
        toast.success('Site crawl started');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  const exportCsv = () => {
    if (!props.latestJob?.id) return;
    window.location.href = `/api/rankly/site-crawl/export/${props.latestJob.id}`;
  };

  const topIssues = Object.entries(summary)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6) as Array<[SiteCrawlIssueCode, number]>;

  const pagesWithSchema = props.pages.filter(
    (page) => (page.schema_types ?? []).length > 0,
  ).length;

  const crawlAccess = analyzeCrawlAccess(
    props.pages.map((page) => ({
      url: page.url,
      statusCode: page.status_code,
      wordCount: page.word_count,
      crawlFailed: Boolean(page.crawl_error),
    })),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Label htmlFor="crawl-limit">URL limit</Label>
          <select
            id="crawl-limit"
            value={urlLimit}
            onChange={(event) => setUrlLimit(Number(event.target.value))}
            className="rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2 text-sm"
            disabled={Boolean(activeJobId)}
          >
            {SITE_CRAWL_URL_LIMIT_OPTIONS.map((limit) => (
              <option key={limit} value={limit}>
                {limit.toLocaleString()} URLs
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {props.latestJob?.status === 'done' ? (
            <Button type="button" variant="outline" onClick={exportCsv}>
              Export CSV
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={starting || Boolean(activeJobId)}
            onClick={startCrawl}
          >
            {starting
              ? 'Starting…'
              : activeJobId
                ? 'Crawl in progress…'
                : props.latestJob
                  ? 'Run new crawl'
                  : 'Start site crawl'}
          </Button>
        </div>
      </div>

      {activeJobId ? (
        <SiteCrawlJobPoller
          jobId={activeJobId}
          onComplete={() => setActiveJobId(null)}
        />
      ) : null}

      <CrawlAccessBanner summary={crawlAccess} />

      {props.latestJob?.status === 'done' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              label="Pages crawled"
              value={props.latestJob.urls_crawled}
            />
            <SummaryCard
              label="With schema"
              value={pagesWithSchema}
              hint="Pages with JSON-LD"
            />
            <SummaryCard
              label="Non-200 pages"
              value={summary.non_200_status ?? 0}
            />
            <SummaryCard
              label="Missing titles"
              value={summary.missing_title ?? 0}
            />
            <SummaryCard
              label="Duplicate titles"
              value={summary.duplicate_title ?? 0}
            />
          </div>

          {topIssues.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIssueFilter('all')}
                className={
                  issueFilter === 'all'
                    ? 'rounded-full bg-[var(--ozer-accent-subtle)] px-3 py-1 text-xs text-[var(--ozer-accent)]'
                    : 'text-muted-foreground rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-3 py-1 text-xs hover:bg-[var(--workspace-shell-sidebar-accent)]'
                }
              >
                All pages ({props.pages.length})
              </button>
              {topIssues.map(([code, count]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setIssueFilter(code)}
                  className={
                    issueFilter === code
                      ? 'rounded-full bg-[var(--ozer-accent-subtle)] px-3 py-1 text-xs text-[var(--ozer-accent)]'
                      : 'text-muted-foreground rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-3 py-1 text-xs hover:bg-[var(--workspace-shell-sidebar-accent)]'
                  }
                >
                  {SITE_CRAWL_ISSUE_LABELS[code]} ({count})
                </button>
              ))}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-[color:var(--workspace-shell-border)]">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="text-muted-foreground border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-xs tracking-wide uppercase">
                <tr>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">H1</th>
                  <th className="px-4 py-3">Schema</th>
                  <th className="px-4 py-3">Words</th>
                  <th className="px-4 py-3">Issues</th>
                </tr>
              </thead>
              <tbody>
                {filteredPages.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-muted-foreground px-4 py-8 text-center"
                    >
                      No pages match this filter.
                    </td>
                  </tr>
                ) : (
                  filteredPages.map((page) => {
                    const schemaTypes = page.schema_types ?? [];

                    return (
                      <tr
                        key={page.id}
                        className="border-b border-[color:var(--workspace-shell-border)] align-top last:border-0"
                      >
                        <td className="max-w-xs px-4 py-3">
                          <p className="truncate font-mono text-xs">
                            {page.url}
                          </p>
                        </td>
                        <td
                          className={`px-4 py-3 tabular-nums ${statusTone(page.status_code)}`}
                        >
                          {page.status_code || '—'}
                        </td>
                        <td className="max-w-xs px-4 py-3">
                          <p className="truncate">{page.title || '—'}</p>
                        </td>
                        <td className="max-w-[10rem] truncate px-4 py-3">
                          {page.h1 || '—'}
                        </td>
                        <td className="max-w-[14rem] px-4 py-3">
                          {schemaTypes.length === 0 ? (
                            <div className="space-y-2">
                              <span className="text-muted-foreground text-xs">
                                —
                              </span>
                              {page.issues.some((issue) =>
                                [
                                  'malformed_schema',
                                  'missing_schema',
                                  'schema_missing_type',
                                  'schema_incomplete',
                                ].includes(issue.code),
                              ) ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => setSchemaPage(page)}
                                >
                                  View schema issues
                                </Button>
                              ) : null}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-1">
                                {schemaTypes.slice(0, 3).map((type) => (
                                  <SchemaTypeBadge key={type} type={type} />
                                ))}
                                {schemaTypes.length > 3 ? (
                                  <span className="text-muted-foreground text-xs">
                                    +{schemaTypes.length - 3}
                                  </span>
                                ) : null}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setSchemaPage(page)}
                              >
                                {page.issues.some((issue) =>
                                  [
                                    'malformed_schema',
                                    'missing_schema',
                                    'schema_missing_type',
                                    'schema_incomplete',
                                  ].includes(issue.code),
                                )
                                  ? 'View issues & JSON-LD'
                                  : 'View JSON-LD'}
                              </Button>
                            </div>
                          )}
                        </td>
                        <td className="text-muted-foreground px-4 py-3 tabular-nums">
                          {page.word_count.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {page.issues.length === 0 ? (
                              <span className="text-muted-foreground text-xs">
                                —
                              </span>
                            ) : (
                              page.issues.map((issue) => (
                                <IssueBadge
                                  key={`${page.id}-${issue.code}`}
                                  code={issue.code}
                                />
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <SchemaDetailDialog
            page={schemaPage}
            open={schemaPage != null}
            onOpenChange={(open) => {
              if (!open) setSchemaPage(null);
            }}
          />

          <p className="text-muted-foreground text-xs">
            Last crawl{' '}
            {new Date(
              props.latestJob.finished_at ?? props.latestJob.created_at,
            ).toLocaleString()}
            {' · '}
            {props.domain}
          </p>
        </>
      ) : !activeJobId ? (
        <p className="text-muted-foreground rounded-lg border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center text-sm">
          Crawl {props.domain} to find broken links, missing titles, duplicate
          meta tags, and other on-page SEO issues — up to{' '}
          {urlLimit.toLocaleString()} internal URLs.
        </p>
      ) : null}
    </div>
  );
}
