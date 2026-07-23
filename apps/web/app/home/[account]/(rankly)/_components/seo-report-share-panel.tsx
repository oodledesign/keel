'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  Check,
  CheckCircle2,
  CircleDashed,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  Gauge,
  Globe2,
  Loader2,
  Radar,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { copyTextToClipboard } from '~/lib/clipboard';
import { buildSeoReportPdfUrl } from '~/lib/rankly-seo-report/public-url';
import { SEO_REPORT_SITE_CRAWL_URL_LIMIT } from '~/lib/site-crawl/types';

type ReportSummary = {
  id: string;
  title: string;
  targetDomain: string;
  createdAt: string;
  publicShareEnabled: boolean;
  publicUrl: string | null;
  token?: string | null;
  overallScore: number | null;
};

type ApiOk<T> = { ok: true; data: T };
type ApiFail = { ok: false; error: { message: string } };
type ApiResponse<T> = ApiOk<T> | ApiFail;

type StepKey =
  | 'siteExplorer'
  | 'pagespeed'
  | 'siteCrawl'
  | 'aiAudit'
  | 'report';

type StepState = 'idle' | 'running' | 'done' | 'error';

type StepStatus = {
  state: StepState;
  detail?: string | null;
};

const STEP_ORDER: StepKey[] = [
  'siteExplorer',
  'pagespeed',
  'siteCrawl',
  'aiAudit',
  'report',
];

const STEP_LABELS: Record<StepKey, string> = {
  siteExplorer: 'Site Explorer',
  pagespeed: 'PageSpeed',
  siteCrawl: 'Site Crawler',
  aiAudit: 'AI Search Audit',
  report: 'Client report',
};

const STEP_HINTS: Record<StepKey, string> = {
  siteExplorer: 'Overview & authority signals',
  pagespeed: 'Core Web Vitals',
  siteCrawl: 'On-page & technical crawl',
  aiAudit: 'AI citation readiness',
  report: 'Public link + PDF',
};

const STEP_ICONS = {
  siteExplorer: Globe2,
  pagespeed: Gauge,
  siteCrawl: Radar,
  aiAudit: Sparkles,
  report: FileText,
} as const;

const INITIAL_STEPS: Record<StepKey, StepStatus> = {
  siteExplorer: { state: 'idle' },
  pagespeed: { state: 'idle' },
  siteCrawl: { state: 'idle' },
  aiAudit: { state: 'idle' },
  report: { state: 'idle' },
};

const POLL_MS = 5000;
/** Site crawls and AI audits can take a long time on larger sites. */
const MAX_WAIT_MS = 90 * 60 * 1000;
const MAX_WAIT_MINUTES = Math.round(MAX_WAIT_MS / 60_000);

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function readJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.ok) throw new Error(json.error.message);
  return json.data;
}

function stepStatusCopy(state: StepState): string {
  switch (state) {
    case 'idle':
      return 'Waiting';
    case 'running':
      return 'Processing';
    case 'done':
      return 'Done';
    case 'error':
      return 'Failed';
  }
}

function ReportStepCard(props: { stepKey: StepKey; status: StepStatus }) {
  const Icon = STEP_ICONS[props.stepKey];
  const { state, detail } = props.status;

  return (
    <li
      className={cn(
        'relative overflow-hidden rounded-lg border px-3 py-3 transition-[border-color,background-color,box-shadow,opacity] duration-300',
        state === 'idle' &&
          'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/40 opacity-80',
        state === 'running' &&
          'border-[color-mix(in_srgb,var(--ozer-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--ozer-accent)_12%,transparent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--ozer-accent)_20%,transparent)]',
        state === 'done' &&
          'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]',
        state === 'error' && 'border-destructive/40 bg-destructive/10',
      )}
    >
      {state === 'running' ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-[color-mix(in_srgb,var(--ozer-accent)_35%,transparent)]"
        >
          <span className="absolute inset-y-0 w-full animate-pulse bg-[var(--ozer-accent)]" />
        </span>
      ) : null}

      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            state === 'idle' &&
              'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
            state === 'running' &&
              'bg-[color-mix(in_srgb,var(--ozer-accent)_18%,transparent)] text-[var(--ozer-accent)]',
            state === 'done' &&
              'bg-[color-mix(in_srgb,var(--ozer-accent)_14%,transparent)] text-[var(--ozer-accent)]',
            state === 'error' && 'bg-destructive/15 text-destructive',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            {STEP_LABELS[props.stepKey]}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--workspace-shell-text-muted)]">
            {STEP_HINTS[props.stepKey]}
          </p>

          <div className="mt-2.5 flex items-center gap-1.5">
            {state === 'idle' ? (
              <CircleDashed
                className="h-3.5 w-3.5 text-[var(--workspace-shell-text-muted)]"
                aria-hidden
              />
            ) : null}
            {state === 'running' ? (
              <Loader2
                className="h-3.5 w-3.5 animate-spin text-[var(--ozer-accent)]"
                aria-hidden
              />
            ) : null}
            {state === 'done' ? (
              <CheckCircle2
                className="h-3.5 w-3.5 text-[var(--ozer-accent)]"
                aria-hidden
              />
            ) : null}
            {state === 'error' ? (
              <XCircle className="text-destructive h-3.5 w-3.5" aria-hidden />
            ) : null}
            <span
              className={cn(
                'text-xs font-medium',
                state === 'idle' && 'text-[var(--workspace-shell-text-muted)]',
                state === 'running' && 'text-[var(--ozer-accent)]',
                state === 'done' && 'text-[var(--workspace-shell-text)]',
                state === 'error' && 'text-destructive',
              )}
            >
              {stepStatusCopy(state)}
              {state === 'running' ? '…' : null}
            </span>
          </div>

          {detail && (state === 'error' || state === 'running') ? (
            <p
              className={cn(
                'mt-1.5 line-clamp-3 text-xs leading-snug',
                state === 'error'
                  ? 'text-destructive'
                  : 'text-[var(--workspace-shell-text-muted)]',
              )}
            >
              {detail}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function SeoReportSharePanel(props: {
  accountId: string;
  projectId: string;
  targetDomain: string;
  compact?: boolean;
}) {
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [building, setBuilding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [steps, setSteps] =
    useState<Record<StepKey, StepStatus>>(INITIAL_STEPS);

  const setStep = useCallback(
    (key: StepKey, state: StepState, detail?: string | null) => {
      setSteps((prev) => ({
        ...prev,
        [key]: { state, detail: detail ?? null },
      }));
    },
    [],
  );

  const loadLatest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/rankly/seo-report?projectId=${encodeURIComponent(props.projectId)}`,
      );
      const data = await readJson<{ report: ReportSummary | null }>(res);
      setReport(data.report);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [props.projectId]);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  const generateReport = useCallback(async () => {
    const res = await fetch('/api/rankly/seo-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: props.projectId,
        accountId: props.accountId,
        enableShare: true,
      }),
    });
    return readJson<ReportSummary>(res);
  }, [props.accountId, props.projectId]);

  const generateOnly = useCallback(async () => {
    setGenerating(true);
    setSteps({
      ...INITIAL_STEPS,
      report: { state: 'running' },
    });
    try {
      const next = await generateReport();
      setReport(next);
      setStep('report', 'done');
      toast.success('Client SEO report ready');
    } catch (error) {
      setStep('report', 'error', getErrorMessage(error));
      toast.error(getErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  }, [generateReport, setStep]);

  const pollJob = useCallback(
    async (
      url: string,
      label: string,
      isDone: (data: unknown) => boolean,
      isError: (data: unknown) => boolean,
      getErrorMessageFromData?: (data: unknown) => string | null,
      onProgress?: (data: unknown) => void,
    ) => {
      const started = Date.now();
      while (Date.now() - started < MAX_WAIT_MS) {
        await sleep(POLL_MS);
        const res = await fetch(url);
        const data = await readJson<unknown>(res);
        onProgress?.(data);
        if (isError(data)) {
          throw new Error(getErrorMessageFromData?.(data) || `${label} failed`);
        }
        if (isDone(data)) return data;
      }
      throw new Error(
        `${label} is still running after ${MAX_WAIT_MINUTES} minutes — try Snapshot now once it finishes`,
      );
    },
    [],
  );

  const buildFullReport = useCallback(async () => {
    setBuilding(true);
    setSteps({
      siteExplorer: { state: 'idle' },
      pagespeed: { state: 'idle' },
      siteCrawl: { state: 'idle' },
      aiAudit: { state: 'idle' },
      report: { state: 'idle' },
    });

    const body = {
      projectId: props.projectId,
      accountId: props.accountId,
    };

    const jobErrorMessage = (data: unknown) => {
      const job = (data as { job?: { error?: string | null } }).job;
      return job?.error?.trim() || null;
    };

    try {
      const results = await Promise.allSettled([
        (async () => {
          try {
            setStep('siteExplorer', 'running');
            const res = await fetch('/api/rankly/site-overview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...body, force: true }),
            });
            await readJson(res);
            setStep('siteExplorer', 'done');
          } catch (error) {
            setStep('siteExplorer', 'error', getErrorMessage(error));
            throw error;
          }
        })(),
        (async () => {
          try {
            setStep('pagespeed', 'running');
            const res = await fetch('/api/rankly/pagespeed', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            const started = await readJson<{ jobId: string }>(res);
            await pollJob(
              `/api/rankly/pagespeed/${started.jobId}`,
              'PageSpeed',
              (data) => {
                const status = (data as { job?: { status?: string } }).job
                  ?.status;
                return status === 'done';
              },
              (data) => {
                const status = (data as { job?: { status?: string } }).job
                  ?.status;
                return status === 'error';
              },
              jobErrorMessage,
            );
            setStep('pagespeed', 'done');
          } catch (error) {
            setStep('pagespeed', 'error', getErrorMessage(error));
            throw error;
          }
        })(),
        (async () => {
          try {
            setStep('siteCrawl', 'running');
            let lastCrawled = 0;
            let lastLimit = SEO_REPORT_SITE_CRAWL_URL_LIMIT;
            const res = await fetch('/api/rankly/site-crawl', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...body,
                urlLimit: SEO_REPORT_SITE_CRAWL_URL_LIMIT,
              }),
            });
            const started = await readJson<{ jobId: string }>(res);
            try {
              await pollJob(
                `/api/rankly/site-crawl/${started.jobId}`,
                'Site Crawler',
                (data) => {
                  const status = (data as { job?: { status?: string } }).job
                    ?.status;
                  return status === 'done';
                },
                (data) => {
                  const status = (data as { job?: { status?: string } }).job
                    ?.status;
                  return status === 'error';
                },
                jobErrorMessage,
                (data) => {
                  const job = (
                    data as {
                      job?: {
                        urls_crawled?: number;
                        url_limit?: number;
                        status?: string;
                      };
                    }
                  ).job;
                  if (!job) return;
                  lastCrawled = job.urls_crawled ?? 0;
                  lastLimit = job.url_limit ?? lastLimit;
                  setStep(
                    'siteCrawl',
                    'running',
                    lastLimit > 0
                      ? `${lastCrawled}/${lastLimit} pages`
                      : `${lastCrawled} pages crawled`,
                  );
                },
              );
              setStep('siteCrawl', 'done');
            } catch (error) {
              // Partial crawl is still useful for the report; keep going.
              if (lastCrawled > 0) {
                setStep(
                  'siteCrawl',
                  'done',
                  `${lastCrawled}/${lastLimit} pages (partial)`,
                );
                toast.message(
                  `Site crawl still running in the background (${lastCrawled} pages so far). Report will use what’s ready.`,
                );
                return;
              }
              throw error;
            }
          } catch (error) {
            setStep('siteCrawl', 'error', getErrorMessage(error));
            throw error;
          }
        })(),
        (async () => {
          try {
            setStep('aiAudit', 'running');
            const res = await fetch('/api/rankly/ai-audit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...body,
                targetDomain: props.targetDomain,
              }),
            });
            const started = await readJson<{ jobId: string }>(res);
            await pollJob(
              `/api/rankly/ai-audit/${started.jobId}`,
              'AI Search Audit',
              (data) => {
                const status = (data as { job?: { status?: string } }).job
                  ?.status;
                return status === 'done';
              },
              (data) => {
                const status = (data as { job?: { status?: string } }).job
                  ?.status;
                return status === 'error';
              },
              jobErrorMessage,
            );
            setStep('aiAudit', 'done');
          } catch (error) {
            setStep('aiAudit', 'error', getErrorMessage(error));
            throw error;
          }
        })(),
      ]);

      const failed = results
        .map((result, index) => {
          if (result.status !== 'rejected') return null;
          const keys: StepKey[] = [
            'siteExplorer',
            'pagespeed',
            'siteCrawl',
            'aiAudit',
          ];
          return STEP_LABELS[keys[index]!];
        })
        .filter((label): label is string => Boolean(label));

      if (failed.length > 0) {
        toast.message(
          `Still building from available data. Incomplete: ${failed.join(', ')}`,
        );
      }

      setStep('report', 'running');
      const next = await generateReport();
      setReport(next);
      setStep('report', 'done');
      toast.success(
        failed.length > 0
          ? 'Client report ready — regenerate after failed scans finish'
          : 'Full client SEO report ready',
      );
    } catch (error) {
      setStep('report', 'error', getErrorMessage(error));
      toast.error(getErrorMessage(error));
    } finally {
      setBuilding(false);
    }
  }, [
    generateReport,
    pollJob,
    props.accountId,
    props.projectId,
    props.targetDomain,
    setStep,
  ]);

  const copyLink = useCallback(async () => {
    if (!report?.publicUrl) return;
    try {
      await copyTextToClipboard(report.publicUrl);
      setCopied(true);
      toast.success('Public link copied');
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }, [report?.publicUrl]);

  const pdfUrl =
    report?.publicShareEnabled && report.token
      ? buildSeoReportPdfUrl(report.token)
      : null;

  const busy = building || generating;
  const showSteps =
    building || Object.values(steps).some((s) => s.state !== 'idle');

  const doneCount = STEP_ORDER.filter(
    (key) => steps[key].state === 'done',
  ).length;
  const runningCount = STEP_ORDER.filter(
    (key) => steps[key].state === 'running',
  ).length;
  const failedCount = STEP_ORDER.filter(
    (key) => steps[key].state === 'error',
  ).length;

  return (
    <div
      className={
        props.compact
          ? 'rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4'
          : 'rounded-xl border border-[color:var(--ozer-accent)]/35 bg-[var(--workspace-control-surface)] p-5 shadow-[0_0_0_1px_color-mix(in_srgb,var(--ozer-accent)_12%,transparent)]'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">Client SEO report</h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            One click runs Site Explorer, PageSpeed, Site Crawler, and AI Search
            Audit, then builds a client-friendly public link + PDF. Larger sites
            can take a while — leave this tab open until steps finish.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => void buildFullReport()}
            disabled={busy || !props.targetDomain.trim()}
          >
            {building ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-3.5 w-3.5" />
            )}
            Build full report
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void generateOnly()}
            disabled={busy}
          >
            <RefreshCw
              className={`mr-2 h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`}
            />
            {report ? 'Snapshot now' : 'Generate from current data'}
          </Button>
        </div>
      </div>

      {showSteps ? (
        <div className="mt-4 space-y-3" aria-live="polite" role="status">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              Build progress
            </p>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              {doneCount}/{STEP_ORDER.length} done
              {runningCount > 0 ? ` · ${runningCount} running` : null}
              {failedCount > 0 ? ` · ${failedCount} failed` : null}
            </p>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {STEP_ORDER.map((key) => (
              <ReportStepCard key={key} stepKey={key} status={steps[key]} />
            ))}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-[var(--workspace-shell-text-muted)]">
          Loading…
        </p>
      ) : report ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium tabular-nums">
              Overall {report.overallScore ?? '—'}/100
            </span>
            <span className="text-[var(--workspace-shell-text-muted)]">
              {new Date(report.createdAt).toLocaleString('en-GB')}
            </span>
          </div>

          {report.publicUrl ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                readOnly
                value={report.publicUrl}
                className="font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyLink()}
                >
                  {copied ? (
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                  ) : (
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Copy link
                </Button>
                <Button type="button" size="sm" variant="outline" asChild>
                  <a href={report.publicUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Open
                  </a>
                </Button>
                {pdfUrl ? (
                  <Button type="button" size="sm" variant="outline" asChild>
                    <a href={pdfUrl}>
                      <FileDown className="mr-1.5 h-3.5 w-3.5" />
                      PDF
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--workspace-shell-text-muted)]">
          No client report yet. Use <strong>Build full report</strong> for the
          complete flow, or snapshot whatever data you already have.
        </p>
      )}
    </div>
  );
}
