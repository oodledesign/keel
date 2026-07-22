'use client';

import { useCallback, useEffect, useState } from 'react';

import { Check, Copy, ExternalLink, FileDown, RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { copyTextToClipboard } from '~/lib/clipboard';
import { buildSeoReportPdfUrl } from '~/lib/rankly-seo-report/public-url';

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

type ApiResponse =
  | { ok: true; data: ReportSummary | { report: ReportSummary | null } }
  | { ok: false; error: { message: string } };

export function SeoReportSharePanel(props: {
  accountId: string;
  projectId: string;
  compact?: boolean;
}) {
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadLatest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/rankly/seo-report?projectId=${encodeURIComponent(props.projectId)}`,
      );
      const json = (await res.json()) as ApiResponse;
      if (!json.ok) throw new Error(json.error.message);
      const data = json.data as { report: ReportSummary | null };
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

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/rankly/seo-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          accountId: props.accountId,
          enableShare: true,
        }),
      });
      const json = (await res.json()) as ApiResponse;
      if (!json.ok) throw new Error(json.error.message);
      setReport(json.data as ReportSummary);
      toast.success('Client SEO report ready');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  }, [props.accountId, props.projectId]);

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

  return (
    <div
      className={
        props.compact
          ? 'rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4'
          : 'rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] p-5'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Client SEO report</h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Public link + PDF with pillar scores from AI Audit, PageSpeed,
            crawl, Site Explorer, and keywords.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void generate()}
          disabled={generating}
        >
          <RefreshCw
            className={`mr-2 h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`}
          />
          {report ? 'Regenerate' : 'Generate report'}
        </Button>
      </div>

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
          ) : (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Generate a report to create a public share link.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--workspace-shell-text-muted)]">
          No client report yet. Generate one to share a public link and PDF.
        </p>
      )}
    </div>
  );
}
