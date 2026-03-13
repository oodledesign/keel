'use client';

import { useMemo, useState } from 'react';

import {
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileText,
  PauseCircle,
  TriangleAlert,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

import { Badge } from '@kit/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

import type {
  DashboardInvoiceSummary,
  DashboardJobSummary,
  DashboardMetrics,
  DashboardStatusSummary,
} from '../_lib/server/dashboard-page.loader';

type DashboardPageContentProps = {
  accountName: string;
  metrics: DashboardMetrics;
  statusSummary: DashboardStatusSummary;
  activeJobs: DashboardJobSummary[];
  teamMembers: Array<{
    userId: string;
    name: string | null;
    email: string | null;
    role: string | null;
  }>;
  recentInvoices: DashboardInvoiceSummary[];
};

const panelClass =
  'rounded-[24px] border border-white/6 bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]';

export function DashboardPageContent({
  accountName,
  metrics,
  statusSummary,
  activeJobs,
  teamMembers,
  recentInvoices,
}: DashboardPageContentProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'projects' | 'team' | 'invoices'
  >('overview');
  const [teamFilter, setTeamFilter] = useState<'staff' | 'contractors'>(
    'staff',
  );

  const totalProjects = useMemo(
    () =>
      statusSummary.completed +
      statusSummary.inProgress +
      statusSummary.pending +
      statusSummary.overdue,
    [statusSummary],
  );

  const statusPercent = useMemo(() => {
    if (!totalProjects) {
      return {
        completed: 0,
        inProgress: 0,
        pending: 0,
        overdue: 0,
      };
    }
    const pct = (value: number) =>
      Math.round((value / totalProjects) * 100);
    return {
      completed: pct(statusSummary.completed),
      inProgress: pct(statusSummary.inProgress),
      pending: pct(statusSummary.pending),
      overdue: pct(statusSummary.overdue),
    };
  }, [statusSummary, totalProjects]);

  const revenueTrendData = useMemo(
    () => buildRevenueTrendData(metrics.totalRevenue),
    [metrics.totalRevenue],
  );

  const monthRailData = useMemo(
    () =>
      buildMonthRailData({
        currentRevenue: metrics.totalRevenue,
        currentHours: metrics.hoursLogged,
        currentJobsCompleted: statusSummary.completed,
      }),
    [metrics.totalRevenue, metrics.hoursLogged, statusSummary.completed],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 bg-transparent px-4 pb-10 pt-5 text-white md:px-6 lg:px-8">
      {/* Top stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(metrics.totalRevenue)}
          helper="+12.5% vs last month"
          tone="emerald"
          icon={BarChart3}
        />
        <StatCard
          label="Active Jobs"
          value={metrics.activeJobs.toString()}
          helper="+3 new this week"
          tone="sky"
          icon={BriefcaseBusiness}
        />
        <StatCard
          label="Total Clients"
          value={metrics.totalClients.toString()}
          helper="+5 since last month"
          tone="violet"
          icon={Users}
        />
        <StatCard
          label="Hours Logged"
          value={`${metrics.hoursLogged}`}
          helper="This week"
          tone="amber"
          icon={Clock3}
        />
      </div>

      {/* Project status + tabs */}
      <Card className={panelClass}>
        <CardHeader className="border-b border-white/6 pb-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-white">
                Project Status Overview
              </CardTitle>
              <p className="mt-1 text-xs text-zinc-400">
                Current distribution of all active projects
              </p>
            </div>
            <StatusLegend statusSummary={statusSummary} />
          </div>
          <StatusSummaryGrid statusSummary={statusSummary} />
          <StatusBar statusPercent={statusPercent} />
        </CardHeader>
        <CardContent className="pt-5">
          <Tabs
            value={activeTab}
            onValueChange={(v) =>
              setActiveTab(v as typeof activeTab)
            }
          >
            <TabsList className="mb-6 grid h-11 w-full grid-cols-4 rounded-xl border border-white/6 bg-[var(--workspace-control-surface)]/80 p-1 text-xs md:w-auto md:grid-cols-4">
              <TabsTrigger
                value="overview"
                className="gap-2 text-zinc-300 data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-200 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-emerald-400/40"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="projects"
                className="gap-2 text-zinc-300 data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-200 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-emerald-400/40"
              >
                <BriefcaseBusiness className="h-3.5 w-3.5" />
                Projects
              </TabsTrigger>
              <TabsTrigger
                value="team"
                className="gap-2 text-zinc-300 data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-200 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-emerald-400/40"
              >
                <Users className="h-3.5 w-3.5" />
                Team
              </TabsTrigger>
              <TabsTrigger
                value="invoices"
                className="gap-2 text-zinc-300 data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-200 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-emerald-400/40"
              >
                <FileText className="h-3.5 w-3.5" />
                Invoices
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0 rounded-[24px] bg-[var(--workspace-shell-canvas)] p-4 md:p-5">
              <OverviewTab
                revenueTrendData={revenueTrendData}
                monthRailData={monthRailData}
              />
            </TabsContent>

            <TabsContent value="projects" className="mt-0 rounded-[24px] bg-[var(--workspace-shell-canvas)] p-4 md:p-5">
              <ProjectsTab activeJobs={activeJobs} />
            </TabsContent>

            <TabsContent value="team" className="mt-0 rounded-[24px] bg-[var(--workspace-shell-canvas)] p-4 md:p-5">
              <TeamTab
                teamMembers={teamMembers}
                filter={teamFilter}
                onFilterChange={setTeamFilter}
              />
            </TabsContent>

            <TabsContent value="invoices" className="mt-0 rounded-[24px] bg-[var(--workspace-shell-canvas)] p-4 md:p-5">
              <InvoicesTab invoices={recentInvoices} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  tone: 'emerald' | 'sky' | 'violet' | 'amber';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneBg: Record<typeof tone, string> = {
    emerald: 'bg-emerald-500/10',
    sky: 'bg-sky-500/10',
    violet: 'bg-violet-500/10',
    amber: 'bg-amber-500/10',
  } as const;

  const toneAccent: Record<typeof tone, string> = {
    emerald: 'text-emerald-400',
    sky: 'text-sky-400',
    violet: 'text-violet-400',
    amber: 'text-amber-400',
  } as const;

  return (
    <Card className={`${panelClass} overflow-hidden`}>
      <CardContent className="flex flex-col gap-2 p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneBg[tone]} ${toneAccent[tone]}`}>
              <Icon className="h-4.5 w-4.5" />
            </span>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              {label}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${toneBg[tone]} ${toneAccent[tone]}`}
          >
            {helper}
          </span>
        </div>
        <p className="text-2xl font-semibold tracking-tight md:text-3xl">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function StatusLegend({
  statusSummary,
}: {
  statusSummary: DashboardStatusSummary;
}) {
  const items = [
    {
      label: 'Completed',
      color: 'bg-emerald-500',
      value: statusSummary.completed,
    },
    {
      label: 'In Progress',
      color: 'bg-sky-500',
      value: statusSummary.inProgress,
    },
    {
      label: 'Pending',
      color: 'bg-amber-400',
      value: statusSummary.pending,
    },
    {
      label: 'Overdue',
      color: 'bg-rose-500',
      value: statusSummary.overdue,
    },
  ];

  return (
    <div className="flex flex-wrap gap-3 text-xs text-zinc-300">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${item.color}`}
          />
          <span>{item.label}</span>
          <span className="text-zinc-500">
            {item.value.toString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatusSummaryGrid({
  statusSummary,
}: {
  statusSummary: DashboardStatusSummary;
}) {
  const cards = [
    {
      key: 'completed',
      label: 'Completed',
      value: statusSummary.completed,
      Icon: CheckCircle2,
      iconClass: 'text-emerald-300',
      bgClass: 'bg-emerald-500/12',
    },
    {
      key: 'progress',
      label: 'In Progress',
      value: statusSummary.inProgress,
      Icon: CircleDashed,
      iconClass: 'text-blue-300',
      bgClass: 'bg-blue-500/12',
    },
    {
      key: 'pending',
      label: 'Pending',
      value: statusSummary.pending,
      Icon: PauseCircle,
      iconClass: 'text-amber-300',
      bgClass: 'bg-amber-500/12',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      value: statusSummary.overdue,
      Icon: TriangleAlert,
      iconClass: 'text-rose-300',
      bgClass: 'bg-rose-500/12',
    },
  ];

  return (
    <div className="mt-2 grid gap-3 md:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.key}
          className="rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.bgClass}`}
            >
              <card.Icon className={`h-4.5 w-4.5 ${card.iconClass}`} />
            </div>
            <span className="text-3xl font-semibold tracking-tight text-white">
              {card.value}
            </span>
          </div>
          <p className="mt-3 text-xs font-medium text-zinc-300">
            {card.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function StatusBar({
  statusPercent,
}: {
  statusPercent: {
    completed: number;
    inProgress: number;
    pending: number;
    overdue: number;
  };
}) {
  const segments = [
    {
      key: 'completed',
      width: statusPercent.completed,
      color: 'bg-emerald-500',
    },
    {
      key: 'inProgress',
      width: statusPercent.inProgress,
      color: 'bg-sky-500',
    },
    {
      key: 'pending',
      width: statusPercent.pending,
      color: 'bg-amber-400',
    },
    {
      key: 'overdue',
      width: statusPercent.overdue,
      color: 'bg-rose-500',
    },
  ];

  return (
    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
      <div className="flex h-full w-full">
        {segments.map((seg) =>
          seg.width > 0 ? (
            <div
              key={seg.key}
              style={{ width: `${seg.width}%` }}
              className={`${seg.color} h-full transition-all`}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}

function OverviewTab({
  revenueTrendData,
  monthRailData,
}: {
  revenueTrendData: Array<{
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
    isCurrent: boolean;
  }>;
  monthRailData: Array<{
    month: string;
    revenue: number;
    jobsCompleted: number;
    hoursWorked: number;
    isCurrent: boolean;
  }>;
}) {
  return (
    <Card className={panelClass}>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-white">
              Revenue Trend
            </CardTitle>
            <p className="mt-1 text-xs text-zinc-400">
              Monthly revenue overview for the last 6 months
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#57C87F]" />
              <span>Profit</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#176A72]" />
              <span>Expenses</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr),320px] md:items-start">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrendData} barCategoryGap="28%">
                <CartesianGrid
                  vertical={false}
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#8FA1BC', fontSize: 12 }}
                />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(255,255,255,0.035)' }}
                  contentStyle={{
                    backgroundColor: '#0B1524',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    fontSize: 12,
                    color: '#F7F9FC',
                    boxShadow: '0 12px 30px rgba(2, 8, 23, 0.35)',
                  }}
                  labelStyle={{ color: '#F7F9FC', fontWeight: 600 }}
                  itemStyle={{ color: '#D7DEEE' }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(Number(value)),
                    name === 'profit' ? 'Profit' : 'Expenses',
                  ]}
                />
                <Bar
                  dataKey="expenses"
                  stackId="revenue"
                  radius={[0, 0, 10, 10]}
                >
                  {revenueTrendData.map((entry) => (
                    <Cell
                      key={`${entry.month}-expenses`}
                      fill={entry.isCurrent ? '#3C8D63' : '#176A72'}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="profit"
                  stackId="revenue"
                  radius={[10, 10, 0, 0]}
                >
                  {revenueTrendData.map((entry) => (
                    <Cell
                      key={`${entry.month}-profit`}
                      fill={entry.isCurrent ? '#57C87F' : '#2FA8A7'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {monthRailData.map((month, index) => (
              <div
                key={month.month}
                className={`rounded-2xl border px-4 py-4 ${
                  month.isCurrent || index === 0
                    ? 'border-[#57C87F]/70 bg-[var(--workspace-shell-panel)] shadow-[0_0_0_1px_rgba(87,200,127,0.12)]'
                    : 'border-white/6 bg-[var(--workspace-shell-panel)]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{month.month}</p>
                  <span className="text-sm font-semibold text-[#57C87F]">
                    {formatCurrency(month.revenue)}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-xs text-zinc-300">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Revenue</span>
                    <span>{formatCurrency(month.revenue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Jobs Completed</span>
                    <span>{month.jobsCompleted}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Hours Worked</span>
                    <span>{month.hoursWorked}h</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectsTab({ activeJobs }: { activeJobs: DashboardJobSummary[] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white">
        Active Work
      </h3>
      <div className="space-y-2">
        {activeJobs.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No active jobs yet. Create a job to get started.
          </p>
        ) : (
          activeJobs.map((job) => (
            <div
              key={job.id}
              className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-[var(--workspace-shell-panel)] px-4 py-3 text-sm md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-medium text-white">
                  {job.title}
                </p>
                <p className="text-xs text-zinc-400">
                  {job.clientName ?? 'No client'} ·{' '}
                  {job.dueDate
                    ? `Due ${new Date(job.dueDate).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}`
                    : 'No due date'}
                </p>
              </div>
              <div className="mt-2 flex items-center gap-2 md:mt-0">
                <Badge
                  className="bg-zinc-800 text-[11px] font-medium text-zinc-200"
                  variant="outline"
                >
                  {formatJobStatus(job.status)}
                </Badge>
                <Badge
                  className="bg-zinc-800 text-[11px] font-medium text-zinc-300"
                  variant="outline"
                >
                  {formatJobPriority(job.priority)}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type DashboardTeamMember = {
  userId: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

function TeamTab({
  teamMembers,
  filter,
  onFilterChange,
}: {
  teamMembers: DashboardTeamMember[];
  filter: 'staff' | 'contractors';
  onFilterChange: (value: 'staff' | 'contractors') => void;
}) {
  const filtered = useMemo(() => {
    const normalized = teamMembers.map((m) => ({
      ...m,
      role: m.role?.toLowerCase() ?? null,
    }));
    if (filter === 'contractors') {
      return normalized.filter((m) => m.role === 'contractor');
    }
    return normalized.filter(
      (m) =>
        m.role === 'admin' ||
        m.role === 'owner' ||
        m.role === 'staff',
    );
  }, [teamMembers, filter]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white">
        Team Performance
      </h3>
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => onFilterChange('staff')}
          className={`rounded-full px-3 py-1 font-medium ${
            filter === 'staff'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
              : 'border border-zinc-700 bg-[var(--workspace-shell-panel)] text-zinc-400 hover:text-white'
          }`}
        >
          Staff
        </button>
        <button
          type="button"
          onClick={() => onFilterChange('contractors')}
          className={`rounded-full px-3 py-1 font-medium ${
            filter === 'contractors'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
              : 'border border-zinc-700 bg-[var(--workspace-shell-panel)] text-zinc-400 hover:text-white'
          }`}
        >
          Contractors
        </button>
      </div>
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-xs text-zinc-400">
            No {filter === 'staff' ? 'staff' : 'contractors'} for this
            account yet.
          </p>
        ) : (
          filtered.map((member) => {
            return (
              <div
                key={member.userId}
                className="flex flex-col justify-between gap-2 rounded-xl border border-zinc-800 bg-[var(--workspace-shell-panel)] px-4 py-3 text-sm md:flex-row md:items-center"
              >
                <div>
                  <p className="font-medium text-white">
                    {member.name ?? 'Unnamed member'}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {formatMemberRole(member.role)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
                  <span>
                    <span className="font-semibold text-emerald-400">
                      {mockMetric(member.userId, 'tasks')}
                    </span>{' '}
                    active tasks
                  </span>
                  <span>
                    <span className="font-semibold text-emerald-400">
                      {mockMetric(member.userId, 'hours')}h
                    </span>{' '}
                    this week
                  </span>
                  <span>
                    <span className="font-semibold text-emerald-400">
                      {mockMetric(member.userId, 'completion')}%
                    </span>{' '}
                    completion
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function InvoicesTab({
  invoices,
}: {
  invoices: DashboardInvoiceSummary[];
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white">
        Recent Invoices
      </h3>
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[var(--workspace-shell-panel)]">
        {invoices.length === 0 ? (
          <div className="px-4 py-6 text-xs text-zinc-400">
            No invoices yet. Create an invoice to see it here.
          </div>
        ) : (
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="border-b border-zinc-800 bg-[var(--workspace-shell-panel)] text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const pillStatus: 'Paid' | 'Pending' | 'Overdue' =
                  inv.status === 'paid'
                    ? 'Paid'
                    : inv.status === 'overdue'
                      ? 'Overdue'
                      : 'Pending';
                return (
                  <tr
                    key={inv.id}
                    className="border-b border-zinc-800/80 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-3">
                      {inv.clientName ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {formatCurrency(inv.totalPence / 100)}
                    </td>
                    <td className="px-4 py-3">
                      {formatShortDate(inv.dueAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={pillStatus} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: 'Paid' | 'Pending' | 'Overdue';
}) {
  const map = {
    Paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
    Pending: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
    Overdue: 'bg-rose-500/15 text-rose-400 border-rose-500/40',
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[status]}`}
    >
      {status}
    </span>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatJobStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pending',
    in_progress: 'In progress',
    on_hold: 'On hold',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[status] ?? status;
}

function formatJobPriority(priority: string): string {
  const map: Record<string, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
  };
  return map[priority] ?? priority;
}

function formatMemberRole(role: string | null): string {
  if (!role) return 'Member';
  const normalized = role.toLowerCase();
  switch (normalized) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'staff':
      return 'Staff';
    case 'contractor':
      return 'Contractor';
    default:
      return role;
  }
}

function mockMetric(
  id: string,
  type: 'tasks' | 'hours' | 'completion',
): number {
  const hash =
    id
      .split('')
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 10;
  if (type === 'tasks') return 4 + hash;
  if (type === 'hours') return 30 + hash;
  return 85 + (hash % 10);
}

function buildRevenueTrendData(currentRevenue: number) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', { month: 'short' });
  const fallback = currentRevenue > 0 ? currentRevenue : 48392;
  const multipliers = [0.68, 0.74, 0.82, 0.79, 0.9, 1];

  return multipliers.map((multiplier, index) => {
    const monthsAgo = multipliers.length - 1 - index;
    const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const revenue = Math.round(fallback * multiplier);
    const baseRevenue = Math.round(revenue * 0.43);

    return {
      month: formatter.format(date),
      revenue,
      expenses: baseRevenue,
      profit: revenue - baseRevenue,
      isCurrent: monthsAgo === 0,
    };
  });
}

function buildMonthRailData(params: {
  currentRevenue: number;
  currentHours: number;
  currentJobsCompleted: number;
}) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  const currentRevenue = params.currentRevenue > 0 ? params.currentRevenue : 48392;
  const currentHours = params.currentHours > 0 ? params.currentHours : 342;
  const currentJobsCompleted =
    params.currentJobsCompleted > 0 ? params.currentJobsCompleted : 28;

  const multipliers = [1, 0.9, 0.82];

  return multipliers.map((multiplier, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);

    return {
      month: formatter.format(date),
      revenue: Math.round(currentRevenue * multiplier),
      jobsCompleted: Math.max(0, Math.round(currentJobsCompleted * multiplier)),
      hoursWorked: Math.max(0, Math.round(currentHours * multiplier)),
      isCurrent: index === 0,
    };
  });
}


