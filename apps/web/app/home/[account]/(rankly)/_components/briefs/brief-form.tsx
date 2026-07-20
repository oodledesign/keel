'use client';

import { Suspense, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import { BriefJobPoller } from './brief-job-poller';

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

function BriefFormInner(props: {
  accountId: string;
  projectId: string;
  projectDomain: string;
  briefsPath: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const spokeId = params.get('spokeId');
  const [keyword, setKeyword] = useState(params.get('keyword') ?? '');
  const [country, setCountry] = useState(params.get('country') ?? 'gb');
  const [mode, setMode] = useState<'full' | 'quick'>(
    spokeId ? 'quick' : 'full',
  );
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/rankly/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          accountId: props.accountId,
          targetDomain: props.projectDomain,
          keyword: keyword.trim() || null,
          country,
          mode,
          spokeId,
        }),
      });

      const json = (await res.json()) as ApiResponse<{ jobId: string }>;
      if (!json.ok) {
        throw new Error(json.error.message);
      }

      toast.success('Brief job started');
      router.push(`${props.briefsPath}/new?jobId=${json.data.jobId}`);
      setJobId(json.data.jobId);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (jobId) {
    return <BriefJobPoller jobId={jobId} briefsPath={props.briefsPath} />;
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      {spokeId ? (
        <div className="rounded-lg border border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] px-4 py-3 text-sm text-[var(--workspace-shell-text)]">
          Generating brief from cluster spoke — quick mode pre-selected (~20
          credits)
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="brief-domain">Target domain</Label>
        <Input
          id="brief-domain"
          value={props.projectDomain}
          readOnly
          disabled
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="brief-keyword">Target keyword</Label>
        <Input
          id="brief-keyword"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Leave empty to auto-discover best opportunity"
        />
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          Leave blank in full mode to let Rankly find the best gap vs your
          competitors
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="brief-country">Country</Label>
          <select
            id="brief-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="gb">United Kingdom</option>
            <option value="us">United States</option>
            <option value="au">Australia</option>
            <option value="ca">Canada</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="brief-mode">Mode</Label>
          <select
            id="brief-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'full' | 'quick')}
            className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="full">
              Full (~65 credits) — domain + gap analysis
            </option>
            <option value="quick">
              Quick (~20 credits) — SERP analysis only
            </option>
          </select>
        </div>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Starting…' : 'Generate brief'}
      </Button>
    </form>
  );
}

export function BriefForm(props: {
  accountId: string;
  projectId: string;
  projectDomain: string;
  briefsPath: string;
}) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Loading…
        </p>
      }
    >
      <BriefFormInner {...props} />
    </Suspense>
  );
}
