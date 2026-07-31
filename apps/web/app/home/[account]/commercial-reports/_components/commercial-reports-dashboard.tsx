'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { cn } from '@kit/ui/utils';

import { workspacePanelCard } from '~/lib/workspace-ui';

import {
  type CommercialReportsMetrics,
  type DisposalInsights,
  type InboundInsights,
  type InsightsPeriod,
  type InsightsTab,
  type RequirementInsights,
  type SourceInsights,
  type TransactionInsights,
  type ViewingInsights,
  formatInsightsDelta,
} from '../_lib/commercial-reports.types';

const PERIODS: Array<{ key: InsightsPeriod; label: string }> = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'quarter', label: 'Last quarter' },
];

const INSIGHT_TABS: Array<{ key: InsightsTab; label: string }> = [
  { key: 'disposals', label: 'Disposals' },
  { key: 'viewings', label: 'Viewings' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'inbound', label: 'Inbound' },
  { key: 'sources', label: 'Sources' },
  { key: 'transactions', label: 'Transactions' },
];

const TAB_BLURBS: Record<InsightsTab, string> = {
  disposals: 'Real-time disposal performance with period comparison.',
  viewings: 'Viewing volume and feedback sentiment with period comparison.',
  requirements: 'Active briefs, qualification mix, and conversion funnel.',
  inbound: 'Enquiry intake, triage speed, and stale unactioned stock.',
  sources: 'Lead count and size volume by enquiry source / portal.',
  transactions: 'Completed lettings and sales outcomes.',
};

const DISPOSAL_FILTERS = [
  { key: 'to_let', label: 'Lettings' },
  { key: 'for_sale', label: 'Sales' },
  { key: 'all', label: 'All' },
] as const;

const STATUS_COLORS = ['var(--ozer-accent)', '#0d9488', '#f59e0b', '#94a3b8'];

function formatKpiValue(
  value: number,
  format: 'number' | 'sqft' | 'days' | 'percent',
) {
  if (format === 'days') {
    return `${value.toLocaleString('en-GB', { maximumFractionDigits: 1 })} days`;
  }
  if (format === 'percent') {
    return `${value.toLocaleString('en-GB', { maximumFractionDigits: 1 })}%`;
  }
  return value.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

function DeltaBadge({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const delta = formatInsightsDelta(current, previous);
  return (
    <span
      className={cn(
        'text-xs font-medium',
        delta.positive === true && 'text-emerald-600',
        delta.positive === false && 'text-rose-600',
        delta.positive === null && 'text-[var(--workspace-shell-text)]/45',
      )}
    >
      {delta.label}
    </span>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
          : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
      )}
    >
      {children}
    </Link>
  );
}

export function CommercialReportsDashboard({
  overview,
  disposals,
  viewings,
  inbound,
  requirements,
  sources,
  transactions,
  activeTab,
}: {
  overview: CommercialReportsMetrics;
  disposals: DisposalInsights;
  viewings: ViewingInsights;
  inbound: InboundInsights;
  requirements: RequirementInsights;
  sources: SourceInsights;
  transactions: TransactionInsights;
  activeTab: InsightsTab;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildHref = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const periodByTab: Record<InsightsTab, InsightsPeriod> = {
    disposals: disposals.period,
    viewings: viewings.period,
    requirements: requirements.period,
    inbound: inbound.period,
    sources: sources.period,
    transactions: transactions.period,
  };
  const labelByTab: Record<InsightsTab, string> = {
    disposals: disposals.periodLabel,
    viewings: viewings.periodLabel,
    requirements: requirements.periodLabel,
    inbound: inbound.periodLabel,
    sources: sources.periodLabel,
    transactions: transactions.periodLabel,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
            Agency Insights
          </h2>
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            {TAB_BLURBS[activeTab]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((item) => (
            <FilterLink
              key={item.key}
              href={buildHref({ period: item.key })}
              active={periodByTab[activeTab] === item.key}
            >
              {item.label}
            </FilterLink>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[color:var(--workspace-shell-border)] pb-3">
        {INSIGHT_TABS.map((tab) => (
          <FilterLink
            key={tab.key}
            href={buildHref({ tab: tab.key })}
            active={activeTab === tab.key}
          >
            {tab.label}
          </FilterLink>
        ))}
      </div>

      {activeTab === 'viewings' ? (
        <ViewingsInsightsPanel
          viewings={viewings}
          periodLabel={labelByTab.viewings}
        />
      ) : activeTab === 'inbound' ? (
        <InboundInsightsPanel
          inbound={inbound}
          periodLabel={labelByTab.inbound}
        />
      ) : activeTab === 'requirements' ? (
        <RequirementInsightsPanel
          requirements={requirements}
          periodLabel={labelByTab.requirements}
        />
      ) : activeTab === 'sources' ? (
        <SourceInsightsPanel
          sources={sources}
          periodLabel={labelByTab.sources}
        />
      ) : activeTab === 'transactions' ? (
        <TransactionInsightsPanel
          transactions={transactions}
          buildHref={buildHref}
          periodLabel={labelByTab.transactions}
        />
      ) : (
        <DisposalsInsightsPanel
          overview={overview}
          disposals={disposals}
          buildHref={buildHref}
        />
      )}
    </div>
  );
}

function DisposalsInsightsPanel({
  overview,
  disposals,
  buildHref,
}: {
  overview: CommercialReportsMetrics;
  disposals: DisposalInsights;
  buildHref: (updates: Record<string, string>) => string;
}) {
  const statusChartData = disposals.statusBreakdown.filter((s) => s.count > 0);
  const sizeChartData = disposals.sizeBands.map((band) => ({
    name: band.label,
    current: band.current,
    previous: band.previous,
  }));
  const timelineData = disposals.newOverTime.map((point) => ({
    name: point.label,
    current: point.current,
    previous: point.previous,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {DISPOSAL_FILTERS.map((filter) => (
            <FilterLink
              key={filter.key}
              href={buildHref({ type: filter.key })}
              active={disposals.disposalType === filter.key}
            >
              {filter.label} overview
            </FilterLink>
          ))}
        </div>
        <p className="text-xs text-[var(--workspace-shell-text)]/45">
          Compared to previous {disposals.periodLabel.toLowerCase()}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            disposals.kpis.newInstructions,
            disposals.kpis.totalSizeSqft,
            disposals.kpis.avgSizeSqft,
            disposals.kpis.avgDaysOnMarket,
          ] as const
        ).map((kpi) => (
          <Card key={kpi.label} className={workspacePanelCard}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-2xl font-semibold text-[var(--workspace-shell-text)] tabular-nums">
                  {formatKpiValue(kpi.value, kpi.format)}
                </p>
                <DeltaBadge current={kpi.value} previous={kpi.previousValue} />
              </div>
              <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/50">
                {kpi.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Size band
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sizeChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--workspace-shell-border)"
                />
                <XAxis
                  dataKey="name"
                  tick={{
                    fontSize: 11,
                    fill: 'var(--workspace-shell-text-muted)',
                  }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{
                    fontSize: 11,
                    fill: 'var(--workspace-shell-text-muted)',
                  }}
                />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="current"
                  name="This period"
                  fill="var(--ozer-accent)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="previous"
                  name="Previous period"
                  fill="color-mix(in srgb, var(--ozer-accent) 35%, white)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {statusChartData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-[var(--workspace-shell-text)]/45">
                No disposals yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell
                        key={entry.key}
                        fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            New disposals
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timelineData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--workspace-shell-border)"
              />
              <XAxis
                dataKey="name"
                tick={{
                  fontSize: 11,
                  fill: 'var(--workspace-shell-text-muted)',
                }}
              />
              <YAxis
                allowDecimals={false}
                tick={{
                  fontSize: 11,
                  fill: 'var(--workspace-shell-text-muted)',
                }}
              />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="current"
                name="This period"
                fill="var(--ozer-accent)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="previous"
                name="Previous period"
                fill="color-mix(in srgb, var(--ozer-accent) 35%, white)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Team
          </CardTitle>
        </CardHeader>
        <CardContent>
          {disposals.team.length === 0 ? (
            <p className="text-sm text-[var(--workspace-shell-text)]/45">
              No new disposals in this period. Assign negotiators on disposals
              to see allocation here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--workspace-shell-border)] text-left text-[11px] tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
                    <th className="px-2 py-2 font-medium">Name</th>
                    <th className="px-2 py-2 font-medium">Count</th>
                    <th className="px-2 py-2 font-medium">Total ft²</th>
                  </tr>
                </thead>
                <tbody>
                  {disposals.team.map((row) => (
                    <tr
                      key={row.key}
                      className="border-b border-[color:var(--workspace-shell-border)]/60"
                    >
                      <td className="px-2 py-2.5 text-[var(--workspace-shell-text)]">
                        {row.name}
                      </td>
                      <td className="px-2 py-2.5 text-[var(--workspace-shell-text)] tabular-nums">
                        {row.count}
                      </td>
                      <td className="px-2 py-2.5 text-[var(--workspace-shell-text)] tabular-nums">
                        {row.totalSqft.toLocaleString('en-GB')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SnapshotStat
            label="Stock on market"
            value={overview.stockOnMarket}
          />
          <SnapshotStat label="Under offer" value={overview.underOffer} />
          <SnapshotStat
            label="Unactioned enquiries"
            value={overview.unactionedEnquiries}
          />
          <SnapshotStat
            label="Awaiting feedback"
            value={overview.awaitingFeedbackViewings}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ViewingsInsightsPanel({
  viewings,
  periodLabel,
}: {
  viewings: ViewingInsights;
  periodLabel: string;
}) {
  const timelineData = viewings.overTime.map((point) => ({
    name: point.label,
    current: point.current,
    previous: point.previous,
  }));
  const sectorChartData = viewings.bySector.filter((row) => row.count > 0);
  const sourceChartData = viewings.bySource.filter((row) => row.count > 0);

  return (
    <div className="space-y-8">
      <p className="text-xs text-[var(--workspace-shell-text)]/45">
        Compared to previous {periodLabel.toLowerCase()}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(
          [
            viewings.kpis.total,
            viewings.kpis.positive,
            viewings.kpis.neutral,
            viewings.kpis.negative,
            viewings.kpis.awaitingFeedback,
            viewings.kpis.cancelled,
          ] as const
        ).map((kpi) => (
          <Card key={kpi.label} className={workspacePanelCard}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-2xl font-semibold text-[var(--workspace-shell-text)] tabular-nums">
                  {formatKpiValue(kpi.value, kpi.format)}
                </p>
                <DeltaBadge current={kpi.value} previous={kpi.previousValue} />
              </div>
              <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/50">
                {kpi.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              By sector
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {sectorChartData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-[var(--workspace-shell-text)]/45">
                No viewings in this period
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorChartData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {sectorChartData.map((entry, index) => (
                      <Cell
                        key={entry.key}
                        fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              By source
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {sourceChartData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-[var(--workspace-shell-text)]/45">
                Link viewings to enquiries to see sources
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceChartData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {sourceChartData.map((entry, index) => (
                      <Cell
                        key={entry.key}
                        fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Viewings over time
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timelineData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--workspace-shell-border)"
              />
              <XAxis
                dataKey="name"
                tick={{
                  fontSize: 11,
                  fill: 'var(--workspace-shell-text-muted)',
                }}
              />
              <YAxis
                allowDecimals={false}
                tick={{
                  fontSize: 11,
                  fill: 'var(--workspace-shell-text-muted)',
                }}
              />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="current"
                name="This period"
                fill="var(--ozer-accent)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="previous"
                name="Previous period"
                fill="color-mix(in srgb, var(--ozer-accent) 35%, white)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownTable
          title="Sector detail"
          rows={viewings.bySector}
          empty="No sector data yet. Set sector on disposals."
        />
        <BreakdownTable
          title="By agent"
          rows={viewings.byAgent}
          empty="No agent data yet. Set conducted by on viewings."
        />
      </div>
    </div>
  );
}

function BreakdownTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: ViewingInsights['bySector'];
  empty: string;
}) {
  return (
    <Card className={workspacePanelCard}>
      <CardHeader>
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--workspace-shell-text)]/45">{empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--workspace-shell-border)] text-left text-[11px] tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
                  <th className="px-2 py-2 font-medium">Name</th>
                  <th className="px-2 py-2 font-medium">Count</th>
                  <th className="px-2 py-2 font-medium">Total ft²</th>
                  <th className="px-2 py-2 font-medium">Av. ft²</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-[color:var(--workspace-shell-border)]/60"
                  >
                    <td className="px-2 py-2.5 text-[var(--workspace-shell-text)]">
                      {row.label}
                    </td>
                    <td className="px-2 py-2.5 text-[var(--workspace-shell-text)] tabular-nums">
                      {row.count}
                    </td>
                    <td className="px-2 py-2.5 text-[var(--workspace-shell-text)] tabular-nums">
                      {row.totalSqft.toLocaleString('en-GB')}
                    </td>
                    <td className="px-2 py-2.5 text-[var(--workspace-shell-text)] tabular-nums">
                      {row.avgSqft.toLocaleString('en-GB')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SnapshotStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-3">
      <p className="text-lg font-semibold text-[var(--workspace-shell-text)] tabular-nums">
        {value}
      </p>
      <p className="text-xs text-[var(--workspace-shell-text)]/50">{label}</p>
    </div>
  );
}

function KpiGrid({
  kpis,
}: {
  kpis: Array<{
    label: string;
    value: number;
    previousValue: number;
    format: 'number' | 'sqft' | 'days' | 'percent';
  }>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className={workspacePanelCard}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-2xl font-semibold text-[var(--workspace-shell-text)] tabular-nums">
                {formatKpiValue(kpi.value, kpi.format)}
              </p>
              <DeltaBadge current={kpi.value} previous={kpi.previousValue} />
            </div>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/50">
              {kpi.label}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InboundInsightsPanel({
  inbound,
  periodLabel,
}: {
  inbound: InboundInsights;
  periodLabel: string;
}) {
  const statusData = inbound.byStatus.filter((s) => s.count > 0);
  const timelineData = inbound.overTime.map((point) => ({
    name: point.label,
    current: point.current,
    previous: point.previous,
  }));

  return (
    <div className="space-y-8">
      <p className="text-xs text-[var(--workspace-shell-text)]/45">
        Compared to previous {periodLabel.toLowerCase()}. Actioned = on
        schedule. Stale = unactioned ≥ 7 days.
      </p>
      <KpiGrid
        kpis={[
          inbound.kpis.newEnquiries,
          inbound.kpis.unactioned,
          inbound.kpis.actioned,
          inbound.kpis.avgDaysToAction,
          inbound.kpis.archived,
          inbound.kpis.stalePercent,
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              New enquiries by status
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {statusData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-[var(--workspace-shell-text)]/45">
                No enquiries in this period
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--workspace-shell-border)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 11,
                      fill: 'var(--workspace-shell-text-muted)',
                    }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{
                      fontSize: 11,
                      fill: 'var(--workspace-shell-text-muted)',
                    }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Enquiries"
                    fill="var(--ozer-accent)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              New enquiries over time
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timelineData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--workspace-shell-border)"
                />
                <XAxis
                  dataKey="name"
                  tick={{
                    fontSize: 11,
                    fill: 'var(--workspace-shell-text-muted)',
                  }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{
                    fontSize: 11,
                    fill: 'var(--workspace-shell-text-muted)',
                  }}
                />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="current"
                  name="This period"
                  fill="var(--ozer-accent)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="previous"
                  name="Previous period"
                  fill="color-mix(in srgb, var(--ozer-accent) 35%, white)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RequirementInsightsPanel({
  requirements,
  periodLabel,
}: {
  requirements: RequirementInsights;
  periodLabel: string;
}) {
  const qualData = requirements.qualification.filter((s) => s.count > 0);
  const funnelData = requirements.funnel;

  return (
    <div className="space-y-8">
      <p className="text-xs text-[var(--workspace-shell-text)]/45">
        Snapshot of all briefs · {periodLabel.toLowerCase()} context for new
        activity. Stale = active with no update for ≥ 30 days.
      </p>
      <KpiGrid
        kpis={[
          requirements.kpis.active,
          requirements.kpis.onHold,
          requirements.kpis.archived,
          requirements.kpis.signed,
          requirements.kpis.avgAgeDays,
          requirements.kpis.stale,
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Qualification
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {qualData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-[var(--workspace-shell-text)]/45">
                No requirements yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={qualData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {qualData.map((entry, index) => (
                      <Cell
                        key={entry.key}
                        fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className={workspacePanelCard}>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base text-[var(--workspace-shell-text)]">
                Conversion funnel
              </CardTitle>
              <span className="text-xs text-[var(--workspace-shell-text)]/45">
                {requirements.conversionRate}% Search → Deal
              </span>
            </div>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--workspace-shell-border)"
                />
                <XAxis
                  dataKey="label"
                  tick={{
                    fontSize: 11,
                    fill: 'var(--workspace-shell-text-muted)',
                  }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{
                    fontSize: 11,
                    fill: 'var(--workspace-shell-text-muted)',
                  }}
                />
                <Tooltip />
                <Bar
                  dataKey="count"
                  name="Requirements"
                  fill="var(--ozer-accent)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            By stage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--workspace-shell-border)] text-left text-[11px] tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
                  <th className="px-2 py-2 font-medium">Stage</th>
                  <th className="px-2 py-2 font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {requirements.byStage.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-[color:var(--workspace-shell-border)]/60"
                  >
                    <td className="px-2 py-2.5 text-[var(--workspace-shell-text)]">
                      {row.label}
                    </td>
                    <td className="px-2 py-2.5 text-[var(--workspace-shell-text)] tabular-nums">
                      {row.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SourceInsightsPanel({
  sources,
  periodLabel,
}: {
  sources: SourceInsights;
  periodLabel: string;
}) {
  const chartData = sources.rows.map((row) => ({
    name: row.label,
    current: row.leadCount,
    previous: row.previousLeadCount,
  }));

  return (
    <div className="space-y-8">
      <p className="text-xs text-[var(--workspace-shell-text)]/45">
        Compared to previous {periodLabel.toLowerCase()}
      </p>
      <KpiGrid kpis={[sources.totalLeads, sources.totalVolumeSqft]} />
      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Leads by source
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {chartData.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-[var(--workspace-shell-text)]/45">
              No enquiries in this period
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--workspace-shell-border)"
                />
                <XAxis
                  dataKey="name"
                  tick={{
                    fontSize: 11,
                    fill: 'var(--workspace-shell-text-muted)',
                  }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{
                    fontSize: 11,
                    fill: 'var(--workspace-shell-text-muted)',
                  }}
                />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="current"
                  name="This period"
                  fill="var(--ozer-accent)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="previous"
                  name="Previous period"
                  fill="color-mix(in srgb, var(--ozer-accent) 35%, white)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Source detail
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sources.rows.length === 0 ? (
            <p className="text-sm text-[var(--workspace-shell-text)]/45">
              No source data yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--workspace-shell-border)] text-left text-[11px] tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
                    <th className="px-2 py-2 font-medium">Source</th>
                    <th className="px-2 py-2 font-medium">Leads</th>
                    <th className="px-2 py-2 font-medium">Prev</th>
                    <th className="px-2 py-2 font-medium">Volume ft²</th>
                    <th className="px-2 py-2 font-medium">Prev ft²</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.rows.map((row) => (
                    <tr
                      key={row.key}
                      className="border-b border-[color:var(--workspace-shell-border)]/60"
                    >
                      <td className="px-2 py-2.5 text-[var(--workspace-shell-text)]">
                        {row.label}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums text-[var(--workspace-shell-text)]">
                        {row.leadCount}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums text-[var(--workspace-shell-text)]">
                        {row.previousLeadCount}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums text-[var(--workspace-shell-text)]">
                        {row.volumeSqft.toLocaleString('en-GB')}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums text-[var(--workspace-shell-text)]">
                        {row.previousVolumeSqft.toLocaleString('en-GB')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionInsightsPanel({
  transactions,
  buildHref,
  periodLabel,
}: {
  transactions: TransactionInsights;
  buildHref: (updates: Record<string, string>) => string;
  periodLabel: string;
}) {
  const sourceData = transactions.bySource.filter((row) => row.count > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <FilterLink
            href={buildHref({ txn: 'lettings' })}
            active={transactions.kind === 'lettings'}
          >
            Lettings
          </FilterLink>
          <FilterLink
            href={buildHref({ txn: 'sales' })}
            active={transactions.kind === 'sales'}
          >
            Sales
          </FilterLink>
        </div>
        <p className="text-xs text-[var(--workspace-shell-text)]/45">
          Compared to previous {periodLabel.toLowerCase()}
        </p>
      </div>
      <KpiGrid
        kpis={[
          transactions.kpis.totalDeals,
          transactions.kpis.avgSizeSqft,
          transactions.kpis.avgRentPsf,
          transactions.kpis.avgLeaseYears,
          transactions.kpis.avgDisposalDaysToClose,
          transactions.kpis.avgRequirementDaysToClose,
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              By source
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {sourceData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-[var(--workspace-shell-text)]/45">
                Link completed deals to requirements with a source to populate
                this chart.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {sourceData.map((entry, index) => (
                      <Cell
                        key={entry.key}
                        fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <BreakdownTable
          title="Source detail"
          rows={transactions.bySource}
          empty="No completed deal sources in this period."
        />
      </div>
    </div>
  );
}
