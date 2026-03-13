'use client';

import { useMemo } from 'react';

import {
  Briefcase,
  CheckSquare,
  Clock,
  Compass,
  Heart,
  Church,
  Inbox,
  TicketCheck,
  User,
} from 'lucide-react';

import type {
  KeelDashboardData,
  BusinessOverview,
  DashboardTask,
  PipelineDealToday,
  PipelineStageCount,
  LifeAreaGroup,
  ActivityItem,
} from '../../_lib/server/keel-dashboard.loader';

import { AddTaskDialog } from './add-task-dialog';
import { TaskListItem } from './task-list-item';

const BRAND = {
  family: '#059669',
  homegroup: '#D97706',
  personal: '#7C3AED',
} as const;

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  call_booked: 'Call Booked',
  proposal_sent: 'Proposal Sent',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

const LIFE_ICONS: Record<string, typeof Heart> = {
  Family: Heart,
  Homegroup: Church,
  Personal: User,
};

const LIFE_COLORS: Record<string, string> = {
  Family: BRAND.family,
  Homegroup: BRAND.homegroup,
  Personal: BRAND.personal,
};

type Props = { data: KeelDashboardData };

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

const panelClass =
  'rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)] shadow-[0_12px_36px_rgba(4,10,24,0.18)]';

export function KeelDashboard({ data }: Props) {
  const greeting = useMemo(() => getGreeting(), []);
  const dateStr = useMemo(() => formatDate(), []);
  const firstName = data.userName;

  const hasTodayItems =
    data.todayTasks.length > 0 || data.pipelineDealsToday.length > 0;
  const hasBusinesses = data.businesses.length > 0;
  const hasPipeline = data.pipelineSnapshot.some((s) => s.count > 0);
  const hasLifeTasks = data.lifeAreas.length > 0;
  const hasActivity = data.recentActivity.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 bg-transparent px-4 pb-12 pt-6 text-white md:px-6 lg:px-8">
      {/* ─── 1. Header / greeting ─────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            {dateStr}
          </p>
        </div>
        <AddTaskDialog />
      </div>

      {/* ─── 2. Today's focus ─────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          Today&apos;s Focus
        </h2>
        {hasTodayItems ? (
          <div className="space-y-2">
            {data.todayTasks.map((task) => (
              <TaskListItem
                key={task.id}
                title={task.title}
                project={task.projectName ?? undefined}
                area={task.areaName ?? undefined}
                dueDate="Today"
                priority={task.priority as any}
                status={task.status as any}
                accentColor={task.areaColor ?? undefined}
              />
            ))}
            {data.pipelineDealsToday.map((deal) => (
              <TaskListItem
                key={deal.id}
                title={`Follow up: ${deal.contactName} — ${deal.companyName}`}
                project={deal.businessName ?? undefined}
                dueDate="Today"
                priority="high"
                status="pending"
                accentColor={deal.businessColor ?? undefined}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CheckSquare}
            message="No tasks or deals due today. Enjoy the breathing room."
          />
        )}
      </section>

      {/* ─── 3. Work overview (business cards) ────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          Work Overview
        </h2>
        {hasBusinesses ? (
          <div className="grid gap-4 md:grid-cols-2">
            {data.businesses.map((biz) => (
              <BusinessCard key={biz.businessId} biz={biz} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Briefcase}
            message="No businesses set up yet. Create your first business to start tracking work."
          />
        )}
      </section>

      {/* ─── 4. Pipeline snapshot ─────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          Pipeline Snapshot
        </h2>
        {hasPipeline ? (
          <div className={`${panelClass} overflow-hidden`}>
            <div className="flex overflow-x-auto">
              {data.pipelineSnapshot.map((stage) => {
                const isWon = stage.stage === 'won';
                const isLost = stage.stage === 'lost';
                return (
                  <button
                    key={stage.stage}
                    type="button"
                    className="group flex min-w-[120px] flex-1 flex-col items-center gap-2 border-r border-white/6 px-4 py-5 transition-colors last:border-r-0 hover:bg-white/[0.03]"
                  >
                    <span
                      className={`text-2xl font-bold ${
                        isWon
                          ? 'text-emerald-400'
                          : isLost
                            ? 'text-zinc-500'
                            : 'text-white'
                      }`}
                    >
                      {stage.count}
                    </span>
                    <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-300">
                      {STAGE_LABELS[stage.stage] ?? stage.stage}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Compass}
            message="No pipeline deals yet. Add your first deal to start tracking your pipeline."
          />
        )}
      </section>

      {/* ─── 5. Life snapshot ─────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          Life This Week
        </h2>
        {hasLifeTasks ? (
          <div className="grid gap-6 md:grid-cols-3">
            {data.lifeAreas.map((area) => (
              <LifeGroup
                key={area.areaName}
                title={area.areaName}
                icon={LIFE_ICONS[area.areaName] ?? User}
                color={
                  area.areaColor ??
                  LIFE_COLORS[area.areaName] ??
                  BRAND.personal
                }
                tasks={area.tasks}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {(['Family', 'Homegroup', 'Personal'] as const).map((name) => (
              <LifeGroup
                key={name}
                title={name}
                icon={LIFE_ICONS[name]!}
                color={LIFE_COLORS[name]!}
                tasks={[]}
              />
            ))}
          </div>
        )}
      </section>

      {/* ─── 6. Recent activity ───────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          Recent Activity
        </h2>
        {hasActivity ? (
          <div className={panelClass}>
            <div className="divide-y divide-white/6">
              {data.recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 px-5 py-4"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-zinc-400">
                    <ActivityIcon type={item.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200">{item.description}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {item.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Clock}
            message="No recent activity. Things you do will show up here."
          />
        )}
      </section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case 'task_completed':
      return <CheckSquare className="h-3.5 w-3.5" />;
    case 'deal_moved':
      return <Compass className="h-3.5 w-3.5" />;
    case 'ticket_raised':
      return <TicketCheck className="h-3.5 w-3.5" />;
    default:
      return <Briefcase className="h-3.5 w-3.5" />;
  }
}

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: typeof Inbox;
  message: string;
}) {
  return (
    <div className={`${panelClass} flex flex-col items-center gap-3 px-6 py-10`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-zinc-500">
        <Icon className="h-5 w-5" />
      </span>
      <p className="max-w-xs text-center text-sm text-zinc-500">{message}</p>
    </div>
  );
}

function BusinessCard({ biz }: { biz: BusinessOverview }) {
  const color = biz.businessColor ?? '#4F46E5';

  return (
    <div className={panelClass}>
      <div className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${color}18`, color }}
          >
            <Briefcase className="h-[18px] w-[18px]" />
          </span>
          <h3 className="text-base font-semibold">{biz.businessName}</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="Active Projects" value={biz.activeProjects} />
          <MiniStat label="Open Tasks" value={biz.openTasks} />
          <MiniStat label="Open Tickets" value={biz.openTickets} />
          <MiniStat
            label="Pipeline"
            value={`${biz.activeDeals} deals`}
            subtitle={formatCurrency(biz.dealValue)}
          />
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-white/6 bg-[var(--workspace-shell-canvas)] px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
      {subtitle && (
        <p className="text-xs text-emerald-400">{subtitle}</p>
      )}
    </div>
  );
}

function LifeGroup({
  title,
  icon: Icon,
  color,
  tasks,
}: {
  title: string;
  icon: typeof Heart;
  color: string;
  tasks: DashboardTask[];
}) {
  return (
    <div className={panelClass}>
      <div className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}18`, color }}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-400">
            {tasks.length}
          </span>
        </div>

        {tasks.length === 0 ? (
          <p className="text-xs text-zinc-500">Nothing this week</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskListItem
                key={task.id}
                title={task.title}
                area={task.areaName ?? undefined}
                dueDate={task.dueDate ?? undefined}
                priority={task.priority as any}
                status={task.status as any}
                accentColor={task.areaColor ?? undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
