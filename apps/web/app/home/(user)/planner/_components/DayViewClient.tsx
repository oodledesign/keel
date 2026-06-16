'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

import Link from 'next/link';

import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  Coffee,
  Plus,
  Sparkles,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { workspacePageMainClassName } from '~/components/workspace-shell/workspace-shell-styles';
import type { PlannerCalendarEvent } from '~/lib/integrations/google-calendar/types';
import { parseDayScheduleFromMarkdown } from '~/lib/planner/parse-plan-markdown';
import {
  loadStoredPlan,
  pickBestPlanMarkdown,
  toLocalDateYmd,
} from '~/lib/planner/plan-storage';
import type {
  DayViewData,
  DayViewPipeline,
  PlannerTask,
} from '~/lib/planner/types';

import { createTask, updateTask } from '../../_lib/actions/task-actions';
import { PlannerRemindersToggle } from './PlannerRemindersToggle';
import { PlannerViewTabs } from './PlannerViewTabs';
import { ReplanDialog } from './ReplanDialog';
import { SopSuggestionsStrip } from './SopSuggestionsStrip';

type Props = {
  initialData: DayViewData;
  dayViewHref: string;
};

type DisplayBlock = {
  key: string;
  start: string;
  end: string;
  title: string;
  isCalendarEvent: boolean;
  isBreak: boolean;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
}

function blockStatus(
  block: DisplayBlock,
  now: Date,
): 'past' | 'current' | 'upcoming' {
  const t = now.getTime();
  if (t >= new Date(block.end).getTime()) return 'past';
  if (t >= new Date(block.start).getTime()) return 'current';
  return 'upcoming';
}

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

export function DayViewClient({ initialData, dayViewHref }: Props) {
  const dateYmd = toLocalDateYmd();
  const [planMarkdown, setPlanMarkdown] = useState(
    initialData.planMarkdown ?? '',
  );
  const [calendarEvents, setCalendarEvents] = useState<PlannerCalendarEvent[]>(
    [],
  );
  const [tasks, setTasks] = useState<PlannerTask[]>(
    initialData.tasksDueToday,
  );
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Merge server-saved plan with localStorage — prefer whichever parses more blocks
  // (covers stale DB copies and plans saved before server persistence existed).
  useEffect(() => {
    const stored = loadStoredPlan(initialData.scope, dateYmd);
    setPlanMarkdown(
      pickBestPlanMarkdown(
        initialData.planMarkdown,
        initialData.planUpdatedAt,
        stored,
        dateYmd,
      ),
    );
  }, [
    initialData.planMarkdown,
    initialData.planUpdatedAt,
    initialData.scope,
    dateYmd,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadCalendar() {
      try {
        const response = await fetch(
          `/api/planner/calendar?mode=day&date=${encodeURIComponent(new Date().toISOString())}`,
        );
        const body = (await response.json()) as {
          events?: PlannerCalendarEvent[];
        };
        if (!cancelled) {
          setCalendarEvents(body.events ?? []);
        }
      } catch {
        if (!cancelled) setCalendarEvents([]);
      }
    }

    void loadCalendar();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayBlocks = useMemo<DisplayBlock[]>(() => {
    const planBlocks = parseDayScheduleFromMarkdown(
      planMarkdown,
      new Date().toISOString(),
    ).map((block, index) => ({
      key: `plan-${index}-${block.start}`,
      start: block.start,
      end: block.end,
      title: block.title,
      isCalendarEvent: block.isCalendarEvent,
      isBreak: block.isBreak,
    }));

    if (planBlocks.length > 0) return planBlocks;

    return calendarEvents.map((event) => ({
      key: event.id,
      start: event.start,
      end: event.end,
      title: event.title,
      isCalendarEvent: true,
      isBreak: false,
    }));
  }, [planMarkdown, calendarEvents]);

  const currentBlock = displayBlocks.find(
    (block) => blockStatus(block, now) === 'current',
  );
  const nextBlock = displayBlocks.find(
    (block) => new Date(block.start).getTime() > now.getTime(),
  );

  const hasPlan = planMarkdown.trim().length > 0;
  const openTasks = tasks.filter((task) => task.status !== 'completed');
  const doneTasks = tasks.filter((task) => task.status === 'completed');

  const replanOpenTasks = useMemo(() => {
    const completedIds = new Set(
      tasks.filter((task) => task.status === 'completed').map((task) => task.id),
    );
    const byId = new Map<string, PlannerTask>();

    for (const task of initialData.openTasksForReplan) {
      if (!completedIds.has(task.id)) {
        byId.set(task.id, task);
      }
    }

    for (const task of tasks) {
      if (task.status !== 'completed') {
        byId.set(task.id, task);
      }
    }

    return [...byId.values()];
  }, [initialData.openTasksForReplan, tasks]);

  async function toggleTask(task: PlannerTask) {
    const completing = task.status !== 'completed';
    const nextStatus = completing ? 'completed' : 'pending';

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)),
    );

    const result = await updateTask(task.id, { status: nextStatus });

    if (!result.success) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)),
      );
      toast.error(result.error ?? 'Could not update task');
    }
  }

  async function addTask(event: FormEvent) {
    event.preventDefault();
    const title = newTaskTitle.trim();
    if (!title || isAddingTask) return;

    setIsAddingTask(true);
    try {
      const result = await createTask({
        title,
        priority: 'medium',
        dueDate: dateYmd,
      });

      if (!result.success || !result.id) {
        toast.error(result.error ?? 'Could not add task');
        return;
      }

      setTasks((prev) => [
        ...prev,
        {
          id: result.id as string,
          title,
          project: 'No project',
          workspace: 'Personal',
          workspaceSlug: null,
          priority: 'medium',
          status: 'pending',
          estimated_duration_minutes: null,
          due_date: dateYmd,
          dueDateLabel: 'Today',
          notes: null,
          overdue: false,
          context: 'life',
        },
      ]);
      setNewTaskTitle('');
    } finally {
      setIsAddingTask(false);
    }
  }

  const dateLabel = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className={workspacePageMainClassName}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Today</h1>
          <p className="mt-1 text-sm text-white/55" suppressHydrationWarning>
            {initialData.scope.kind === 'workspace'
              ? `${initialData.scope.accountName} — ${dateLabel}`
              : dateLabel}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <PlannerViewTabs
            dayHref={dayViewHref}
            planHref={initialData.planViewHref}
            active="day"
          />
          <PlannerRemindersToggle />
        </div>
      </header>

      <NowBar
        now={now}
        currentBlock={currentBlock}
        nextBlock={nextBlock}
        hasSchedule={displayBlocks.length > 0}
        planHref={initialData.planViewHref}
      />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white/80">Schedule</h2>
            <ReplanDialog
              scope={initialData.scope}
              planMarkdown={planMarkdown}
              openTasks={replanOpenTasks}
              calendarEvents={calendarEvents}
              onPlanUpdated={setPlanMarkdown}
            />
          </div>
          {displayBlocks.length === 0 ? (
            <EmptySchedule planHref={initialData.planViewHref} />
          ) : (
            <div className="space-y-2">
              {displayBlocks.map((block) => (
                <ScheduleRow
                  key={block.key}
                  block={block}
                  status={blockStatus(block, now)}
                />
              ))}
            </div>
          )}
          {hasPlan && displayBlocks.length === 0 ? (
            <p className="text-xs text-white/40">
              A plan exists for today but no time blocks could be read from it.
            </p>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white/80">Due today</h2>
            <span className="text-xs text-white/40">
              {openTasks.length} open
              {doneTasks.length > 0 ? ` · ${doneTasks.length} done` : ''}
            </span>
          </div>

          <form onSubmit={addTask} className="flex items-center gap-2">
            <input
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              placeholder="Add a task for today…"
              className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/30 focus:border-[#2A9D8F]/60 focus:outline-none"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newTaskTitle.trim() || isAddingTask}
              className="h-9 shrink-0 bg-[var(--keel-teal)] hover:bg-[#238b7f]"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>

          {tasks.length === 0 ? (
            <p className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/45">
              Nothing due today.
            </p>
          ) : (
            <ul className="space-y-2">
              {[...openTasks, ...doneTasks].map((task) => (
                <TaskRow key={task.id} task={task} onToggle={toggleTask} />
              ))}
            </ul>
          )}
        </section>
      </div>

      {initialData.pipeline ? (
        <PipelineOverview pipeline={initialData.pipeline} />
      ) : null}

      <SopSuggestionsStrip suggestions={initialData.sopSuggestions} />

      {!initialData.includeWorkspaceTasks ? (
        <p className="text-center text-xs text-white/35">
          Workspace tasks hidden —{' '}
          <Link
            href={initialData.settingsHref}
            className="text-[#2A9D8F] hover:underline"
          >
            change in settings
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function NowBar({
  now,
  currentBlock,
  nextBlock,
  hasSchedule,
  planHref,
}: {
  now: Date;
  currentBlock: DisplayBlock | undefined;
  nextBlock: DisplayBlock | undefined;
  hasSchedule: boolean;
  planHref: string;
}) {
  const clock = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-[var(--workspace-shell-panel)] px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
      <span
        className="font-mono text-3xl font-semibold tabular-nums text-white"
        suppressHydrationWarning
      >
        {clock}
      </span>
      <span className="hidden h-10 w-px bg-white/10 sm:block" />
      <div className="min-w-0 flex-1 space-y-1" suppressHydrationWarning>
        {hasSchedule ? (
          <>
            <p className="truncate text-sm">
              <span className="font-semibold uppercase tracking-wide text-[10px] text-[#5eead4]">
                Now
              </span>{' '}
              <span className="font-medium text-white">
                {currentBlock
                  ? currentBlock.title
                  : nextBlock
                    ? 'Free until next block'
                    : 'Done for the day'}
              </span>
              {currentBlock ? (
                <span className="text-white/40">
                  {' '}
                  · until {formatTime(currentBlock.end)}
                </span>
              ) : null}
            </p>
            <p className="truncate text-sm text-white/55">
              <span className="font-semibold uppercase tracking-wide text-[10px] text-white/35">
                Next
              </span>{' '}
              {nextBlock
                ? `${nextBlock.title} · ${formatTime(nextBlock.start)}`
                : 'Nothing else scheduled'}
            </p>
          </>
        ) : (
          <p className="text-sm text-white/55">
            No schedule yet —{' '}
            <Link href={planHref} className="text-[#2A9D8F] hover:underline">
              plan your day
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

function ScheduleRow({
  block,
  status,
}: {
  block: DisplayBlock;
  status: 'past' | 'current' | 'upcoming';
}) {
  const Icon = block.isBreak ? Coffee : CalendarClock;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
        block.isCalendarEvent
          ? 'border-sky-400/15 bg-sky-400/10'
          : block.isBreak
            ? 'border-dashed border-white/8 bg-white/[0.015]'
            : 'border-white/8 bg-[var(--workspace-shell-panel)]',
        status === 'current' &&
          'border-[#2A9D8F]/50 bg-[#2A9D8F]/10 ring-1 ring-[#2A9D8F]/30',
        status === 'past' && 'opacity-45',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          block.isCalendarEvent
            ? 'text-sky-300/80'
            : block.isBreak
              ? 'text-white/30'
              : 'text-[#5eead4]',
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs text-white/45">
          {formatTime(block.start)} – {formatTime(block.end)}
        </p>
        <p
          className={cn(
            'mt-0.5 text-sm font-medium',
            block.isBreak ? 'italic text-white/45' : 'text-white',
          )}
        >
          {block.title}
        </p>
      </div>
      {status === 'current' ? (
        <span className="mt-0.5 shrink-0 rounded-full bg-[#2A9D8F]/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5eead4]">
          Now
        </span>
      ) : null}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
}: {
  task: PlannerTask;
  onToggle: (task: PlannerTask) => void;
}) {
  const done = task.status === 'completed';

  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] px-4 py-3',
        done && 'opacity-55',
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(task)}
        aria-label={done ? 'Mark as not done' : 'Mark as done'}
        className="mt-0.5 shrink-0 text-white/30 transition-colors hover:text-[#5eead4]"
      >
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-[#2A9D8F]" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm font-medium text-white',
            done && 'line-through decoration-white/40',
          )}
        >
          {task.title}
        </p>
        <p className="mt-0.5 text-xs text-white/45">
          {task.workspace}
          {task.project !== 'No project' ? ` · ${task.project}` : ''}
        </p>
      </div>
    </li>
  );
}

const STAGE_DOT_COLORS: Record<string, string> = {
  lead: '#3B82F6',
  qualified: '#2A9D8F',
  call_booked: '#A855F7',
  proposal_sent: '#F97316',
  negotiation: '#EAB308',
};

function PipelineOverview({ pipeline }: { pipeline: DayViewPipeline }) {
  return (
    <section className="space-y-3 rounded-2xl border border-white/8 bg-[var(--workspace-shell-panel)] px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white/80">Pipeline</h2>
          <p className="mt-0.5 text-xs text-white/45">
            {pipeline.openCount} open deal{pipeline.openCount === 1 ? '' : 's'}{' '}
            · {gbp.format(pipeline.openValue)}
          </p>
        </div>
        <Link
          href={pipeline.href}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#2A9D8F] hover:underline"
        >
          Open pipeline
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {pipeline.stages.map((stage) => (
          <span
            key={stage.key}
            className="inline-flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.04] px-2.5 py-1.5 text-xs"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: STAGE_DOT_COLORS[stage.key] ?? '#64748B',
              }}
            />
            <span className="text-white/70">{stage.label}</span>
            <span className="font-semibold text-white">{stage.count}</span>
            {stage.value > 0 ? (
              <span className="text-white/40">{gbp.format(stage.value)}</span>
            ) : null}
          </span>
        ))}
      </div>

      {pipeline.needsAction.length > 0 ? (
        <div className="space-y-1.5 border-t border-white/6 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">
            Next actions due
          </p>
          <ul className="space-y-1.5">
            {pipeline.needsAction.map((deal) => (
              <li
                key={deal.id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-white">{deal.name}</span>
                  <span className="text-white/50"> — {deal.nextAction}</span>
                </span>
                <span
                  className={cn(
                    'shrink-0 text-xs',
                    deal.overdue ? 'text-rose-300' : 'text-white/45',
                  )}
                >
                  {deal.overdue ? 'Overdue' : 'Today'} · {deal.stageLabel}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function EmptySchedule({ planHref }: { planHref: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
      <Sparkles className="mx-auto h-6 w-6 text-[#5eead4]/70" />
      <p className="mt-3 text-sm text-white/60">No plan for today yet.</p>
      <Button asChild className="mt-4 bg-[var(--keel-teal)] hover:bg-[#238b7f]">
        <Link href={planHref}>Plan my day</Link>
      </Button>
    </div>
  );
}
