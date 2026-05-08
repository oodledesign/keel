'use client';

import { useState } from 'react';

import Link from 'next/link';

import {
  Building2,
  CheckSquare,
  ClipboardList,
  Users,
  Wrench,
} from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import type { GroupMember, GroupTask } from '../_lib/server/group-dashboard.loader';
import type { PropertyStatusCounts } from '../_lib/server/property-dashboard.loader';

interface PropertyBusinessDashboardProps {
  accountSlug: string;
  accountId: string;
  propertyCounts: PropertyStatusCounts;
  members: GroupMember[];
  recentTasks: GroupTask[];
}

const panelClass =
  'rounded-[24px] border border-white/6 bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]';

const statCards = (
  propertyCounts: PropertyStatusCounts,
  openTasks: number,
  memberCount: number,
) => [
  {
    label: 'Total Properties',
    value: propertyCounts.total,
    icon: Building2,
    colour: 'text-violet-400',
    bg: 'bg-violet-500/15',
  },
  {
    label: 'Active',
    value: propertyCounts.active,
    icon: Building2,
    colour: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
  },
  {
    label: 'Vacant',
    value: propertyCounts.vacant,
    icon: ClipboardList,
    colour: 'text-amber-400',
    bg: 'bg-amber-500/15',
  },
  {
    label: 'Open Tasks',
    value: openTasks,
    icon: CheckSquare,
    colour: 'text-sky-400',
    bg: 'bg-sky-500/15',
  },
  {
    label: 'Maintenance',
    value: propertyCounts.maintenance,
    icon: Wrench,
    colour: 'text-orange-400',
    bg: 'bg-orange-500/15',
  },
  {
    label: 'Team Members',
    value: memberCount,
    icon: Users,
    colour: 'text-indigo-400',
    bg: 'bg-indigo-500/15',
  },
];

const priorityColour: Record<string, string> = {
  urgent: 'bg-rose-500/15 text-rose-300',
  high: 'bg-orange-500/15 text-orange-300',
  medium: 'bg-amber-500/15 text-amber-300',
  low: 'bg-sky-500/15 text-sky-300',
};

export function PropertyBusinessDashboard({
  accountSlug,
  propertyCounts,
  members,
  recentTasks,
}: PropertyBusinessDashboardProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'members'>('tasks');

  const openTasks = recentTasks.filter((t) => t.status !== 'done').length;
  const cards = statCards(propertyCounts, openTasks, members.length);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label} className={panelClass}>
            <CardContent className="p-4">
              <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${c.bg}`}>
                <c.icon className={`h-4 w-4 ${c.colour}`} />
              </div>
              <p className="text-2xl font-bold text-white">{c.value}</p>
              <p className="mt-0.5 text-xs text-white/50">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink
          href={`/app/work/${accountSlug}/properties`}
          icon={Building2}
          label="View Properties"
          description="Manage your property portfolio"
          colour="violet"
        />
        <QuickLink
          href={`/app/work/${accountSlug}/jobs`}
          icon={ClipboardList}
          label="Jobs"
          description="Active maintenance & work orders"
          colour="sky"
        />
        <QuickLink
          href={`/app/work/${accountSlug}/clients`}
          icon={Users}
          label="Clients & Tenants"
          description="Owners, tenants, and contacts"
          colour="emerald"
        />
      </div>

      {/* Tasks / Members tabs */}
      <Card className={panelClass}>
        <CardHeader className="border-b border-white/6 pb-0">
          <div className="flex gap-1">
            {(['tasks', 'members'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-t-lg px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 border-violet-400 text-violet-300'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {activeTab === 'tasks' && (
            <TasksPanel tasks={recentTasks} accountSlug={accountSlug} />
          )}
          {activeTab === 'members' && <MembersPanel members={members} />}
        </CardContent>
      </Card>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  description,
  colour,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  colour: 'violet' | 'sky' | 'emerald';
}) {
  const bg =
    colour === 'violet'
      ? 'bg-violet-500/15'
      : colour === 'sky'
        ? 'bg-sky-500/15'
        : 'bg-emerald-500/15';
  const text =
    colour === 'violet'
      ? 'text-violet-400'
      : colour === 'sky'
        ? 'text-sky-400'
        : 'text-emerald-400';

  return (
    <Link href={href}>
      <Card className={`${panelClass} transition-all hover:border-white/10`}>
        <CardContent className="flex items-center gap-3 p-4">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
            <Icon className={`h-5 w-5 ${text}`} />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{label}</p>
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

  return (
    <div className="space-y-2">
      {tasks.slice(0, 8).map((task) => (
        <div
          key={task.id}
          className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="truncate text-sm text-white/80">{task.title}</p>
            {task.projectName && (
              <p className="text-xs text-white/40">{task.projectName}</p>
            )}
          </div>
          <div className="ml-3 flex flex-shrink-0 items-center gap-2">
            {task.dueDate && (
              <span className="text-xs text-white/40">{task.dueDate}</span>
            )}
            <Badge
              className={`text-[10px] ${priorityColour[task.priority] ?? 'bg-white/10 text-white/50'}`}
            >
              {task.priority}
            </Badge>
          </div>
        </div>
      ))}
      {tasks.length > 8 && (
        <Link
          href={`/app/work/${accountSlug}/tasks`}
          className="block pt-1 text-center text-xs text-white/40 hover:text-white/70"
        >
          View all {tasks.length} tasks →
        </Link>
      )}
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
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-semibold text-violet-300">
            {m.displayName.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm text-white/80">{m.displayName}</p>
            {m.email && (
              <p className="truncate text-xs text-white/40">{m.email}</p>
            )}
          </div>
          <span className="ml-auto flex-shrink-0 text-xs capitalize text-white/40">
            {m.role}
          </span>
        </div>
      ))}
    </div>
  );
}
