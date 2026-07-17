'use client';

import Link from 'next/link';

import { Calendar, CheckSquare, Clock, Sparkles, Users } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

import type {
  FamilyCalendarEventItem,
  FamilyDashboardData,
  FamilyMealPlanDay,
  FamilyUpcomingTask,
} from '../_lib/server/family-dashboard.loader';

const panelClass =
  'rounded-[24px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]';

function accountPath(accountSlug: string, template: string) {
  return template.replace('[account]', accountSlug);
}

type FamilyDashboardProps = Pick<
  FamilyDashboardData,
  | 'accountSlug'
  | 'openTasksCount'
  | 'upcomingPlansCount'
  | 'familyMembersCount'
  | 'overdueCount'
  | 'upcomingTasks'
  | 'weekMealPlan'
  | 'upcomingEvents'
>;

export function FamilyDashboard({
  accountSlug,
  openTasksCount,
  upcomingPlansCount,
  familyMembersCount,
  overdueCount,
  upcomingTasks,
  weekMealPlan,
  upcomingEvents,
}: FamilyDashboardProps) {
  const tasksPath = accountPath(
    accountSlug,
    pathsConfig.app.accountCommunityTasks,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 bg-[radial-gradient(circle_at_18%_0%,rgba(52,211,153,0.10),transparent_35%),radial-gradient(circle_at_82%_6%,rgba(16,185,129,0.08),transparent_40%)] px-4 pt-5 pb-10 text-[var(--workspace-shell-text)] md:px-6 lg:px-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open Tasks"
          value={openTasksCount}
          icon={CheckSquare}
          tone="emerald"
        />
        <StatCard
          label="Upcoming Plans"
          value={upcomingPlansCount}
          icon={Sparkles}
          tone="teal"
        />
        <StatCard
          label="Family Members"
          value={familyMembersCount}
          icon={Users}
          tone="sky"
        />
        <StatCard
          label="Overdue"
          value={overdueCount}
          icon={Clock}
          tone={overdueCount > 0 ? 'rose' : 'muted'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={panelClass}>
          <CardHeader className="border-b border-[color:var(--workspace-shell-border)] pb-4">
            <CardTitle className="text-base font-semibold text-[var(--workspace-shell-text)]">
              Upcoming tasks
            </CardTitle>
            <p className="text-xs text-emerald-200/60">Next 7 days</p>
          </CardHeader>
          <CardContent className="pt-4">
            <UpcomingTasksPanel tasks={upcomingTasks} tasksPath={tasksPath} />
          </CardContent>
        </Card>

        <Card className={panelClass}>
          <CardHeader className="border-b border-[color:var(--workspace-shell-border)] pb-4">
            <CardTitle className="text-base font-semibold text-[var(--workspace-shell-text)]">
              This week&apos;s meal plan
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <MealPlanWeek days={weekMealPlan} accountSlug={accountSlug} />
          </CardContent>
        </Card>
      </div>

      <Card className={panelClass}>
        <CardHeader className="border-b border-[color:var(--workspace-shell-border)] pb-4">
          <CardTitle className="text-base font-semibold text-[var(--workspace-shell-text)]">
            Upcoming calendar events
          </CardTitle>
          <p className="text-xs text-emerald-200/60">Next 14 days</p>
        </CardHeader>
        <CardContent className="pt-4">
          <EventsPanel
            events={upcomingEvents}
            calendarPath={accountPath(
              accountSlug,
              pathsConfig.app.accountFamilyCalendar,
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'emerald' | 'teal' | 'sky' | 'rose' | 'muted';
}) {
  const toneBg = {
    emerald: 'bg-[var(--ozer-accent-subtle)]',
    teal: 'bg-teal-500/12',
    sky: 'bg-sky-500/10',
    rose: 'bg-rose-500/15',
    muted: 'bg-[var(--workspace-shell-sidebar-accent)]',
  }[tone];
  const toneText = {
    emerald: 'text-[var(--ozer-accent-muted)]',
    teal: 'text-teal-400',
    sky: 'text-sky-400',
    rose: 'text-rose-400',
    muted: 'text-[var(--workspace-shell-text)]/40',
  }[tone];

  return (
    <Card className={`${panelClass} overflow-hidden`}>
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneBg}`}
          >
            <Icon className={`h-4 w-4 ${toneText}`} />
          </span>
          <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text)]/50 uppercase">
            {label}
          </p>
        </div>
        <p className="text-2xl font-semibold tracking-tight md:text-3xl">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function UpcomingTasksPanel({
  tasks,
  tasksPath,
}: {
  tasks: FamilyUpcomingTask[];
  tasksPath: string;
}) {
  if (tasks.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--workspace-shell-text)]/45">
        Nothing due in the next week.{' '}
        <Link
          href={tasksPath}
          className="text-[var(--ozer-accent-muted)] hover:underline"
        >
          Add a task
        </Link>
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="flex items-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-3 py-2.5"
        >
          <AssigneeAvatar assignee={task.assignee} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
              {task.title}
            </p>
            {task.planName ? (
              <p className="truncate text-xs text-[var(--workspace-shell-text)]/45">
                {task.planName}
              </p>
            ) : null}
          </div>
          {task.dueLabel ? (
            <span className="shrink-0 text-xs text-[var(--workspace-shell-text)]/50">
              {task.dueLabel}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function AssigneeAvatar({
  assignee,
}: {
  assignee: FamilyUpcomingTask['assignee'];
}) {
  if (!assignee) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--workspace-shell-sidebar-accent)] text-[10px] text-[var(--workspace-shell-text)]/30">
        —
      </span>
    );
  }

  if (assignee.avatarUrl) {
    return (
      <img
        src={assignee.avatarUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/10"
      />
    );
  }

  const initials = assignee.displayName
    .split(' ')
    .map((n) => n[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ozer-accent-subtle)] text-xs font-semibold text-emerald-200"
      title={assignee.displayName}
    >
      {initials}
    </span>
  );
}

function MealPlanWeek({
  days,
  accountSlug,
}: {
  days: FamilyMealPlanDay[];
  accountSlug: string;
}) {
  const mealPath = accountPath(accountSlug, pathsConfig.app.accountMealPlan);

  return (
    <ul className="space-y-2">
      {days.map((day) => (
        <li
          key={day.planDate}
          className="flex items-start justify-between gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-3 py-2.5"
        >
          <span className="w-10 shrink-0 text-xs font-semibold text-[var(--ozer-accent-muted)]/90 uppercase">
            {day.dayLabel}
          </span>
          <p
            className={cn(
              'min-w-0 flex-1 text-sm',
              day.summary
                ? 'text-[var(--workspace-shell-text)]/85'
                : 'text-[var(--workspace-shell-text)]/35 italic',
            )}
          >
            {day.summary ?? 'Not planned yet'}
          </p>
        </li>
      ))}
      <li className="pt-1 text-center">
        <Link
          href={mealPath}
          className="text-xs font-medium text-[var(--ozer-accent-muted)]/80 hover:text-[var(--ozer-accent-muted)] hover:underline"
        >
          Edit meal plan →
        </Link>
      </li>
    </ul>
  );
}

function EventsPanel({
  events,
  calendarPath,
}: {
  events: FamilyCalendarEventItem[];
  calendarPath: string;
}) {
  if (events.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--workspace-shell-text)]/45">
        No events in the next two weeks.{' '}
        <Link
          href={calendarPath}
          className="text-[var(--ozer-accent-muted)] hover:underline"
        >
          Open calendar
        </Link>
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {events.map((event) => (
        <li
          key={event.id}
          className="flex items-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-3 py-2.5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ozer-accent-subtle)]">
            <Calendar className="h-4 w-4 text-[var(--ozer-accent-muted)]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
              {event.title}
            </p>
            <p className="text-xs text-[var(--workspace-shell-text)]/45">
              {event.dateLabel}
            </p>
          </div>
          <span className="shrink-0 text-xs text-[var(--workspace-shell-text)]/50">
            {event.timeLabel}
          </span>
        </li>
      ))}
    </ul>
  );
}
