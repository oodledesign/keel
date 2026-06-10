'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import type {
  PagespeedCheckJobRow,
  PagespeedRefreshInterval,
  PagespeedSettings,
  PagespeedSnapshot,
} from '~/lib/pagespeed/types';
import { PAGESPEED_REFRESH_INTERVAL_LABELS } from '~/lib/pagespeed/types';

import { ranklyPagespeedPagePath } from '../../_lib/rankly-project-paths';
import {
  addPagespeedPage,
  deletePagespeedPageAction,
} from '../../_lib/server/rankly-module-actions';
import { PagespeedJobPoller } from './pagespeed-job-poller';

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

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

function formatScanDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function issueCount(metrics: PagespeedSnapshot['mobile']): number {
  if (!metrics || metrics.errorMsg) return 0;
  return metrics.recommendations.length;
}

function MetricCell({
  label,
  metrics,
}: {
  label: string;
  metrics: PagespeedSnapshot['mobile'];
}) {
  if (!metrics) {
    return (
      <td colSpan={5} className="px-4 py-3 text-muted-foreground">
        {label}: not checked yet
      </td>
    );
  }

  if (metrics.errorMsg) {
    return (
      <td colSpan={5} className="px-4 py-3 text-xs text-red-400">
        {label}: {metrics.errorMsg}
      </td>
    );
  }

  return (
    <>
      <td className={`px-4 py-3 text-right font-medium tabular-nums ${scoreTone(metrics.performanceScore)}`}>
        {formatScore(metrics.performanceScore)}
      </td>
      <td className={`px-4 py-3 text-right tabular-nums ${scoreTone(metrics.accessibilityScore)}`}>
        {formatScore(metrics.accessibilityScore)}
      </td>
      <td className={`px-4 py-3 text-right tabular-nums ${scoreTone(metrics.bestPracticesScore)}`}>
        {formatScore(metrics.bestPracticesScore)}
      </td>
      <td className={`px-4 py-3 text-right tabular-nums ${scoreTone(metrics.seoScore)}`}>
        {formatScore(metrics.seoScore)}
      </td>
      <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground">
        LCP {formatMs(metrics.lcpMs)}
      </td>
    </>
  );
}

export function PagespeedPanel(props: {
  account: string;
  accountId: string;
  projectId: string;
  domain: string;
  settings: PagespeedSettings | null;
  snapshots: PagespeedSnapshot[];
  latestJob: PagespeedCheckJobRow | null;
}) {
  const router = useRouter();
  const [interval, setInterval] = useState<PagespeedRefreshInterval>(
    props.settings?.refreshInterval ?? 'weekly',
  );
  const [savingInterval, setSavingInterval] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pageUrl, setPageUrl] = useState('');
  const [pageLabel, setPageLabel] = useState('');
  const [addingPage, setAddingPage] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(
    props.latestJob &&
      (props.latestJob.status === 'pending' ||
        props.latestJob.status === 'running')
      ? props.latestJob.id
      : null,
  );

  const saveInterval = async () => {
    setSavingInterval(true);
    try {
      const res = await fetch('/api/rankly/pagespeed', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          accountId: props.accountId,
          pagespeedRefreshInterval: interval,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ settings: PagespeedSettings }>;
      if (!json.ok) throw new Error(json.error.message);
      toast.success('PageSpeed schedule updated');
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingInterval(false);
    }
  };

  const refreshPagespeed = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/rankly/pagespeed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          accountId: props.accountId,
        }),
      });
      const json = (await res.json()) as ApiResponse<{
        jobId: string;
        alreadyRunning: boolean;
      }>;
      if (!json.ok) throw new Error(json.error.message);

      setActiveJobId(json.data.jobId);
      if (json.data.alreadyRunning) {
        toast.message('PageSpeed check already in progress');
      } else {
        toast.success('PageSpeed check started');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  const addPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageUrl.trim()) {
      toast.error('Enter a URL or path');
      return;
    }

    setAddingPage(true);
    try {
      await addPagespeedPage({
        accountId: props.accountId,
        projectId: props.projectId,
        url: pageUrl.trim(),
        label: pageLabel.trim() || null,
      });
      toast.success('Page added');
      setPageUrl('');
      setPageLabel('');
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAddingPage(false);
    }
  };

  const removePage = async (pageId: string) => {
    setDeletingId(pageId);
    try {
      await deletePagespeedPageAction({
        accountId: props.accountId,
        pageId,
      });
      toast.success('Page removed');
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {props.settings?.lastCheckAt ? (
        <p className="text-muted-foreground text-sm">
          Last scan{' '}
          <time dateTime={props.settings.lastCheckAt} className="text-white">
            {formatScanDate(props.settings.lastCheckAt)}
          </time>
          {props.settings.nextCheckAt && interval !== 'manual' ? (
            <>
              {' '}
              · Next scan{' '}
              <time dateTime={props.settings.nextCheckAt}>
                {new Date(props.settings.nextCheckAt).toLocaleDateString()}
              </time>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="pagespeed-refresh-interval">Auto refresh</Label>
          <select
            id="pagespeed-refresh-interval"
            value={interval}
            onChange={(e) =>
              setInterval(e.target.value as PagespeedRefreshInterval)
            }
            className="border-input bg-background flex h-10 w-full max-w-xs rounded-md border px-3 py-2 text-sm"
          >
            {(
              Object.keys(PAGESPEED_REFRESH_INTERVAL_LABELS) as PagespeedRefreshInterval[]
            ).map((value) => (
              <option key={value} value={value}>
                {PAGESPEED_REFRESH_INTERVAL_LABELS[value]}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            {props.settings?.lastCheckAt
              ? `Project last checked ${formatScanDate(props.settings.lastCheckAt)}`
              : 'Not checked yet'}
            {props.settings?.nextCheckAt && interval !== 'manual'
              ? ` · Next ${new Date(props.settings.nextCheckAt).toLocaleDateString()}`
              : null}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={
              savingInterval || interval === props.settings?.refreshInterval
            }
            onClick={saveInterval}
          >
            {savingInterval ? 'Saving…' : 'Save schedule'}
          </Button>
          <Button
            type="button"
            disabled={refreshing || Boolean(activeJobId)}
            onClick={refreshPagespeed}
          >
            {refreshing ? 'Starting…' : 'Run PageSpeed now'}
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm">
        Homepage is tracked automatically for <strong className="text-white">{props.domain}</strong>{' '}
        on desktop and mobile. Scores are from Google PageSpeed Insights (0–100).
        Open a page to view score history and Lighthouse fix recommendations.
      </p>

      {activeJobId ? (
        <PagespeedJobPoller
          jobId={activeJobId}
          onComplete={() => setActiveJobId(null)}
        />
      ) : null}

      <form onSubmit={addPage} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="pagespeed-url">Add page to track</Label>
          <Input
            id="pagespeed-url"
            value={pageUrl}
            onChange={(e) => setPageUrl(e.target.value)}
            placeholder={`/pricing or https://${props.domain.replace(/^https?:\/\//, '')}/about`}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pagespeed-label">Label (optional)</Label>
          <Input
            id="pagespeed-label"
            value={pageLabel}
            onChange={(e) => setPageLabel(e.target.value)}
            placeholder="Pricing"
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={addingPage || !pageUrl.trim()}>
          {addingPage ? 'Adding…' : 'Add page'}
        </Button>
      </form>

      {props.snapshots.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-white/10 bg-black/10 px-4 py-6 text-sm">
          No pages yet. Run PageSpeed to fetch scores.
        </p>
      ) : (
        <div className="space-y-6">
          {props.snapshots.map((page) => {
            const detailHref = ranklyPagespeedPagePath(
              props.account,
              props.projectId,
              page.pageId,
            );
            const fixes =
              issueCount(page.mobile) + issueCount(page.desktop);

            return (
              <div
                key={page.pageId}
                className="overflow-x-auto rounded-lg border border-white/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/20 px-4 py-3">
                  <div>
                    <p className="font-medium">
                      {page.label ?? page.url}
                      {page.isHomepage ? (
                        <span className="text-muted-foreground ml-2 text-xs uppercase">
                          Homepage
                        </span>
                      ) : null}
                    </p>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-primary text-xs underline-offset-4 hover:underline"
                    >
                      {page.url.replace(/^https?:\/\//, '')}
                    </a>
                    {page.lastScannedAt ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        Last scanned{' '}
                        <time dateTime={page.lastScannedAt}>
                          {formatScanDate(page.lastScannedAt)}
                        </time>
                      </p>
                    ) : (
                      <p className="text-muted-foreground mt-1 text-xs">
                        Not scanned yet
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link href={detailHref}>
                        History & fixes
                        {fixes > 0 ? ` (${fixes})` : ''}
                      </Link>
                    </Button>
                    {!page.isHomepage ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={deletingId === page.pageId}
                        onClick={() => removePage(page.pageId)}
                      >
                        {deletingId === page.pageId ? '…' : 'Remove'}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Device</th>
                      <th className="px-4 py-2 text-right">Perf</th>
                      <th className="px-4 py-2 text-right">A11y</th>
                      <th className="px-4 py-2 text-right">Best</th>
                      <th className="px-4 py-2 text-right">SEO</th>
                      <th className="px-4 py-2 text-right">CWV</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/5">
                      <td className="px-4 py-3 text-muted-foreground">Mobile</td>
                      <MetricCell label="Mobile" metrics={page.mobile} />
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-muted-foreground">Desktop</td>
                      <MetricCell label="Desktop" metrics={page.desktop} />
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
