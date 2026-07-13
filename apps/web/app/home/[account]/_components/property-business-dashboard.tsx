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
import { workspaceIconChip, workspacePanelCard } from '~/lib/workspace-ui';

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

const panelClass = workspacePanelCard;

const iconChip = workspaceIconChip;

const priorityColour: Record<string, string> = {
  urgent: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  high: 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]',
  medium: 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
  low: 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]/50',
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
    },
    {
      label: 'Active',
      value: propertyCounts.active,
      icon: Building2,
    },
    {
      label: 'Vacant',
      value: propertyCounts.vacant,
      icon: Building2,
    },
    {
      label: 'Open Maintenance',
      value: openMaintenanceJobs,
      icon: Wrench,
    },
    {
      label: 'Open Tasks',
      value: openTasksCount,
      icon: CheckSquare,
    },
    {
      label: 'Team Members',
      value: members.length,
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((c) => (
          <Card key={c.label} className={panelClass}>
            <CardContent className="p-3">
              <div
                className={`mb-1.5 flex h-7 w-7 items-center justify-center rounded-md ${iconChip}`}
              >
                <c.icon className="h-3.5 w-3.5" />
              </div>
              <p className="text-xl font-bold tracking-tight text-[var(--workspace-shell-text)]">
                {c.value}
              </p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--workspace-shell-text)]/45">
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
        />
        <ShortcutCard
          href={accountPath(accountSlug, pathsConfig.app.accountClients)}
          icon={UserRound}
          title="Tenants"
          description="Active tenancies and contacts"
        />
        <ShortcutCard
          href={accountPath(accountSlug, pathsConfig.app.accountJobs)}
          icon={Wrench}
          title="Maintenance"
          description="Open jobs and work orders"
        />
        {financesEnabled ? (
          <ShortcutCard
            href={accountPath(accountSlug, pathsConfig.app.accountFinances)}
            icon={Wallet}
            title="Finances"
            description="Income, expenses, and FreeAgent sync"
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
          <CardHeader className="border-b border-[color:var(--workspace-shell-border)] pb-0 pt-4">
            <TabsList className="h-10 w-full justify-start rounded-none border-0 bg-transparent p-0 md:w-auto">
              <TabsTrigger
                value="tasks"
                className="rounded-t-lg data-[state=active]:border-b-2 data-[state=active]:border-[var(--ozer-accent)] data-[state=active]:bg-transparent data-[state=active]:text-[var(--ozer-accent-muted)]"
              >
                Tasks
              </TabsTrigger>
              <TabsTrigger
                value="members"
                className="rounded-t-lg data-[state=active]:border-b-2 data-[state=active]:border-[var(--ozer-accent)] data-[state=active]:bg-transparent data-[state=active]:text-[var(--ozer-accent-muted)]"
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
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-[color:var(--workspace-shell-border)] pb-4">
        <div>
          <CardTitle className="text-base font-semibold text-[var(--workspace-shell-text)]">
            Finances this month
          </CardTitle>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text)]/45">
            {summary.hasFinanceData
              ? 'Track income and expenses — connect FreeAgent for automatic sync'
              : 'Import transactions or connect FreeAgent to get started'}
          </p>
        </div>
        <Link
          href={financesPath}
          className="text-xs font-medium text-[var(--ozer-accent-muted)] hover:underline"
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
          />
          <FinanceStatCard
            label="Expenses"
            value={formatCurrency(summary.financeExpensePence / 100)}
            icon={TrendingDown}
          />
          <FinanceStatCard
            label="Net"
            value={formatCurrency(summary.financeNetPence / 100)}
            icon={Wallet}
            muted={summary.financeNetPence < 0}
          />
        </div>
        {summary.financeTrend.length > 0 ? (
          <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
            <FinanceTrendBarChart data={summary.financeTrend} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] py-8 text-center">
            <Wallet className="mx-auto mb-2 h-8 w-8 text-[var(--workspace-shell-text)]/20" />
            <p className="text-sm text-[var(--workspace-shell-text)]/40">No transactions yet</p>
            <Link
              href={financesPath}
              className="mt-2 inline-block text-xs text-[var(--ozer-accent-muted)] hover:underline"
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
  muted = false,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-md ${iconChip}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--workspace-shell-text)]/45">
          {label}
        </p>
      </div>
      <p
        className={`text-lg font-bold tracking-tight ${
          muted
            ? 'text-[var(--workspace-shell-text-muted)]'
            : 'text-[var(--workspace-shell-text)]'
        }`}
      >
        {value}
      </p>
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
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className={`${panelClass} transition hover:border-[var(--ozer-accent)]/25`}>
        <CardContent className="flex items-center gap-3 p-4">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconChip}`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">{title}</p>
            <p className="text-xs text-[var(--workspace-shell-text)]/50">{description}</p>
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
        <CheckSquare className="mx-auto mb-2 h-8 w-8 text-[var(--workspace-shell-text)]/20" />
        <p className="text-sm text-[var(--workspace-shell-text)]/40">No open tasks</p>
      </div>
    );
  }

  const tasksPath = accountPath(accountSlug, pathsConfig.app.accountTasks);

  return (
    <div className="space-y-2">
      {tasks.slice(0, 8).map((task) => (
        <div
          key={task.id}
          className="flex items-center justify-between rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="truncate text-sm text-[var(--workspace-shell-text)]/80">{task.title}</p>
            {task.projectName ? (
              <p className="text-xs text-[var(--workspace-shell-text)]/40">{task.projectName}</p>
            ) : null}
          </div>
          <div className="ml-3 flex flex-shrink-0 items-center gap-2">
            {task.dueDate ? (
              <span className="text-xs text-[var(--workspace-shell-text)]/40">{task.dueDate}</span>
            ) : null}
            <Badge
              className={`text-[10px] ${priorityColour[task.priority] ?? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]/50'}`}
            >
              {task.priority}
            </Badge>
          </div>
        </div>
      ))}
      {tasks.length > 8 ? (
        <Link
          href={tasksPath}
          className="block pt-1 text-center text-xs text-[var(--workspace-shell-text)]/40 hover:text-[var(--ozer-accent-muted)]"
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
        <Users className="mx-auto mb-2 h-8 w-8 text-[var(--workspace-shell-text)]/20" />
        <p className="text-sm text-[var(--workspace-shell-text)]/40">No team members yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2.5"
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--ozer-accent-subtle)] text-xs font-semibold text-[var(--ozer-accent-muted)]">
            {m.displayName.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm text-[var(--workspace-shell-text)]/80">{m.displayName}</p>
            {m.email ? (
              <p className="truncate text-xs text-[var(--workspace-shell-text)]/40">{m.email}</p>
            ) : null}
          </div>
          <span className="ml-auto flex-shrink-0 text-xs capitalize text-[var(--workspace-shell-text)]/40">
            {m.role}
          </span>
        </div>
      ))}
    </div>
  );
}
