'use client';

import { useState } from 'react';

import Link from 'next/link';

import {
  Building2,
  CheckSquare,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

import pathsConfig from '~/config/paths.config';
import { FinanceTrendBarChart } from '~/components/finance/finance-charts';

import type { FinanceDashboardSummary } from '../_lib/server/property-dashboard.loader';

import type { GroupMember, GroupTask } from '../_lib/server/group-dashboard.loader';
import type { PropertyStatusCounts } from '../_lib/server/property-dashboard.loader';

interface PropertyBusinessDashboardProps {
  accountSlug: string;
  propertyCounts: PropertyStatusCounts;
  openMaintenanceJobs: number;
  openTasksCount: number;
  members: GroupMember[];
  recentTasks: GroupTask[];
  financesEnabled?: boolean;
  financeSummary?: FinanceDashboardSummary;
}

const panelClass =
  'rounded-[24px] border border-white/6 bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]';

const priorityColour: Record<string, string> = {
  urgent: 'bg-rose-500/15 text-rose-300',
  high: 'bg-orange-500/15 text-orange-300',
  medium: 'bg-amber-500/15 text-amber-300',
  low: 'bg-sky-500/15 text-sky-300',
};

function accountPath(accountSlug: string, template: string) {
  return template.replace('[account]', accountSlug);
}

export function PropertyBusinessDashboard({
  accountSlug,
  propertyCounts,
  openMaintenanceJobs,
  openTasksCount,
  members,
  recentTasks,
  financesEnabled = false,
  financeSummary,
}: PropertyBusinessDashboardProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'members'>('tasks');

  const statCards = [
    {
      label: 'Total Properties',
      value: propertyCounts.total,
      icon: Building2,
      colour: 'text-[#5eead4]',
      bg: 'bg-[#2A9D8F]/15',
    },
    {
      label: 'Active',
      value: propertyCounts.active,
      icon: Building2,
      colour: 'text-[#5eead4]',
      bg: 'bg-[var(--keel-teal)]/15',
    },
    {
      label: 'Vacant',
      value: propertyCounts.vacant,
      icon: Building2,
      colour: 'text-amber-400',
      bg: 'bg-amber-500/15',
    },
    {
      label: 'Open Maintenance',
      value: openMaintenanceJobs,
      icon: Wrench,
      colour: 'text-orange-400',
      bg: 'bg-orange-500/15',
    },
    {
      label: 'Open Tasks',
      value: openTasksCount,
      icon: CheckSquare,
      colour: 'text-sky-400',
      bg: 'bg-sky-500/15',
    },
    {
      label: 'Team Members',
      value: members.length,
      icon: Users,
      colour: 'text-zinc-300',
      bg: 'bg-white/8',
    },
  ];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((c) => (
          <Card key={c.label} className={panelClass}>
            <CardContent className="p-3">
              <div
                className={`mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg ${c.bg}`}
              >
                <c.icon className={`h-3.5 w-3.5 ${c.colour}`} />
              </div>
              <p className="text-xl font-bold tracking-tight text-white">
                {c.value}
              </p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/45">
                {c.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className={`grid gap-3 ${financesEnabled ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
        <ShortcutCard
          href={accountPath(accountSlug, pathsConfig.app.accountProperties)}
          icon={Building2}
          title="Properties"
          description="Manage your property portfolio"
          accent="teal"
        />
        <ShortcutCard
          href={accountPath(accountSlug, pathsConfig.app.accountClients)}
          icon={UserRound}
          title="Tenants"
          description="Active tenancies and contacts"
          accent="emerald"
        />
        <ShortcutCard
          href={accountPath(accountSlug, pathsConfig.app.accountJobs)}
          icon={Wrench}
          title="Maintenance"
          description="Open jobs and work orders"
          accent="orange"
        />
        {financesEnabled ? (
          <ShortcutCard
            href={accountPath(accountSlug, pathsConfig.app.accountFinances)}
            icon={Wallet}
            title="Finances"
            description="Income, expenses, and FreeAgent sync"
            accent="teal"
          />
        ) : null}
      </div>

      {financesEnabled && financeSummary ? (
        <FinanceOverviewPanel
          accountSlug={accountSlug}
          summary={financeSummary}
        />
      ) : null}

      <Card className={panelClass}>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        >
          <CardHeader className="border-b border-white/6 pb-0 pt-4">
            <TabsList className="h-10 w-full justify-start rounded-none border-0 bg-transparent p-0 md:w-auto">
              <TabsTrigger
                value="tasks"
                className="rounded-t-lg data-[state=active]:border-b-2 data-[state=active]:border-[#2A9D8F] data-[state=active]:bg-transparent data-[state=active]:text-[#5eead4]"
              >
                Tasks
              </TabsTrigger>
              <TabsTrigger
                value="members"
                className="rounded-t-lg data-[state=active]:border-b-2 data-[state=active]:border-[#2A9D8F] data-[state=active]:bg-transparent data-[state=active]:text-[#5eead4]"
              >
                Members
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="p-4">
            <TabsContent value="tasks" className="mt-0">
              <TasksPanel tasks={recentTasks} accountSlug={accountSlug} />
            </TabsContent>
            <TabsContent value="members" className="mt-0">
              <MembersPanel members={members} />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}

function FinanceOverviewPanel({
  accountSlug,
  summary,
}: {
  accountSlug: string;
  summary: FinanceDashboardSummary;
}) {
  const financesPath = accountPath(accountSlug, pathsConfig.app.accountFinances);

  return (
    <Card className={panelClass}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-white/6 pb-4">
        <div>
          <CardTitle className="text-base font-semibold text-white">
            Finances this month
          </CardTitle>
          <p className="mt-1 text-xs text-white/45">
            {summary.hasFinanceData
              ? 'Track income and expenses — connect FreeAgent for automatic sync'
              : 'Import transactions or connect FreeAgent to get started'}
          </p>
        </div>
        <Link
          href={financesPath}
          className="text-xs font-medium text-[#5eead4] hover:underline"
        >
          Open finances →
        </Link>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <FinanceStatCard
            label="Income"
            value={formatCurrency(summary.financeIncomePence / 100)}
            icon={TrendingUp}
            tone="teal"
          />
          <FinanceStatCard
            label="Expenses"
            value={formatCurrency(summary.financeExpensePence / 100)}
            icon={TrendingDown}
            tone="amber"
          />
          <FinanceStatCard
            label="Net"
            value={formatCurrency(summary.financeNetPence / 100)}
            icon={Wallet}
            tone={summary.financeNetPence >= 0 ? 'teal' : 'rose'}
          />
        </div>
        {summary.financeTrend.length > 0 ? (
          <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
            <FinanceTrendBarChart data={summary.financeTrend} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 py-8 text-center">
            <Wallet className="mx-auto mb-2 h-8 w-8 text-white/20" />
            <p className="text-sm text-white/40">No transactions yet</p>
            <Link
              href={financesPath}
              className="mt-2 inline-block text-xs text-[#5eead4] hover:underline"
            >
              Set up finances or connect FreeAgent
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FinanceStatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'teal' | 'amber' | 'rose';
}) {
  const styles = {
    teal: { bg: 'bg-[#2A9D8F]/15', text: 'text-[#5eead4]' },
    amber: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
    rose: { bg: 'bg-rose-500/15', text: 'text-rose-300' },
  }[tone];

  return (
    <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${styles.bg}`}
        >
          <Icon className={`h-3.5 w-3.5 ${styles.text}`} />
        </span>
        <p className="text-[10px] font-medium uppercase tracking-wide text-white/45">
          {label}
        </p>
      </div>
      <p className="text-lg font-bold tracking-tight text-white">{value}</p>
    </div>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function ShortcutCard({
  href,
  icon: Icon,
  title,
  description,
  accent,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: 'teal' | 'emerald' | 'orange';
}) {
  const styles = {
    teal: { bg: 'bg-[#2A9D8F]/15', text: 'text-[#5eead4]' },
    emerald: { bg: 'bg-[var(--keel-teal)]/15', text: 'text-[#5eead4]' },
    orange: { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  }[accent];

  return (
    <Link href={href}>
      <Card className={`${panelClass} transition hover:border-[#2A9D8F]/25`}>
        <CardContent className="flex items-center gap-3 p-4">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles.bg}`}
          >
            <Icon className={`h-5 w-5 ${styles.text}`} />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="text-xs text-white/50">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function TasksPanel({
  tasks,
  accountSlug,
}: {
  tasks: GroupTask[];
  accountSlug: string;
}) {
  if (tasks.length === 0) {
    return (
      <div className="py-8 text-center">
        <CheckSquare className="mx-auto mb-2 h-8 w-8 text-white/20" />
        <p className="text-sm text-white/40">No open tasks</p>
      </div>
    );
  }

  const tasksPath = accountPath(accountSlug, pathsConfig.app.accountTasks);

  return (
    <div className="space-y-2">
      {tasks.slice(0, 8).map((task) => (
        <div
          key={task.id}
          className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="truncate text-sm text-white/80">{task.title}</p>
            {task.projectName ? (
              <p className="text-xs text-white/40">{task.projectName}</p>
            ) : null}
          </div>
          <div className="ml-3 flex flex-shrink-0 items-center gap-2">
            {task.dueDate ? (
              <span className="text-xs text-white/40">{task.dueDate}</span>
            ) : null}
            <Badge
              className={`text-[10px] ${priorityColour[task.priority] ?? 'bg-white/10 text-white/50'}`}
            >
              {task.priority}
            </Badge>
          </div>
        </div>
      ))}
      {tasks.length > 8 ? (
        <Link
          href={tasksPath}
          className="block pt-1 text-center text-xs text-white/40 hover:text-[#5eead4]"
        >
          View all tasks →
        </Link>
      ) : null}
    </div>
  );
}

function MembersPanel({ members }: { members: GroupMember[] }) {
  if (members.length === 0) {
    return (
      <div className="py-8 text-center">
        <Users className="mx-auto mb-2 h-8 w-8 text-white/20" />
        <p className="text-sm text-white/40">No team members yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5"
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#2A9D8F]/20 text-xs font-semibold text-[#5eead4]">
            {m.displayName.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm text-white/80">{m.displayName}</p>
            {m.email ? (
              <p className="truncate text-xs text-white/40">{m.email}</p>
            ) : null}
          </div>
          <span className="ml-auto flex-shrink-0 text-xs capitalize text-white/40">
            {m.role}
          </span>
        </div>
      ))}
    </div>
  );
}
