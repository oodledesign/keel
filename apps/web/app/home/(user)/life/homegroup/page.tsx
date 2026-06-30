'use client';

import { useState } from 'react';

import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Users,
} from 'lucide-react';

const ACCENT = '#D97706';

type Task = {
  id: string;
  title: string;
  category: string;
  assignedTo: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  dueDate: string;
};

const PLACEHOLDER_TASKS: Task[] = [
  { id: '1', title: 'Prep discussion notes for Wednesday', category: 'Study', assignedTo: 'Dan', priority: 'medium', status: 'pending', dueDate: 'Wed' },
  { id: '2', title: 'Bring snacks for this week', category: 'Hosting', assignedTo: 'Shared', priority: 'low', status: 'pending', dueDate: 'Wed' },
  { id: '3', title: 'Email prayer requests to group', category: 'Admin', assignedTo: 'Dan', priority: 'low', status: 'pending', dueDate: 'Tue' },
  { id: '4', title: 'Set up chairs and space', category: 'Hosting', assignedTo: 'Dan', priority: 'low', status: 'pending', dueDate: 'Wed' },
  { id: '5', title: 'Print study guide — week 4', category: 'Study', assignedTo: 'Dan', priority: 'medium', status: 'completed', dueDate: 'Last Wed' },
];

const UPCOMING = [
  { date: 'Wed 13 Mar', title: 'Weekly meeting — Romans ch.8', location: 'Our house' },
  { date: 'Wed 20 Mar', title: 'Weekly meeting — Romans ch.9', location: "James & Sophie's" },
  { date: 'Sat 29 Mar', title: 'Social evening — board games', location: 'TBD' },
];

const MEMBERS = [
  { name: 'Dan & Wife', role: 'Leader' },
  { name: 'James & Sophie', role: 'Member' },
  { name: 'Tom & Emily', role: 'Member' },
  { name: 'Sarah', role: 'Member' },
  { name: 'Mark & Grace', role: 'Member' },
];

const statusIcons = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
} as const;

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_12px_36px_rgba(4,10,24,0.18)]';

export default function HomegroupPage() {
  const [showCompleted, setShowCompleted] = useState(false);

  const active = PLACEHOLDER_TASKS.filter((t) => t.status !== 'completed');
  const completed = PLACEHOLDER_TASKS.filter((t) => t.status === 'completed');
  const tasks = showCompleted ? completed : active;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 bg-transparent px-4 pb-12 pt-6 text-[var(--workspace-shell-text)] md:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Homegroup</h1>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">{active.length} tasks · {MEMBERS.length} members</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium text-[var(--workspace-shell-text)] shadow-sm hover:opacity-90"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus className="h-4 w-4" />
          Add Task
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        <div className="flex flex-col gap-6">
          {/* Tasks */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--workspace-shell-text-muted)]">Tasks</h2>
              <div className="flex rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-1 text-xs">
                <button type="button" onClick={() => setShowCompleted(false)} className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${!showCompleted ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]' : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'}`}>Active</button>
                <button type="button" onClick={() => setShowCompleted(true)} className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${showCompleted ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]' : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'}`}>Done</button>
              </div>
            </div>
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-6 py-12 text-center text-sm text-[var(--workspace-shell-text-muted)]">
                  {showCompleted ? 'No completed tasks' : 'Nothing to do — enjoy the rest!'}
                </div>
              ) : (
                tasks.map((task) => {
                  const StatusIcon = statusIcons[task.status];
                  return (
                    <div key={task.id} className="flex items-start gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-3 transition-colors hover:border-[color:var(--workspace-shell-border)]">
                      <span className="mt-0.5 shrink-0">
                        {task.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-[var(--ozer-accent-muted)]" /> : <StatusIcon className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-[var(--workspace-shell-text-muted)] line-through' : 'text-[var(--workspace-shell-text)]'}`}>{task.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />
                            {task.category}
                          </span>
                          <span>{task.dueDate}</span>
                          <span className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[11px]">{task.assignedTo}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Upcoming */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--workspace-shell-text-muted)]">
              <CalendarDays className="h-4 w-4" style={{ color: ACCENT }} />
              Upcoming
            </h2>
            <div className={panelClass}>
              <div className="divide-y divide-white/6">
                {UPCOMING.map((event) => (
                  <div key={event.date} className="px-5 py-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[var(--workspace-shell-text)]">{event.title}</p>
                      <span className="text-xs text-[var(--workspace-shell-text-muted)]">{event.date}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">{event.location}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Members sidebar */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--workspace-shell-text-muted)]">
            <Users className="h-4 w-4" style={{ color: ACCENT }} />
            Members
          </h2>
          <div className={panelClass}>
            <div className="divide-y divide-white/6">
              {MEMBERS.map((m) => (
                <div key={m.name} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-[var(--workspace-shell-text)]">{m.name}</span>
                  <span className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[11px] text-[var(--workspace-shell-text-muted)]">{m.role}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
