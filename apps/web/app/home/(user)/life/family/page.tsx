'use client';

import { useState } from 'react';

import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  ShoppingCart,
  UtensilsCrossed,
} from 'lucide-react';

const ACCENT = '#059669';

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
  { id: '1', title: 'Meal prep — Sunday lunch', category: 'Meals', assignedTo: 'Dan', priority: 'medium', status: 'pending', dueDate: 'Sun' },
  { id: '2', title: 'Book dentist for kids', category: 'Health', assignedTo: 'Dan', priority: 'low', status: 'pending', dueDate: 'This week' },
  { id: '3', title: 'Grocery shop — midweek top-up', category: 'Shopping', assignedTo: 'Shared', priority: 'medium', status: 'pending', dueDate: 'Wed' },
  { id: '4', title: 'Plan meal for Thursday guests', category: 'Meals', assignedTo: 'Shared', priority: 'medium', status: 'pending', dueDate: 'Wed' },
  { id: '5', title: 'Renew car insurance', category: 'Admin', assignedTo: 'Dan', priority: 'high', status: 'in_progress', dueDate: 'Fri' },
  { id: '6', title: 'Kids swimming lesson — pack bags', category: 'Activities', assignedTo: 'Shared', priority: 'low', status: 'completed', dueDate: 'Today' },
];

const MEAL_PLAN = [
  { day: 'Mon', meal: 'Chicken stir fry' },
  { day: 'Tue', meal: 'Spaghetti bolognese' },
  { day: 'Wed', meal: 'Fish & chips' },
  { day: 'Thu', meal: 'Guest dinner — roast lamb' },
  { day: 'Fri', meal: 'Pizza night' },
  { day: 'Sat', meal: 'Leftovers / takeaway' },
  { day: 'Sun', meal: 'Sunday roast' },
];

const statusIcons = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
} as const;

const panelClass =
  'rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)] shadow-[0_12px_36px_rgba(4,10,24,0.18)]';

export default function FamilyPage() {
  const [showCompleted, setShowCompleted] = useState(false);

  const active = PLACEHOLDER_TASKS.filter((t) => t.status !== 'completed');
  const completed = PLACEHOLDER_TASKS.filter((t) => t.status === 'completed');
  const tasks = showCompleted ? completed : active;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 bg-transparent px-4 pb-12 pt-6 text-white md:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Family</h1>
          <p className="mt-1 text-sm text-zinc-400">Shared tasks with your household</p>
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

      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
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
                {showCompleted ? 'No completed tasks' : 'All done — enjoy the time together!'}
              </div>
            ) : (
              tasks.map((task) => {
                const StatusIcon = statusIcons[task.status];
                return (
                  <div key={task.id} className="flex items-start gap-3 rounded-xl border border-white/6 bg-[var(--workspace-shell-panel)] px-4 py-3 transition-colors hover:border-white/10">
                    <span className="mt-0.5 shrink-0">
                      {task.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <StatusIcon className="h-4 w-4 text-zinc-500" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-zinc-500 line-through' : 'text-white'}`}>{task.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />
                          {task.category}
                        </span>
                        <span>{task.dueDate}</span>
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px]">{task.assignedTo}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Meal plan sidebar */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
            <UtensilsCrossed className="h-4 w-4" style={{ color: ACCENT }} />
            Meal Plan
          </h2>
          <div className={panelClass}>
            <div className="divide-y divide-white/6">
              {MEAL_PLAN.map((m) => (
                <div key={m.day} className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs font-semibold text-zinc-400 w-10">{m.day}</span>
                  <span className="flex-1 text-sm text-white">{m.meal}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
