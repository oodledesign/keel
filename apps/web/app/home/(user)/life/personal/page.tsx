'use client';

import { useState } from 'react';

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Heart,
  Plus,
  Sparkles,
  Target,
} from 'lucide-react';

const ACCENT = '#7C3AED';

type Task = {
  id: string;
  title: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  dueDate: string;
};

const PLACEHOLDER_TASKS: Task[] = [
  { id: '1', title: 'Journal — weekly reflection', category: 'Reflection', priority: 'low', status: 'pending', dueDate: 'Sun' },
  { id: '2', title: 'Run 5k', category: 'Health', priority: 'medium', status: 'pending', dueDate: 'Sat' },
  { id: '3', title: 'Read 30 pages of current book', category: 'Learning', priority: 'low', status: 'pending', dueDate: 'This week' },
  { id: '4', title: 'Plan next week — time blocking', category: 'Productivity', priority: 'medium', status: 'pending', dueDate: 'Sun' },
  { id: '5', title: 'Meditate — 10 mins', category: 'Wellbeing', priority: 'low', status: 'completed', dueDate: 'Today' },
  { id: '6', title: 'Write down 3 dream ideas', category: 'Dreams', priority: 'low', status: 'pending', dueDate: 'This week' },
];

const GOALS = [
  { title: 'Run 100km this month', progress: 42, icon: Target },
  { title: 'Read 2 books this month', progress: 65, icon: BookOpen },
  { title: 'Journal 5 days a week', progress: 80, icon: Sparkles },
];

const statusIcons = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
} as const;

const priorityConfig = {
  low: { label: 'Low', className: 'text-zinc-400' },
  medium: { label: 'Med', className: 'text-blue-400' },
  high: { label: 'High', className: 'text-amber-400' },
  urgent: { label: 'Urgent', className: 'text-rose-400' },
};

const panelClass =
  'rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)] shadow-[0_12px_36px_rgba(4,10,24,0.18)]';

export default function PersonalPage() {
  const [showCompleted, setShowCompleted] = useState(false);

  const active = PLACEHOLDER_TASKS.filter((t) => t.status !== 'completed');
  const completed = PLACEHOLDER_TASKS.filter((t) => t.status === 'completed');
  const tasks = showCompleted ? completed : active;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 bg-transparent px-4 pb-12 pt-6 text-white md:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Personal</h1>
          <p className="mt-1 text-sm text-zinc-400">{active.length} tasks this week</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium text-white shadow-sm hover:opacity-90"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus className="h-4 w-4" />
          Add Task
        </button>
      </div>

      {/* Goals */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Goals</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {GOALS.map((goal) => (
            <div key={goal.title} className={panelClass}>
              <div className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${ACCENT}22`, color: ACCENT }}>
                    <goal.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-medium text-white">{goal.title}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full transition-all" style={{ width: `${goal.progress}%`, backgroundColor: ACCENT }} />
                </div>
                <p className="mt-2 text-xs text-zinc-400">{goal.progress}% complete</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tasks */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300">Tasks</h2>
          <div className="flex rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] p-1 text-xs">
            <button type="button" onClick={() => setShowCompleted(false)} className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${!showCompleted ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}>Active</button>
            <button type="button" onClick={() => setShowCompleted(true)} className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${showCompleted ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}>Done</button>
          </div>
        </div>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/8 px-6 py-12 text-center text-sm text-zinc-500">
              {showCompleted ? 'No completed tasks' : 'All done — nice work!'}
            </div>
          ) : (
            tasks.map((task) => {
              const StatusIcon = statusIcons[task.status];
              const pCfg = priorityConfig[task.priority];
              return (
                <div key={task.id} className="flex items-start gap-3 rounded-xl border border-white/6 bg-[var(--workspace-shell-panel)] px-4 py-3 transition-colors hover:border-white/10">
                  <span className="mt-0.5 shrink-0">
                    {task.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <StatusIcon className="h-4 w-4 text-zinc-500" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-zinc-500 line-through' : 'text-white'}`}>{task.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />{task.category}</span>
                      <span>{task.dueDate}</span>
                      {task.priority !== 'low' && <span className={`font-medium ${pCfg.className}`}>{pCfg.label}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
