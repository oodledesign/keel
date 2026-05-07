'use client';

import { useState } from 'react';

import {
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Folder,
  Users,
} from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import type { GroupMember, GroupProject, GroupTask } from '../_lib/server/group-dashboard.loader';

interface FamilyDashboardProps {
  accountSlug: string;
  accountId: string;
  projects: GroupProject[];
  members: GroupMember[];
  recentTasks: GroupTask[];
}

const panelClass =
  'rounded-[24px] border border-white/6 bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]';

export function FamilyDashboard({
  accountSlug,
  projects,
  members,
  recentTasks,
}: FamilyDashboardProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'members'>('tasks');

  const totalOpenTasks = projects.reduce((sum, p) => sum + p.openTaskCount, 0);
  const overdueCount = recentTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date(),
  ).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 bg-[radial-gradient(circle_at_18%_0%,rgba(52,211,153,0.10),transparent_35%),radial-gradient(circle_at_82%_6%,rgba(16,185,129,0.09),transparent_40%)] px-4 pb-10 pt-5 text-white md:px-6 lg:px-8">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open Tasks"
          value={totalOpenTasks.toString()}
          helper={`Across ${projects.length} projects`}
          tone="emerald"
          icon={CheckSquare}
        />
        <StatCard
          label="Projects"
          value={projects.length.toString()}
          helper="Active family projects"
          tone="teal"
          icon={Folder}
        />
        <StatCard
          label="Members"
          value={members.length.toString()}
          helper="Family members"
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

      {/* Projects */}
      {projects.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-emerald-200/80 uppercase tracking-wide">
            Projects
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between rounded-2xl border border-emerald-400/15 bg-[var(--workspace-shell-panel)] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15">
                    <Folder className="h-4 w-4 text-emerald-400" />
                  </span>
                  <p className="text-sm font-medium text-white">{project.name}</p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  {project.openTaskCount} open
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks + Members tab panel */}
      <Card className={panelClass}>
        <CardHeader className="border-b border-white/6 pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base font-semibold text-white">
              Family Overview
            </CardTitle>
            <div className="flex gap-2 text-xs">
              <TabButton
                active={activeTab === 'tasks'}
                onClick={() => setActiveTab('tasks')}
                tone="emerald"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Tasks
              </TabButton>
              <TabButton
                active={activeTab === 'members'}
                onClick={() => setActiveTab('members')}
                tone="emerald"
              >
                <Users className="h-3.5 w-3.5" />
                Members
              </TabButton>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {activeTab === 'tasks' && (
            <TasksPanel tasks={recentTasks} accountSlug={accountSlug} tone="emerald" />
          )}
          {activeTab === 'members' && (
            <MembersPanel members={members} tone="emerald" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: 'emerald' | 'amber';
  children: React.ReactNode;
}) {
  const toneActive = tone === 'emerald'
    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/50'
    : 'bg-amber-500/20 text-amber-200 border border-amber-400/50';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors ${
        active
          ? toneActive
          : 'border border-white/10 bg-[var(--workspace-shell-panel)] text-white/60 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function TasksPanel({
  tasks,
  accountSlug,
  tone,
}: {
  tasks: GroupTask[];
  accountSlug: string;
  tone: 'emerald' | 'amber';
}) {
  const accentText = tone === 'emerald' ? 'text-emerald-300' : 'text-amber-300';
  const accentBg = tone === 'emerald' ? 'bg-emerald-500/15' : 'bg-amber-500/15';

  if (tasks.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-white/50">
        No open tasks yet.{' '}
        <a
          href={`/home/${accountSlug}/community/tasks`}
          className={`font-medium ${accentText} hover:underline`}
        >
          Create a task
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex flex-col gap-1.5 rounded-xl border border-white/6 bg-[var(--workspace-shell-canvas)] px-4 py-3 text-sm md:flex-row md:items-center md:justify-between"
        >
          <div className="flex-1 min-w-0">
            <p className="truncate font-medium text-white">{task.title}</p>
            {task.projectName && (
              <p className="mt-0.5 text-xs text-white/50">{task.projectName}</p>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {task.dueDate && (
              <span className="inline-flex items-center gap-1 text-xs text-white/50">
                <Calendar className="h-3 w-3" />
                {formatDate(task.dueDate)}
              </span>
            )}
            <Badge
              className={`text-[11px] font-medium ${accentBg} ${accentText} border-0`}
              variant="outline"
            >
              {formatPriority(task.priority)}
            </Badge>
            <TaskStatusBadge status={task.status} />
          </div>
        </div>
      ))}
      <div className="pt-2 text-center">
        <a
          href={`/home/${accountSlug}/community/tasks`}
          className={`text-xs font-medium ${accentText} hover:underline`}
        >
          View all tasks →
        </a>
      </div>
    </div>
  );
}

function MembersPanel({
  members,
  tone,
}: {
  members: GroupMember[];
  tone: 'emerald' | 'amber';
}) {
  const accentBg = tone === 'emerald' ? 'bg-emerald-500/15' : 'bg-amber-500/15';
  const accentText = tone === 'emerald' ? 'text-emerald-300' : 'text-amber-300';

  if (members.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-white/50">
        No members yet. Invite family members to get started.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center gap-3 rounded-xl border border-white/6 bg-[var(--workspace-shell-canvas)] px-4 py-3"
        >
          <span
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${accentBg} ${accentText}`}
          >
            {getInitials(member.displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {member.displayName}
            </p>
            <p className="truncate text-xs text-white/50">
              {member.email ?? formatRole(member.role)}
            </p>
          </div>
          <span className="text-xs text-white/40 capitalize">{formatRole(member.role)}</span>
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
  tone: 'emerald' | 'teal' | 'sky' | 'rose' | 'muted';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneBg: Record<typeof tone, string> = {
    emerald: 'bg-emerald-500/15',
    teal: 'bg-teal-500/12',
    sky: 'bg-sky-500/10',
    rose: 'bg-rose-500/15',
    muted: 'bg-white/5',
  };
  const toneText: Record<typeof tone, string> = {
    emerald: 'text-emerald-400',
    teal: 'text-teal-400',
    sky: 'text-sky-400',
    rose: 'text-rose-400',
    muted: 'text-white/30',
  };

  return (
    <Card className={`${panelClass} overflow-hidden`}>
      <CardContent className="flex flex-col gap-2 p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneBg[tone]} ${toneText[tone]}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <p className="text-xs font-medium uppercase tracking-wide text-white/50">
              {label}
            </p>
          </div>
        </div>
        <p className="text-2xl font-semibold tracking-tight md:text-3xl">{value}</p>
        <p className="text-xs text-white/40">{helper}</p>
      </CardContent>
    </Card>
  );
}

function TaskStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    todo: { bg: 'bg-white/5', text: 'text-white/50', label: 'To do' },
    in_progress: { bg: 'bg-sky-500/15', text: 'text-sky-300', label: 'In progress' },
    done: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', label: 'Done' },
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
