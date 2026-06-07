'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { formatUsdCost } from '~/lib/rank-tracking/cost';
import type {
  KeywordRankSnapshot,
  RankCheckJobRow,
  RankRefreshInterval,
  RankTrackingSettings,
} from '~/lib/rank-tracking/types';
import { RANK_REFRESH_INTERVAL_LABELS } from '~/lib/rank-tracking/types';

import { parseKeywordLines } from '../../_lib/parse-keyword-lines';
import type { RanklyKeywordRow } from '../../../_lib/server/rankly-account-data';
import {
  addRanklyKeywordsBulk,
  deleteRanklyKeyword,
} from '../../_lib/server/rankly-module-actions';
import { RankCheckJobPoller } from './rank-check-job-poller';

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

function formatPosition(position: number | null): string {
  if (position == null || position <= 0) return '—';
  return String(position);
}

function formatChange(change: number | null): string | null {
  if (change == null || change === 0) return null;
  if (change > 0) return `▲ ${change}`;
  return `▼ ${Math.abs(change)}`;
}

export function RankTrackingPanel(props: {
  accountId: string;
  projectId: string;
  keywords: RanklyKeywordRow[];
  settings: RankTrackingSettings | null;
  snapshots: KeywordRankSnapshot[];
  latestJob: RankCheckJobRow | null;
  keywordCount: number;
  estimatedCostUsd: number;
}) {
  const router = useRouter();
  const [keywordsText, setKeywordsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingInterval, setSavingInterval] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(
    props.latestJob &&
      (props.latestJob.status === 'pending' || props.latestJob.status === 'running')
      ? props.latestJob.id
      : null,
  );
  const [interval, setInterval] = useState<RankRefreshInterval>(
    props.settings?.rankRefreshInterval ?? 'weekly',
  );

  const parsedCount = useMemo(
    () => parseKeywordLines(keywordsText).length,
    [keywordsText],
  );

  const addKeywords = async (e: React.FormEvent) => {
    e.preventDefault();
    const keywords = parseKeywordLines(keywordsText);
    if (keywords.length === 0) {
      toast.error('Enter at least one keyword, one per line');
      return;
    }
    if (keywords.length > 500) {
      toast.error('Add up to 500 keywords at a time');
      return;
    }

    setBusy(true);
    try {
      const result = await addRanklyKeywordsBulk({
        accountId: props.accountId,
        projectId: props.projectId,
        keywords,
        search_engine: 'google',
        device: 'desktop',
      });

      if (result.added === 0) {
        toast.message('No new keywords added — all were already on this project');
      } else {
        toast.success(`Added ${result.added} keyword${result.added === 1 ? '' : 's'}`);
      }

      setKeywordsText('');
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (keywordId: string) => {
    setDeletingId(keywordId);
    try {
      await deleteRanklyKeyword({
        accountId: props.accountId,
        keywordId,
      });
      toast.success('Keyword removed');
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const refreshRanks = async () => {
    if (props.keywordCount === 0) {
      toast.error('Add keywords before refreshing ranks');
      return;
    }

    setRefreshing(true);
    try {
      const res = await fetch('/api/rankly/rank-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          accountId: props.accountId,
        }),
      });
      const json = (await res.json()) as ApiResponse<{
        jobId: string;
        estimatedCostUsd: number;
        alreadyRunning: boolean;
      }>;
      if (!json.ok) throw new Error(json.error.message);

      setActiveJobId(json.data.jobId);
      if (json.data.alreadyRunning) {
        toast.message('Rank check already in progress');
      } else {
        toast.success(
          `Rank check started · est. ${formatUsdCost(json.data.estimatedCostUsd)}`,
        );
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  const saveInterval = async () => {
    setSavingInterval(true);
    try {
      const res = await fetch('/api/rankly/rank-check', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          accountId: props.accountId,
          rankRefreshInterval: interval,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ settings: RankTrackingSettings }>;
      if (!json.ok) throw new Error(json.error.message);
      toast.success('Refresh schedule updated');
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingInterval(false);
    }
  };

  const snapshotByKeywordDevice = new Map(
    props.snapshots.map((row) => [`${row.keywordId}:${row.device}`, row]),
  );

  const displayRows = props.keywords.flatMap((keyword) => {
    const devices = props.settings?.trackMobile
      ? ['desktop', 'mobile']
      : [String(keyword.device ?? 'desktop')];

    return devices.map((device, deviceIndex) => {
      const snapshot = snapshotByKeywordDevice.get(`${keyword.id}:${device}`);
      return { keyword, device, snapshot, showRemove: deviceIndex === 0 };
    });
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="rank-refresh-interval">Auto refresh</Label>
          <select
            id="rank-refresh-interval"
            value={interval}
            onChange={(e) => setInterval(e.target.value as RankRefreshInterval)}
            className="border-input bg-background flex h-10 w-full max-w-xs rounded-md border px-3 py-2 text-sm"
          >
            {(Object.keys(RANK_REFRESH_INTERVAL_LABELS) as RankRefreshInterval[]).map(
              (value) => (
                <option key={value} value={value}>
                  {RANK_REFRESH_INTERVAL_LABELS[value]}
                </option>
              ),
            )}
          </select>
          <p className="text-muted-foreground text-xs">
            {props.settings?.lastRankCheckAt
              ? `Last checked ${props.settings.lastRankCheckAt}`
              : 'Not checked yet'}
            {props.settings?.nextRankCheckAt && interval !== 'manual'
              ? ` · Next ${new Date(props.settings.nextRankCheckAt).toLocaleDateString()}`
              : null}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={savingInterval || interval === props.settings?.rankRefreshInterval}
            onClick={saveInterval}
          >
            {savingInterval ? 'Saving…' : 'Save schedule'}
          </Button>
          <Button
            type="button"
            disabled={refreshing || Boolean(activeJobId) || props.keywordCount === 0}
            onClick={refreshRanks}
          >
            {refreshing ? 'Starting…' : 'Refresh ranks now'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm">
        <p className="text-muted-foreground">
          Manual refresh est.{' '}
          <strong className="text-white">{formatUsdCost(props.estimatedCostUsd)}</strong>{' '}
          DataForSEO API spend for {props.keywordCount} keyword
          {props.keywordCount === 1 ? '' : 's'}
          {props.settings?.trackMobile ? ' (desktop + mobile)' : ''}.
        </p>
        {props.latestJob?.status === 'done' ? (
          <p className="text-muted-foreground mt-1 text-xs">
            Last run: {formatUsdCost(Number(props.latestJob.api_cost_usd))} ·{' '}
            {props.latestJob.tasks_completed}/{props.latestJob.tasks_total} lookups
          </p>
        ) : null}
      </div>

      {activeJobId ? (
        <RankCheckJobPoller
          jobId={activeJobId}
          onComplete={() => setActiveJobId(null)}
        />
      ) : null}

      <form onSubmit={addKeywords} className="max-w-xl space-y-3">
        <div className="space-y-2">
          <Label htmlFor="new-keywords">Add keywords</Label>
          <Textarea
            id="new-keywords"
            rows={6}
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            placeholder={
              'best crm software\nproject management tools\ncustomer support platform'
            }
            className="font-mono text-sm"
            autoComplete="off"
          />
          <p className="text-muted-foreground text-xs">
            One keyword per line — up to 500 at a time.
            {parsedCount > 0 ? ` ${parsedCount} ready to add.` : null}
          </p>
        </div>
        <Button type="submit" disabled={busy || parsedCount === 0}>
          {busy ? 'Adding…' : parsedCount > 1 ? `Add ${parsedCount} keywords` : 'Add keywords'}
        </Button>
      </form>

      {displayRows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-white/10 bg-black/10 px-4 py-6 text-sm">
          No keywords yet. Add phrases above, then refresh ranks to pull positions from Google.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Keyword</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Change</th>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Ranking URL</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map(({ keyword, device, snapshot, showRemove }) => {
                const change = formatChange(snapshot?.positionChange ?? null);
                return (
                  <tr
                    key={`${keyword.id}-${device}`}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="px-4 py-3">{keyword.keyword}</td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {formatPosition(snapshot?.position ?? null)}
                    </td>
                    <td
                      className={
                        change?.startsWith('▲')
                          ? 'px-4 py-3 text-[var(--keel-teal)] tabular-nums'
                          : change?.startsWith('▼')
                            ? 'px-4 py-3 text-red-400 tabular-nums'
                            : 'px-4 py-3 text-muted-foreground'
                      }
                    >
                      {change ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{device}</td>
                    <td className="max-w-[14rem] truncate px-4 py-3 text-muted-foreground">
                      {snapshot?.rankingUrl ? (
                        <a
                          href={snapshot.rankingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-primary underline-offset-4 hover:underline"
                        >
                          {snapshot.rankingUrl.replace(/^https?:\/\//, '')}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {showRemove ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={deletingId === keyword.id}
                          onClick={() => remove(keyword.id)}
                        >
                          {deletingId === keyword.id ? '…' : 'Remove'}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
