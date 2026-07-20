'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import type { PageOptimizeRecommendation } from '~/lib/page-optimize/types';
import { PAGE_OPTIMIZE_STATUS_LABELS } from '~/lib/page-optimize/types';

import { useRanklyJobProgress } from '../../_lib/use-rankly-job-progress';
import { RanklyJobProgress } from '../rankly-job-progress';

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

type OptimizeJob = {
  status: string;
  error_msg: string | null;
  target_keyword: string | null;
  credits_used: number | null;
  reportId?: string | null;
};

type OptimizeReport = {
  score: number | null;
  target_keyword: string;
  title_suggestions: string[] | null;
  meta_suggestion: string | null;
  rewrite_summary: string | null;
  recommendations: PageOptimizeRecommendation[];
};

const PROGRESS_STATUSES = [
  'pending',
  'scraping',
  'detecting_keyword',
  'serp_analysis',
  'scraping_competitors',
  'analysing',
  'done',
] as const;

function progressPercent(status: string): number {
  const index = PROGRESS_STATUSES.indexOf(
    status as (typeof PROGRESS_STATUSES)[number],
  );
  if (index < 0) return status === 'error' ? 0 : 5;
  return Math.round((index / (PROGRESS_STATUSES.length - 1)) * 100);
}

const PRIORITY_COLOURS = {
  high: 'bg-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_18%,transparent)] text-[var(--workspace-shell-text)]',
  medium:
    'bg-[color-mix(in_srgb,#F0C14B_18%,transparent)] text-[var(--workspace-shell-text)]',
  low: 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
} as const;

function OptimizeReportView({ report }: { report: OptimizeReport }) {
  return (
    <div className="space-y-4 rounded-lg border border-[var(--ozer-accent)]/20 bg-[var(--ozer-accent)]/5 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
            SEO optimization score
          </p>
          <p className="text-3xl font-semibold tabular-nums">
            {report.score ?? '—'}
            {report.score != null ? (
              <span className="text-lg font-normal text-[var(--workspace-shell-text-muted)]">
                {' '}
                /100
              </span>
            ) : null}
          </p>
        </div>
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Target keyword:{' '}
          <span className="text-foreground">{report.target_keyword}</span>
        </p>
      </div>

      {report.rewrite_summary ? (
        <p className="text-sm leading-relaxed">{report.rewrite_summary}</p>
      ) : null}

      {report.title_suggestions?.length ? (
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--workspace-shell-text-muted)] uppercase">
            Title suggestions
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {report.title_suggestions.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.meta_suggestion ? (
        <div>
          <p className="mb-1 text-xs font-medium text-[var(--workspace-shell-text-muted)] uppercase">
            Meta description
          </p>
          <p className="text-sm">{report.meta_suggestion}</p>
        </div>
      ) : null}

      {report.recommendations.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--workspace-shell-text-muted)] uppercase">
            Recommendations
          </p>
          {report.recommendations.map((rec) => (
            <div
              key={`${rec.title}-${rec.category}`}
              className="rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{rec.title}</span>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] uppercase ${PRIORITY_COLOURS[rec.priority]}`}
                >
                  {rec.priority}
                </span>
              </div>
              <p className="mt-1 text-[var(--workspace-shell-text-muted)]">
                {rec.detail}
              </p>
              {rec.action ? (
                <p className="mt-2 text-[var(--ozer-accent)]">{rec.action}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PageOptimizePanel(props: {
  accountId: string;
  projectId: string;
  sourceUrl: string;
  country: string;
  targetKeyword?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [report, setReport] = useState<OptimizeReport | null>(null);

  const fallbackFetch = useCallback(async () => {
    if (!jobId) {
      throw new Error('No job');
    }

    const res = await fetch(`/api/rankly/page-optimize/${jobId}`);
    const json = (await res.json()) as ApiResponse<{
      job: OptimizeJob;
      report: OptimizeReport | null;
      reportId: string | null;
    }>;
    if (!json.ok) {
      throw new Error(json.error.message);
    }
    return {
      ...json.data.job,
      reportId: json.data.reportId,
    };
  }, [jobId]);

  const { data: job } = useRanklyJobProgress({
    streamUrl: jobId ? `/api/rankly/page-optimize/${jobId}/stream` : '',
    fallbackFetch,
    isTerminal: (data) => data.status === 'done' || data.status === 'error',
  });

  useEffect(() => {
    if (!jobId || job?.status !== 'done') return;

    void (async () => {
      const res = await fetch(`/api/rankly/page-optimize/${jobId}`);
      const json = (await res.json()) as ApiResponse<{
        report: OptimizeReport | null;
      }>;
      if (json.ok && json.data.report) {
        setReport(json.data.report);
      }
    })();
  }, [job?.status, jobId]);

  const startOptimization = async () => {
    setLoading(true);
    setReport(null);

    try {
      const res = await fetch('/api/rankly/page-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          accountId: props.accountId,
          sourceUrl: props.sourceUrl,
          country: props.country,
          targetKeyword: props.targetKeyword?.trim() || undefined,
        }),
      });

      const json = (await res.json()) as ApiResponse<{ jobId: string }>;
      if (!json.ok) {
        throw new Error(json.error.message);
      }

      setJobId(json.data.jobId);
      toast.success('Page optimization started');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (report) {
    return <OptimizeReportView report={report} />;
  }

  if (job && job.status !== 'done' && job.status !== 'error') {
    const label = PAGE_OPTIMIZE_STATUS_LABELS[job.status] ?? job.status;
    return (
      <RanklyJobProgress
        label={label}
        percent={progressPercent(job.status)}
        detail={
          job.target_keyword ? `Keyword: ${job.target_keyword}` : undefined
        }
        meta={
          job.credits_used != null ? `~${job.credits_used} credits` : undefined
        }
      />
    );
  }

  if (job?.status === 'error') {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_12%,transparent)] px-4 py-3 text-sm text-[var(--workspace-shell-text)]">
          {job.error_msg ?? 'Page optimization failed'}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setJobId(null);
            void startOptimization();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Scrape this URL, compare it to the SERP, and get AI-powered title, meta,
        and content recommendations.
      </p>
      <Button
        size="sm"
        onClick={() => void startOptimization()}
        disabled={loading}
      >
        {loading ? 'Starting…' : 'Optimize this page'}
      </Button>
    </div>
  );
}
