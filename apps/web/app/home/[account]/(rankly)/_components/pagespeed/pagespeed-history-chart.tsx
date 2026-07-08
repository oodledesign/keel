'use client';

import { useMemo, useState } from 'react';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  PagespeedHistoryPoint,
  PagespeedMetricKey,
  PagespeedPageHistory,
} from '~/lib/pagespeed/types';
import { PAGESPEED_METRIC_LABELS } from '~/lib/pagespeed/types';

function scoreTone(score: number | null | undefined): string {
  if (score == null) return 'text-muted-foreground';
  if (score >= 90) return 'text-[var(--ozer-accent)]';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function formatChartDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatRunDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function metricValue(
  point: PagespeedHistoryPoint,
  metric: PagespeedMetricKey,
): number | null {
  return point[metric];
}

function trendLabel(
  points: PagespeedHistoryPoint[],
  metric: PagespeedMetricKey,
): string | null {
  const values = points
    .map((point) => metricValue(point, metric))
    .filter((value): value is number => value != null);

  if (values.length < 2) return null;

  const first = values[0]!;
  const last = values[values.length - 1]!;
  const delta = last - first;
  if (delta === 0) return 'No change since first run';

  return `${delta > 0 ? '+' : ''}${delta} since first run`;
}

type ChartRow = {
  fetchedAt: string;
  label: string;
  mobile: number | null;
  desktop: number | null;
};

function buildChartRows(
  mobile: PagespeedHistoryPoint[],
  desktop: PagespeedHistoryPoint[],
  metric: PagespeedMetricKey,
): ChartRow[] {
  const byTime = new Map<string, ChartRow>();

  for (const point of mobile) {
    if (point.errorMsg) continue;
    const existing = byTime.get(point.fetchedAt) ?? {
      fetchedAt: point.fetchedAt,
      label: formatChartDate(point.fetchedAt),
      mobile: null,
      desktop: null,
    };
    existing.mobile = metricValue(point, metric);
    byTime.set(point.fetchedAt, existing);
  }

  for (const point of desktop) {
    if (point.errorMsg) continue;
    const existing = byTime.get(point.fetchedAt) ?? {
      fetchedAt: point.fetchedAt,
      label: formatChartDate(point.fetchedAt),
      mobile: null,
      desktop: null,
    };
    existing.desktop = metricValue(point, metric);
    byTime.set(point.fetchedAt, existing);
  }

  return Array.from(byTime.values()).sort(
    (a, b) =>
      new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime(),
  );
}

function HistoryTable(props: {
  mobile: PagespeedHistoryPoint[];
  desktop: PagespeedHistoryPoint[];
  metric: PagespeedMetricKey;
}) {
  const rows = useMemo(() => {
    const byTime = new Map<
      string,
      { fetchedAt: string; mobile: number | null; desktop: number | null }
    >();

    for (const point of props.mobile) {
      if (point.errorMsg) continue;
      const existing = byTime.get(point.fetchedAt) ?? {
        fetchedAt: point.fetchedAt,
        mobile: null,
        desktop: null,
      };
      existing.mobile = metricValue(point, props.metric);
      byTime.set(point.fetchedAt, existing);
    }

    for (const point of props.desktop) {
      if (point.errorMsg) continue;
      const existing = byTime.get(point.fetchedAt) ?? {
        fetchedAt: point.fetchedAt,
        mobile: null,
        desktop: null,
      };
      existing.desktop = metricValue(point, props.metric);
      byTime.set(point.fetchedAt, existing);
    }

    return Array.from(byTime.values())
      .sort(
        (a, b) =>
          new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime(),
      )
      .slice(0, 10);
  }, [props.desktop, props.metric, props.mobile]);

  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-[color:var(--workspace-shell-border)]">
      <table className="w-full min-w-[24rem] text-left text-sm">
        <thead className="border-b border-[color:var(--workspace-shell-border)] text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Run</th>
            <th className="px-3 py-2 text-right">Mobile</th>
            <th className="px-3 py-2 text-right">Desktop</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.fetchedAt} className="border-b border-[color:var(--workspace-shell-border)] last:border-0">
              <td className="px-3 py-2 text-muted-foreground">
                {formatRunDate(row.fetchedAt)}
              </td>
              <td
                className={`px-3 py-2 text-right tabular-nums ${scoreTone(row.mobile)}`}
              >
                {row.mobile ?? '—'}
              </td>
              <td
                className={`px-3 py-2 text-right tabular-nums ${scoreTone(row.desktop)}`}
              >
                {row.desktop ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PagespeedHistoryChart(props: {
  history: PagespeedPageHistory;
}) {
  const [metric, setMetric] = useState<PagespeedMetricKey>('performanceScore');
  const [showTable, setShowTable] = useState(false);

  const chartRows = useMemo(
    () =>
      buildChartRows(props.history.mobile, props.history.desktop, metric),
    [props.history.desktop, props.history.mobile, metric],
  );

  const mobileTrend = trendLabel(props.history.mobile, metric);
  const desktopTrend = trendLabel(props.history.desktop, metric);
  const runCount = Math.max(
    props.history.mobile.length,
    props.history.desktop.length,
  );

  if (runCount < 2) {
    return (
      <div className="border-t border-[color:var(--workspace-shell-border)] px-4 py-4">
        <p className="text-muted-foreground text-sm">
          Score history appears after at least two PageSpeed runs.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-[color:var(--workspace-shell-border)] px-4 py-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium">Score history</h4>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Last {runCount} run{runCount === 1 ? '' : 's'} per device
            {mobileTrend ? ` · Mobile ${mobileTrend}` : ''}
            {desktopTrend && desktopTrend !== mobileTrend
              ? ` · Desktop ${desktopTrend}`
              : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[color:var(--workspace-shell-border)] p-0.5">
            {(
              Object.keys(PAGESPEED_METRIC_LABELS) as PagespeedMetricKey[]
            ).map((key) => (
              <button
                key={key}
                type="button"
                className={`rounded-md px-2 py-1 text-xs transition ${
                  metric === key
                    ? 'ozer-gradient-active text-[var(--ozer-white)]'
                    : 'text-muted-foreground hover:text-[var(--workspace-shell-text)]'
                }`}
                onClick={() => setMetric(key)}
              >
                {PAGESPEED_METRIC_LABELS[key]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="text-muted-foreground text-xs hover:text-[var(--workspace-shell-text)]"
            onClick={() => setShowTable((value) => !value)}
          >
            {showTable ? 'Hide runs' : 'View runs'}
          </button>
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              width={28}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0d1117',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as ChartRow | undefined;
                return row ? formatRunDate(row.fetchedAt) : '';
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="mobile"
              name="Mobile"
              stroke="var(--ozer-accent)"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="desktop"
              name="Desktop"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {showTable ? (
        <div className="mt-4">
          <HistoryTable
            mobile={props.history.mobile}
            desktop={props.history.desktop}
            metric={metric}
          />
        </div>
      ) : null}
    </div>
  );
}
