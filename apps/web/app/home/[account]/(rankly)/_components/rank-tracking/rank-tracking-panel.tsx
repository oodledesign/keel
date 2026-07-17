'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import type { KeywordIntent } from '~/lib/clusters/types';
import { formatUsdCost } from '~/lib/rank-tracking/cost';
import type {
  KeywordRankSnapshot,
  RankCheckJobRow,
  RankRefreshInterval,
  RankTrackingSettings,
} from '~/lib/rank-tracking/types';
import { RANK_REFRESH_INTERVAL_LABELS } from '~/lib/rank-tracking/types';

import type { RanklyKeywordRow } from '../../../_lib/server/rankly-account-data';
import { parseKeywordLines } from '../../_lib/parse-keyword-lines';
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

function formatVolume(volume: number | null | undefined): string {
  if (volume == null) return '—';
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 10_000) return `${Math.round(volume / 1_000)}K`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}K`;
  return String(volume);
}

function formatKd(kd: number | null | undefined): string {
  if (kd == null) return '—';
  return String(Math.round(kd));
}

function formatCpc(cpc: number | null | undefined): string {
  if (cpc == null || cpc <= 0) return '—';
  return `$${cpc.toFixed(2)}`;
}

function formatRankDate(rankDate: string | null | undefined): string {
  if (!rankDate) return '—';
  const parsed = new Date(`${rankDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return rankDate;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const INTENT_LABELS: Record<KeywordIntent, string> = {
  informational: 'Info',
  commercial: 'Commercial',
  transactional: 'Transactional',
  navigational: 'Nav',
};

const INTENT_STYLES: Record<KeywordIntent, string> = {
  informational: 'bg-blue-500/15 text-blue-200',
  commercial: 'bg-amber-500/15 text-amber-200',
  transactional: 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]',
  navigational: 'bg-violet-500/15 text-violet-200',
};

function IntentBadge({ intent }: { intent: string | null | undefined }) {
  if (!intent) {
    return <span className="text-muted-foreground">—</span>;
  }

  const key = intent as KeywordIntent;
  const label = INTENT_LABELS[key] ?? intent;
  const style =
    INTENT_STYLES[key] ??
    'bg-[var(--workspace-shell-sidebar-accent)] text-muted-foreground';

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
      title={intent}
    >
      {label}
    </span>
  );
}

type SortColumn =
  | 'keyword'
  | 'volume'
  | 'kd'
  | 'intent'
  | 'cpc'
  | 'position'
  | 'change'
  | 'lastChecked';

type SortDirection = 'asc' | 'desc';

function defaultSortDirection(column: SortColumn): SortDirection {
  if (column === 'keyword' || column === 'intent' || column === 'position') {
    return 'asc';
  }
  return 'desc';
}

function compareNullableNumber(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: SortDirection,
): number {
  const aNull = a == null;
  const bNull = b == null;
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  return direction === 'asc' ? a - b : b - a;
}

function compareStrings(
  a: string,
  b: string,
  direction: SortDirection,
): number {
  const result = a.localeCompare(b, undefined, { sensitivity: 'base' });
  return direction === 'asc' ? result : -result;
}

function compareNullableDate(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: SortDirection,
): number {
  const aNull = a == null;
  const bNull = b == null;
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  const result = a.localeCompare(b);
  return direction === 'asc' ? result : -result;
}

function SortableHeader(props: {
  label: string;
  column: SortColumn;
  activeColumn: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
  align?: 'left' | 'right';
}) {
  const active = props.activeColumn === props.column;
  const alignClass = props.align === 'right' ? 'justify-end' : 'justify-start';

  return (
    <th className={`px-4 py-3 ${props.align === 'right' ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() => props.onSort(props.column)}
        className={`inline-flex w-full items-center gap-1 font-medium tracking-wide uppercase transition-colors hover:text-[var(--workspace-shell-text)] ${alignClass} ${active ? 'text-[var(--workspace-shell-text)]' : ''}`}
      >
        {props.label}
        <span className="text-[10px] tabular-nums opacity-80">
          {active ? (props.direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
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
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [savingInterval, setSavingInterval] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(
    props.latestJob &&
      (props.latestJob.status === 'pending' ||
        props.latestJob.status === 'running')
      ? props.latestJob.id
      : null,
  );
  const [interval, setInterval] = useState<RankRefreshInterval>(
    props.settings?.rankRefreshInterval ?? 'weekly',
  );
  const [trackDesktop, setTrackDesktop] = useState(
    props.settings?.trackDesktop ?? true,
  );
  const [trackMobile, setTrackMobile] = useState(
    props.settings?.trackMobile ?? false,
  );
  const [savingDevices, setSavingDevices] = useState(false);
  const [sort, setSort] = useState<{
    column: SortColumn;
    direction: SortDirection;
  }>({ column: 'keyword', direction: 'asc' });
  const [addKeywordsOpen, setAddKeywordsOpen] = useState(false);

  const toggleSort = (column: SortColumn) => {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: defaultSortDirection(column) },
    );
  };

  const trackedDevices = useMemo(() => {
    const devices: string[] = [];
    if (props.settings?.trackDesktop ?? true) devices.push('desktop');
    if (props.settings?.trackMobile) devices.push('mobile');
    if (devices.length === 0) devices.push('desktop');
    return devices;
  }, [props.settings?.trackDesktop, props.settings?.trackMobile]);

  const deviceCostLabel =
    trackedDevices.length > 1
      ? ` (${trackedDevices.join(' + ')})`
      : trackedDevices[0] === 'mobile'
        ? ' (mobile only)'
        : '';

  const snapshotByKeywordDevice = useMemo(
    () =>
      new Map(
        props.snapshots.map((row) => [`${row.keywordId}:${row.device}`, row]),
      ),
    [props.snapshots],
  );

  const primarySnapshot = (
    keywordId: string,
  ): KeywordRankSnapshot | undefined => {
    const desktop = snapshotByKeywordDevice.get(`${keywordId}:desktop`);
    if (desktop) return desktop;
    return snapshotByKeywordDevice.get(`${keywordId}:mobile`);
  };

  const sortedKeywords = useMemo(() => {
    const rows = [...props.keywords];

    rows.sort((a, b) => {
      switch (sort.column) {
        case 'keyword':
          return compareStrings(a.keyword, b.keyword, sort.direction);
        case 'volume':
          return compareNullableNumber(
            a.search_volume,
            b.search_volume,
            sort.direction,
          );
        case 'kd':
          return compareNullableNumber(
            a.keyword_difficulty,
            b.keyword_difficulty,
            sort.direction,
          );
        case 'intent':
          return compareStrings(a.intent ?? '', b.intent ?? '', sort.direction);
        case 'cpc':
          return compareNullableNumber(a.cpc, b.cpc, sort.direction);
        case 'position': {
          const aPos = primarySnapshot(a.id)?.position;
          const bPos = primarySnapshot(b.id)?.position;
          return compareNullableNumber(aPos, bPos, sort.direction);
        }
        case 'change': {
          const aChange = primarySnapshot(a.id)?.positionChange;
          const bChange = primarySnapshot(b.id)?.positionChange;
          return compareNullableNumber(aChange, bChange, sort.direction);
        }
        case 'lastChecked': {
          const aDate = primarySnapshot(a.id)?.rankDate;
          const bDate = primarySnapshot(b.id)?.rankDate;
          return compareNullableDate(aDate, bDate, sort.direction);
        }
        default:
          return 0;
      }
    });

    return rows;
  }, [props.keywords, sort, snapshotByKeywordDevice]);

  const displayRows = useMemo(
    () =>
      sortedKeywords.flatMap((keyword) => {
        const devices =
          trackedDevices.length > 0
            ? trackedDevices
            : [String(keyword.device ?? 'desktop')];

        return devices.map((device, deviceIndex) => {
          const snapshot = snapshotByKeywordDevice.get(
            `${keyword.id}:${device}`,
          );
          return { keyword, device, snapshot, showRemove: deviceIndex === 0 };
        });
      }),
    [sortedKeywords, trackedDevices, snapshotByKeywordDevice],
  );

  const parsedCount = useMemo(
    () => parseKeywordLines(keywordsText).length,
    [keywordsText],
  );

  const keywordsNeedingMetrics = useMemo(
    () => props.keywords.filter((row) => !row.metrics_updated_at).length,
    [props.keywords],
  );

  const fetchKeywordMetrics = async (options?: {
    force?: boolean;
    silent?: boolean;
  }) => {
    setLoadingMetrics(true);
    try {
      const res = await fetch('/api/rankly/keyword-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          accountId: props.accountId,
          force: options?.force ?? false,
        }),
      });
      const json = (await res.json()) as ApiResponse<{
        updated: number;
        skipped: number;
        estimatedCostUsd: number;
      }>;
      if (!json.ok) throw new Error(json.error.message);

      if (!options?.silent) {
        if (json.data.updated === 0) {
          toast.message('All keywords already have metrics');
        } else {
          toast.success(
            `Updated metrics for ${json.data.updated} keyword${json.data.updated === 1 ? '' : 's'}`,
          );
        }
      }

      router.refresh();
      return json.data;
    } catch (err) {
      if (!options?.silent) toast.error(getErrorMessage(err));
      return null;
    } finally {
      setLoadingMetrics(false);
    }
  };

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
        toast.message(
          'No new keywords added — all were already on this project',
        );
      } else {
        toast.success(
          `Added ${result.added} keyword${result.added === 1 ? '' : 's'}`,
        );
        void fetchKeywordMetrics({ silent: true });
      }

      setKeywordsText('');
      setAddKeywordsOpen(false);
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
      const json = (await res.json()) as ApiResponse<{
        settings: RankTrackingSettings;
      }>;
      if (!json.ok) throw new Error(json.error.message);
      toast.success('Refresh schedule updated');
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingInterval(false);
    }
  };

  const saveDevices = async () => {
    if (!trackDesktop && !trackMobile) {
      toast.error('Enable at least one device');
      return;
    }

    setSavingDevices(true);
    try {
      const res = await fetch('/api/rankly/rank-check', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          accountId: props.accountId,
          trackDesktop,
          trackMobile,
        }),
      });
      const json = (await res.json()) as ApiResponse<{
        settings: RankTrackingSettings;
      }>;
      if (!json.ok) throw new Error(json.error.message);
      toast.success('Device tracking updated');
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingDevices(false);
    }
  };

  const devicesDirty =
    trackDesktop !== (props.settings?.trackDesktop ?? true) ||
    trackMobile !== Boolean(props.settings?.trackMobile);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rank-refresh-interval">Auto refresh</Label>
            <select
              id="rank-refresh-interval"
              value={interval}
              onChange={(e) =>
                setInterval(e.target.value as RankRefreshInterval)
              }
              className="border-input bg-background flex h-10 w-full max-w-xs rounded-md border px-3 py-2 text-sm"
            >
              {(
                Object.keys(
                  RANK_REFRESH_INTERVAL_LABELS,
                ) as RankRefreshInterval[]
              ).map((value) => (
                <option key={value} value={value}>
                  {RANK_REFRESH_INTERVAL_LABELS[value]}
                </option>
              ))}
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

          <div className="space-y-2">
            <Label>Track devices</Label>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={trackDesktop}
                  onCheckedChange={(checked) =>
                    setTrackDesktop(checked === true)
                  }
                />
                Desktop
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={trackMobile}
                  onCheckedChange={(checked) =>
                    setTrackMobile(checked === true)
                  }
                />
                Mobile
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savingDevices || !devicesDirty}
                onClick={saveDevices}
              >
                {savingDevices ? 'Saving…' : 'Save devices'}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Each enabled device doubles API cost and check time. Turn off
              mobile if you only need desktop rankings.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Dialog open={addKeywordsOpen} onOpenChange={setAddKeywordsOpen}>
            <DialogTrigger asChild>
              <Button type="button">Add keywords</Button>
            </DialogTrigger>
            <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[#0F1923] text-[var(--workspace-shell-text)] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add keywords</DialogTitle>
                <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
                  Enter one keyword per line — up to 500 at a time.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={addKeywords} className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="new-keywords"
                    className="text-[var(--workspace-shell-text-muted)]"
                  >
                    Keywords
                  </Label>
                  <Textarea
                    id="new-keywords"
                    rows={8}
                    value={keywordsText}
                    onChange={(e) => setKeywordsText(e.target.value)}
                    placeholder={
                      'best crm software\nproject management tools\ncustomer support platform'
                    }
                    className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] font-mono text-sm text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
                    autoComplete="off"
                  />
                  <p className="text-muted-foreground text-xs">
                    {parsedCount > 0
                      ? `${parsedCount} ready to add.`
                      : 'Paste or type keywords, one per line.'}
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddKeywordsOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={busy || parsedCount === 0}>
                    {busy
                      ? 'Adding…'
                      : parsedCount > 1
                        ? `Add ${parsedCount} keywords`
                        : 'Add keywords'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button
            type="button"
            variant="outline"
            disabled={
              savingInterval || interval === props.settings?.rankRefreshInterval
            }
            onClick={saveInterval}
          >
            {savingInterval ? 'Saving…' : 'Save schedule'}
          </Button>
          <Button
            type="button"
            disabled={
              refreshing || Boolean(activeJobId) || props.keywordCount === 0
            }
            onClick={refreshRanks}
          >
            {refreshing ? 'Starting…' : 'Refresh ranks now'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loadingMetrics || props.keywordCount === 0}
            onClick={() =>
              fetchKeywordMetrics({ force: keywordsNeedingMetrics === 0 })
            }
          >
            {loadingMetrics
              ? 'Loading…'
              : keywordsNeedingMetrics > 0
                ? `Load insights (${keywordsNeedingMetrics})`
                : 'Refresh insights'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-4 py-3 text-sm">
        <p className="text-muted-foreground">
          Manual refresh est.{' '}
          <strong className="text-[var(--workspace-shell-text)]">
            {formatUsdCost(props.estimatedCostUsd)}
          </strong>{' '}
          DataForSEO API spend for {props.keywordCount} keyword
          {props.keywordCount === 1 ? '' : 's'}
          {deviceCostLabel}.
        </p>
        {props.latestJob?.status === 'done' ? (
          <p className="text-muted-foreground mt-1 text-xs">
            Last run: {formatUsdCost(Number(props.latestJob.api_cost_usd))} ·{' '}
            {props.latestJob.tasks_completed}/{props.latestJob.tasks_total}{' '}
            lookups
          </p>
        ) : null}
        {keywordsNeedingMetrics > 0 ? (
          <p className="text-muted-foreground mt-1 text-xs">
            {keywordsNeedingMetrics} keyword
            {keywordsNeedingMetrics === 1 ? '' : 's'} missing volume & intent —
            click Load insights to fetch from DataForSEO.
          </p>
        ) : null}
      </div>

      {activeJobId ? (
        <RankCheckJobPoller
          jobId={activeJobId}
          onComplete={() => setActiveJobId(null)}
        />
      ) : null}

      {displayRows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 px-4 py-6 text-sm">
          No keywords yet. Click Add keywords, then refresh ranks to pull
          positions from Google.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[color:var(--workspace-shell-border)]">
          <table className="w-full min-w-[62rem] text-left text-sm">
            <thead className="text-muted-foreground border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-xs tracking-wide uppercase">
              <tr>
                <SortableHeader
                  label="Keyword"
                  column="keyword"
                  activeColumn={sort.column}
                  direction={sort.direction}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Volume"
                  column="volume"
                  activeColumn={sort.column}
                  direction={sort.direction}
                  onSort={toggleSort}
                  align="right"
                />
                <SortableHeader
                  label="KD"
                  column="kd"
                  activeColumn={sort.column}
                  direction={sort.direction}
                  onSort={toggleSort}
                  align="right"
                />
                <SortableHeader
                  label="Intent"
                  column="intent"
                  activeColumn={sort.column}
                  direction={sort.direction}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="CPC"
                  column="cpc"
                  activeColumn={sort.column}
                  direction={sort.direction}
                  onSort={toggleSort}
                  align="right"
                />
                <SortableHeader
                  label="Position"
                  column="position"
                  activeColumn={sort.column}
                  direction={sort.direction}
                  onSort={toggleSort}
                  align="right"
                />
                <SortableHeader
                  label="Change"
                  column="change"
                  activeColumn={sort.column}
                  direction={sort.direction}
                  onSort={toggleSort}
                  align="right"
                />
                <SortableHeader
                  label="Last checked"
                  column="lastChecked"
                  activeColumn={sort.column}
                  direction={sort.direction}
                  onSort={toggleSort}
                  align="right"
                />
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
                    className="border-b border-[color:var(--workspace-shell-border)] last:border-0"
                  >
                    <td className="px-4 py-3">{keyword.keyword}</td>
                    <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                      {showRemove ? formatVolume(keyword.search_volume) : ''}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                      {showRemove ? formatKd(keyword.keyword_difficulty) : ''}
                    </td>
                    <td className="px-4 py-3">
                      {showRemove ? (
                        <IntentBadge intent={keyword.intent} />
                      ) : null}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                      {showRemove ? formatCpc(keyword.cpc) : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatPosition(snapshot?.position ?? null)}
                    </td>
                    <td
                      className={
                        change?.startsWith('▲')
                          ? 'px-4 py-3 text-right text-[var(--ozer-accent)] tabular-nums'
                          : change?.startsWith('▼')
                            ? 'px-4 py-3 text-right text-red-400 tabular-nums'
                            : 'text-muted-foreground px-4 py-3 text-right'
                      }
                    >
                      {change ?? '—'}
                    </td>
                    <td
                      className="text-muted-foreground px-4 py-3 text-right tabular-nums"
                      title={snapshot?.rankDate ?? undefined}
                    >
                      {formatRankDate(snapshot?.rankDate)}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {device}
                    </td>
                    <td className="text-muted-foreground max-w-[14rem] truncate px-4 py-3">
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
