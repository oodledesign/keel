'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { AUDIT_CREDITS_ESTIMATE } from '~/lib/ai-audit/types';

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

export function AuditLauncher(props: {
  accountId: string;
  projectId: string;
  targetDomain: string;
  auditPath: string;
  lastRun?: {
    overall_score: number | null;
    created_at: string;
    reportId: string;
  } | null;
  scoreTrend?: Array<{ overall_score: number | null; run_at: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const trend =
    props.scoreTrend && props.scoreTrend.length >= 2
      ? (props.scoreTrend[props.scoreTrend.length - 1]?.overall_score ?? 0) -
        (props.scoreTrend[0]?.overall_score ?? 0)
      : null;

  const runAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rankly/ai-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          accountId: props.accountId,
          targetDomain: props.targetDomain,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ jobId: string }>;
      if (!json.ok) throw new Error(json.error.message);
      toast.success('AI Search Audit started');
      router.push(`${props.auditPath}?jobId=${json.data.jobId}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-5">
      <div>
        <h3 className="text-lg font-semibold">AI Search Audit</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Domain-level report across entity, content, E-E-A-T, and tech — checks
          citations on Google AI Overview, ChatGPT, Perplexity, and Claude via
          DataForSEO (~{AUDIT_CREDITS_ESTIMATE} credits) + Claude synthesis.
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Target: {props.targetDomain}
        </p>
      </div>

      {props.lastRun ? (
        <div className="rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-4 py-3 text-sm">
          <p>
            Last audit:{' '}
            <span className="font-medium">
              {props.lastRun.overall_score ?? '—'}/100
            </span>{' '}
            · {new Date(props.lastRun.created_at).toLocaleDateString()}
            {trend != null && trend !== 0 ? (
              <span className={trend > 0 ? 'text-emerald-400' : 'text-red-400'}>
                {' '}
                ({trend > 0 ? '+' : ''}
                {trend} since first run)
              </span>
            ) : null}
          </p>
        </div>
      ) : null}

      <Button onClick={runAudit} disabled={loading}>
        {loading
          ? 'Starting…'
          : props.lastRun
            ? 'Run new audit'
            : 'Run AI Search Audit'}
      </Button>
    </div>
  );
}
