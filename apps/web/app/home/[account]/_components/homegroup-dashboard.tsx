'use client';

import { useState } from 'react';

import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Clock,
  StickyNote,
  Users,
} from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';

import { isCalendarOverdueYmd } from '../../_lib/due-date-ymd';
import type {
  CommunityDashboardData,
  CommunityNextSession,
} from '../_lib/server/community-dashboard.loader';
import type { GroupMember, GroupTask } from '../_lib/server/group-dashboard.loader';

const panelClass =
  'rounded-[24px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]';

type HomegroupDashboardProps = CommunityDashboardData;

function accountPath(account: string, template: string) {
  return template.replace('[account]', account);
}

export function HomegroupDashboard({
  accountSlug,
  openTasksCount,
  upcomingSessionsCount,
  membersCount,
  overdueCount,
  recentTasks,
  members,
  nextSession,
}: HomegroupDashboardProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'members'>('tasks');

  const tasksPath = accountPath(
    accountSlug,
    pathsConfig.app.accountCommunityTasks,
  );
  const schedulePath = accountPath(
    accountSlug,
    pathsConfig.app.accountCommunitySchedule,
  );
  const notesPath = accountPath(accountSlug, pathsConfig.app.accountNotes);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 bg-[radial-gradient(circle_at_18%_0%,rgba(251,191,36,0.09),transparent_35%),radial-gradient(circle_at_82%_6%,rgba(245,158,11,0.08),transparent_40%)] px-4 pb-10 pt-5 text-[var(--workspace-shell-text)] md:px-6 lg:px-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open Tasks"
          value={openTasksCount.toString()}
          helper="Open across your group"
          tone="amber"
          icon={CheckSquare}
        />
        <StatCard
          label="Upcoming Sessions"
          value={upcomingSessionsCount.toString()}
          helper="Scheduled on the calendar"
          tone="orange"
          icon={CalendarClock}
        />
        <StatCard
          label="Members"
          value={membersCount.toString()}
          helper="Group members"
          tone="sky"
          icon={Users}
        />
        <StatCard
          label="Overdue"
          value={overdueCount.toString()}
          helper="Tasks past due date"
          tone={overdueCount > 0 ? 'rose' : 'muted'}
          icon={Clock}
        />
      </div>

      <Card className={panelClass}>
        <CardHeader className="border-b border-[color:var(--workspace-shell-border)] pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base font-semibold text-[var(--workspace-shell-text)]">
              Group Overview
            </CardTitle>
            <div className="flex gap-2 text-xs">
              <TabButton
                active={activeTab === 'tasks'}
                onClick={() => setActiveTab('tasks')}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Tasks
              </TabButton>
              <TabButton
                active={activeTab === 'members'}
                onClick={() => setActiveTab('members')}
              >
                <Users className="h-3.5 w-3.5" />
                Members
              </TabButton>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          {activeTab === 'tasks' && (
            <TasksPanel tasks={recentTasks} tasksPath={tasksPath} />
          )}
          {activeTab === 'members' && <MembersPanel members={members} />}

          <NextSessionCard
            session={nextSession}
            schedulePath={schedulePath}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between rounded-2xl border border-amber-400/15 bg-[var(--workspace-shell-panel)] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
            <StickyNote className="h-4.5 w-4.5 text-amber-400" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">Group Notes</p>
            <p className="text-xs text-[var(--workspace-shell-text)]/50">
              Shared notes for your homegroup
            </p>
          </div>
        </div>
        <a
          href={notesPath}
          className="rounded-lg border border-amber-400/30 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/25"
        >
          View notes →
        </a>
      </div>
    </div>
  );
}

function NextSessionCard({
  session,
  schedulePath,
}: {
  session: CommunityNextSession | null;
  schedulePath: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-400/15 bg-[var(--workspace-shell-canvas)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/80">
          Next session
        </p>
        <a
          href={schedulePath}
          className="text-xs font-medium text-amber-300 hover:underline"
        >
          View schedule →
        </a>
      </div>
      {!session ? (
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          No upcoming sessions.{' '}
          <a
            href={`${schedulePath}?create=session`}
            className="font-medium text-amber-300 hover:underline"
          >
            Schedule one
          </a>
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-base font-semibold text-[var(--workspace-shell-text)]">{session.title}</p>
          <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--workspace-shell-text)]/70">
            <Calendar className="h-3.5 w-3.5 text-amber-400/80" />
            <span>{session.dateLabel}</span>
            <span className="text-[var(--workspace-shell-text)]/30">·</span>
            <span>{session.timeLabel}</span>
          </p>
          {session.location ? (
            <p className="text-xs text-[var(--workspace-shell-text)]/50">{session.location}</p>
          ) : null}
          {session.sessionNotes ? (
            <p className="text-sm leading-relaxed text-[var(--workspace-shell-text)]/60">
              {session.sessionNotes}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors ${
        active
          ? 'border border-amber-400/50 bg-amber-500/20 text-amber-200'
          : 'border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]/60 hover:text-[var(--workspace-shell-text)]'
      }`}
    >
      {children}
    </button>
  );
}

function TasksPanel({
  tasks,
  tasksPath,
}: {
  tasks: GroupTask[];
  tasksPath: string;
}) {
  if (tasks.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-[var(--workspace-shell-text)]/50">
        No open tasks yet.{' '}
        <a
          href={`${tasksPath}?create=task`}
          className="font-medium text-amber-300 hover:underline"
        >
          Create a task
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const overdue =
          task.dueDate != null && isCalendarOverdueYmd(task.dueDate);

        return (
          <div
            key={task.id}
            className={`flex flex-col gap-1.5 rounded-xl border px-4 py-3 text-sm md:flex-row md:items-center md:justify-between ${
              overdue
                ? 'border-rose-400/25 bg-rose-500/5'
                : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)]'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-[var(--workspace-shell-text)]">{task.title}</p>
              {task.projectName ? (
                <p className="mt-0.5 text-xs text-[var(--workspace-shell-text)]/50">
                  {task.projectName}
                </p>
              ) : null}
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              {task.dueDate ? (
                <span
                  className={`inline-flex items-center gap-1 text-xs ${
                    overdue ? 'text-rose-300' : 'text-[var(--workspace-shell-text)]/50'
                  }`}
                >
                  <Calendar className="h-3 w-3" />
                  {formatDate(task.dueDate)}
                  {overdue ? ' · Overdue' : ''}
                </span>
              ) : null}
              <Badge
                className="border-0 bg-amber-500/15 text-[11px] font-medium text-amber-300"
                variant="outline"
              >
                {formatPriority(task.priority)}
              </Badge>
              <TaskStatusBadge status={task.status} />
            </div>
          </div>
        );
      })}
      <div className="pt-2 text-center">
        <a
          href={tasksPath}
          className="text-xs font-medium text-amber-300 hover:underline"
        >
          View all tasks →
        </a>
      </div>
    </div>
  );
}

function MembersPanel({ members }: { members: GroupMember[] }) {
  if (members.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-[var(--workspace-shell-text)]/50">
        No members yet. Invite members to get started.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-4 py-3"
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-semibold text-amber-300">
            {getInitials(member.displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
              {member.displayName}
            </p>
            <p className="truncate text-xs text-[var(--workspace-shell-text)]/50">
              {member.email ?? formatRole(member.role)}
            </p>
          </div>
          <span className="text-xs capitalize text-[var(--workspace-shell-text)]/40">
            {formatRole(member.role)}
          </span>
        </div>
      ))}
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
  tone: 'amber' | 'orange' | 'sky' | 'rose' | 'muted';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneBg: Record<typeof tone, string> = {
    amber: 'bg-amber-500/15',
    orange: 'bg-orange-500/12',
    sky: 'bg-sky-500/10',
    rose: 'bg-rose-500/15',
    muted: 'bg-[var(--workspace-shell-sidebar-accent)]',
  };
  const toneText: Record<typeof tone, string> = {
    amber: 'text-amber-400',
    orange: 'text-orange-400',
    sky: 'text-sky-400',
    rose: 'text-rose-400',
    muted: 'text-[var(--workspace-shell-text)]/30',
  };

  return (
    <Card className={`${panelClass} overflow-hidden`}>
      <CardContent className="flex flex-col gap-2 p-5 md:p-6">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneBg[tone]} ${toneText[tone]}`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--workspace-shell-text)]/50">
            {label}
          </p>
        </div>
        <p className="text-2xl font-semibold tracking-tight md:text-3xl">
          {value}
        </p>
        <p className="text-xs text-[var(--workspace-shell-text)]/40">{helper}</p>
      </CardContent>
    </Card>
  );
}

function TaskStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    todo: { bg: 'bg-[var(--workspace-shell-sidebar-accent)]', text: 'text-[var(--workspace-shell-text)]/50', label: 'To do' },
    in_progress: {
      bg: 'bg-sky-500/15',
      text: 'text-sky-300',
      label: 'In progress',
    },
    done: { bg: 'bg-[var(--ozer-accent-subtle)]', text: 'text-[var(--ozer-accent-muted)]', label: 'Done' },
    blocked: { bg: 'bg-rose-500/15', text: 'text-rose-300', label: 'Blocked' },
  };
  const style = map[status] ?? map.todo;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
    >
      {style.label ?? status}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

function formatPriority(priority: string): string {
  const map: Record<string, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
  };
  return map[priority] ?? priority;
}

function formatRole(role: string): string {
  const map: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
    client: 'Client',
  };
  return map[role] ?? role;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
