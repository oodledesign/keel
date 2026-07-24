'use client';

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ArrowLeft,
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
import { EditTaskDialog } from '~/home/(user)/tasks/_components/edit-task-dialog';
import type { PlannerCalendarEvent } from '~/lib/integrations/google-calendar/types';
import { plannerTaskMetaWithoutClient } from '~/lib/planner/build-task-tree';
import { parseDayScheduleFromMarkdown } from '~/lib/planner/parse-plan-markdown';
import { resolvePlannedTasks } from '~/lib/planner/planned-task-selection';
import { savePlannerPlanAction } from '~/lib/planner/plan-actions';
import {
  type PlanDocument,
  attachGoogleEventIdsToPlan,
  flattenPlanBlocks,
  parsePlanDocument,
  serializePlanDocument,
} from '~/lib/planner/plan-blocks';
import {
  applySyncMappingsToDocument,
  blocksForCalendarSync,
  planGainedGoogleIds,
} from '~/lib/planner/plan-calendar-sync';
import {
  dayViewHrefWithDate,
  loadStoredPlan,
  pickBestPlanMarkdown,
  plannerScopeKey,
  saveStoredPlan,
  shiftLocalDateYmd,
  toLocalDateYmd,
} from '~/lib/planner/plan-storage';
import { plannerTaskToPageTask } from '~/lib/planner/planner-task-to-page-task';
import { syncPlannerCalendarBlocks } from '~/lib/planner/sync-calendar-client';
import type {
  DayViewData,
  DayViewPipeline,
  PlannerTask,
} from '~/lib/planner/types';

import { createTask, updateTask } from '../../_lib/actions/task-actions';
import { DayScheduleEditor } from './DayScheduleEditor';
import { PlannerRemindersToggle } from './PlannerRemindersToggle';
import { PlannerViewTabs } from './PlannerViewTabs';
import { ReplanDialog } from './ReplanDialog';
import { SopSuggestionsStrip } from './SopSuggestionsStrip';
import { PlannerClientPill } from './planner-client-pill';
import { PlannerSyncCalendarButton } from './planner-push-to-calendar-button';

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
  const router = useRouter();
  const todayYmd = toLocalDateYmd();
  const dateYmd = initialData.viewDateYmd || todayYmd;
  const isViewingToday = dateYmd === todayYmd;
  const [planMarkdown, setPlanMarkdown] = useState(
    initialData.planMarkdown ?? '',
  );
  const [planDocument, setPlanDocument] = useState<PlanDocument | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<PlannerCalendarEvent[]>(
    [],
  );
  const [tasks, setTasks] = useState<PlannerTask[]>(initialData.tasksDueToday);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const workspaceAccountId =
    initialData.scope.kind === 'workspace'
      ? initialData.scope.accountId
      : undefined;

  useEffect(() => {
    setTasks(initialData.tasksDueToday);
  }, [initialData.tasksDueToday]);

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

  const persistPlanDocument = useCallback(
    async (document: PlanDocument) => {
      const markdown = serializePlanDocument(document);
      setPlanMarkdown(markdown);
      setPlanDocument(document);

      const existing = loadStoredPlan(initialData.scope, dateYmd);

      saveStoredPlan(initialData.scope, dateYmd, {
        markdown,
        updatedAt: new Date().toISOString(),
        mode: 'day',
        taskIds: existing?.taskIds,
        userContext: existing?.userContext,
      });

      const result = await savePlannerPlanAction({
        scopeKey: plannerScopeKey(initialData.scope),
        planDate: dateYmd,
        mode: 'day',
        markdown,
      });

      if (!result.success) {
        toast.error(
          result.error ??
            'Changes saved locally but could not sync to your account.',
        );
      }
    },
    [dateYmd, initialData.scope],
  );

  useEffect(() => {
    if (!planMarkdown.trim()) {
      setPlanDocument(null);
      return;
    }

    const dateIso = `${dateYmd}T12:00:00`;
    let doc = parsePlanDocument(planMarkdown);

    if (calendarEvents.length > 0) {
      const enriched = attachGoogleEventIdsToPlan(
        doc,
        calendarEvents.map((event) => ({
          id: event.id,
          title: event.title,
          start: event.start,
          calendarId: event.calendar_id,
        })),
        dateIso,
      );

      if (planGainedGoogleIds(doc, enriched)) {
        void persistPlanDocument(enriched);
        return;
      }

      doc = enriched;
    }

    setPlanDocument(doc);
  }, [calendarEvents, dateYmd, persistPlanDocument, planMarkdown]);

  const syncBlockToGoogle = useCallback(
    async (document: PlanDocument, blockId: string) => {
      const block = flattenPlanBlocks(document).find(
        (item) => item.id === blockId,
      );
      if (!block?.googleEventId) {
        return null;
      }

      const dateIso = `${dateYmd}T12:00:00`;
      const blocks = blocksForCalendarSync(document, dateIso).filter(
        (item) => item.blockId === blockId,
      );
      if (blocks.length === 0) {
        return null;
      }

      try {
        const result = await syncPlannerCalendarBlocks({
          date: dateIso,
          blocks,
        });
        if (result.errors.length > 0) {
          toast.message('Google Calendar could not update one or more events');
        }
        return applySyncMappingsToDocument(document, result.mappings);
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : 'Could not update Google Calendar',
        );
        return null;
      }
    },
    [dateYmd],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCalendar() {
      try {
        const response = await fetch(
          `/api/planner/calendar?mode=day&date=${encodeURIComponent(`${dateYmd}T12:00:00`)}`,
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
  }, [dateYmd]);

  const displayBlocks = useMemo<DisplayBlock[]>(() => {
    const dateIso = `${dateYmd}T12:00:00`;

    if (planDocument) {
      return flattenPlanBlocks(planDocument).map((block) => {
        const start = new Date(dateIso);
        const end = new Date(dateIso);
        start.setHours(
          Math.floor(block.startMinutes / 60),
          block.startMinutes % 60,
          0,
          0,
        );
        end.setHours(
          Math.floor(block.endMinutes / 60),
          block.endMinutes % 60,
          0,
          0,
        );

        return {
          key: block.id,
          start: start.toISOString(),
          end: end.toISOString(),
          title: block.title,
          isCalendarEvent: block.isCalendarEvent,
          isBreak: block.isBreak,
        };
      });
    }

    const planBlocks = parseDayScheduleFromMarkdown(planMarkdown, dateIso).map(
      (block, index) => ({
        key: `plan-${index}-${block.start}`,
        start: block.start,
        end: block.end,
        title: block.title,
        isCalendarEvent: block.isCalendarEvent,
        isBreak: block.isBreak,
      }),
    );

    if (planBlocks.length > 0) return planBlocks;

    return calendarEvents.map((event) => ({
      key: event.id,
      start: event.start,
      end: event.end,
      title: event.title,
      isCalendarEvent: true,
      isBreak: false,
    }));
  }, [calendarEvents, dateYmd, planDocument, planMarkdown]);

  const editablePlanBlocks = planDocument
    ? flattenPlanBlocks(planDocument)
    : [];
  const showEditableSchedule = editablePlanBlocks.length > 0;

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
    const stored = loadStoredPlan(initialData.scope, dateYmd);
    const pool = new Map<string, PlannerTask>();

    for (const task of initialData.openTasksForReplan) {
      pool.set(task.id, task);
    }

    for (const task of tasks) {
      pool.set(task.id, task);
    }

    return resolvePlannedTasks([...pool.values()], {
      storedTaskIds: stored?.taskIds,
      planMarkdown,
      dateIso: `${dateYmd}T12:00:00`,
    });
  }, [
    dateYmd,
    initialData.openTasksForReplan,
    initialData.scope,
    planMarkdown,
    tasks,
  ]);

  const replanUserContext = useMemo(() => {
    const stored = loadStoredPlan(initialData.scope, dateYmd);
    return stored?.userContext?.trim() ?? '';
  }, [dateYmd, initialData.scope, planMarkdown]);

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
          dueDateLabel: isViewingToday ? 'Today' : dateYmd,
          notes: null,
          overdue: false,
          context: 'life',
          clientId: null,
          projectId: null,
          areaId: null,
          parentTaskId: null,
          calendarScheduleStatus: null,
          clientName: null,
          accentColor: null,
          workspaceColor: null,
        },
      ]);
      setNewTaskTitle('');
    } finally {
      setIsAddingTask(false);
    }
  }

  const viewDate = useMemo(() => {
    const [y, m, d] = dateYmd.split('-').map(Number);
    return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  }, [dateYmd]);

  const dateLabel = viewDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const prevDayHref = dayViewHrefWithDate(
    dayViewHref,
    shiftLocalDateYmd(dateYmd, -1),
  );
  const nextDayHref = dayViewHrefWithDate(
    dayViewHref,
    shiftLocalDateYmd(dateYmd, 1),
  );
  const todayHref = dayViewHref;

  return (
    <div
      className={cn(
        workspacePageMainClassName,
        'gap-4 px-2.5 pt-1 pb-6 md:gap-5 md:px-6 md:pt-3 md:pb-12 lg:px-6',
      )}
    >
      <header className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
          aria-label="Previous day"
          onClick={() => router.push(prevDayHref)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1 overflow-hidden">
          <h1 className="truncate text-xl font-bold tracking-tight md:text-2xl">
            {isViewingToday ? 'Today' : dateLabel}
          </h1>
          <p
            className="truncate text-xs text-[var(--workspace-shell-text)]/55 md:text-sm"
            suppressHydrationWarning
          >
            {initialData.scope.kind === 'workspace'
              ? `${initialData.scope.accountName} — ${dateLabel}`
              : isViewingToday
                ? dateLabel
                : 'Plans and tasks due this day'}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
          aria-label="Next day"
          onClick={() => router.push(nextDayHref)}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
        {!isViewingToday ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => router.push(todayHref)}
          >
            Today
          </Button>
        ) : null}
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {isViewingToday ? (
          <NowBar
            now={now}
            currentBlock={currentBlock}
            nextBlock={nextBlock}
            hasSchedule={displayBlocks.length > 0}
            planHref={initialData.planViewHref}
            className="min-w-0 flex-1"
          />
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <PlannerViewTabs
            dayHref={dayViewHref}
            planHref={initialData.planViewHref}
            active="day"
          />
          <PlannerRemindersToggle />
        </div>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]/80">
              Schedule
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {hasPlan ? (
                <>
                  <PlannerSyncCalendarButton
                    dateIso={`${dateYmd}T12:00:00`}
                    planDocument={planDocument}
                    onSynced={persistPlanDocument}
                    size="sm"
                  />
                  <ReplanDialog
                    scope={initialData.scope}
                    planMarkdown={planMarkdown}
                    openTasks={replanOpenTasks}
                    calendarEvents={calendarEvents}
                    sessionUserContext={replanUserContext}
                    onPlanUpdated={setPlanMarkdown}
                  />
                </>
              ) : (
                <Button
                  asChild
                  className={cn(
                    'h-10 rounded-xl px-5 text-sm font-semibold shadow-sm',
                    'bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]',
                  )}
                >
                  <Link href={initialData.planViewHref}>
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Plan
                  </Link>
                </Button>
              )}
            </div>
          </div>
          {displayBlocks.length === 0 ? (
            <EmptySchedule />
          ) : showEditableSchedule && planDocument ? (
            <DayScheduleEditor
              document={planDocument}
              onDocumentChange={setPlanDocument}
              onPersist={persistPlanDocument}
              now={now}
              scheduleDateYmd={dateYmd}
              calendarEventsMovable
              onSyncBlock={syncBlockToGoogle}
            />
          ) : (
            <div className="min-w-0 space-y-2">
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
            <p className="text-xs text-[var(--workspace-shell-text)]/40">
              A plan exists for today but no time blocks could be read from it.
            </p>
          ) : null}
        </section>

        <section className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]/80">
              {isViewingToday ? 'Due today' : 'Due this day'}
            </h2>
            <span className="text-xs text-[var(--workspace-shell-text)]/40">
              {openTasks.length} open
              {doneTasks.length > 0 ? ` · ${doneTasks.length} done` : ''}
            </span>
          </div>

          <form onSubmit={addTask} className="flex items-center gap-2">
            <input
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              placeholder={
                isViewingToday
                  ? 'Add a task for today…'
                  : 'Add a task for this day…'
              }
              className="h-9 min-w-0 flex-1 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 text-sm text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30 focus:border-[var(--ozer-accent)]/60 focus:outline-none"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newTaskTitle.trim() || isAddingTask}
              className="h-9 shrink-0 bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>

          {tasks.length === 0 ? (
            <p className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-4 py-6 text-center text-sm text-[var(--workspace-shell-text)]/45">
              {isViewingToday ? 'Nothing due today.' : 'Nothing due this day.'}
            </p>
          ) : (
            <ul className="min-w-0 space-y-2">
              {[...openTasks, ...doneTasks].map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={toggleTask}
                  workspaceAccountId={workspaceAccountId}
                  onTaskUpdated={() => router.refresh()}
                />
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
        <p className="text-center text-xs text-[var(--workspace-shell-text)]/35">
          Workspace tasks hidden —{' '}
          <Link
            href={initialData.settingsHref}
            className="text-[var(--ozer-accent)] hover:underline"
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
  className,
}: {
  now: Date;
  currentBlock: DisplayBlock | undefined;
  nextBlock: DisplayBlock | undefined;
  hasSchedule: boolean;
  planHref: string;
  className?: string;
}) {
  const clock = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2 sm:gap-4 sm:px-4',
        className,
      )}
    >
      <span
        className="font-mono text-xl font-semibold text-[var(--workspace-shell-text)] tabular-nums sm:text-2xl"
        suppressHydrationWarning
      >
        {clock}
      </span>
      <span className="hidden h-7 w-px bg-[var(--workspace-shell-sidebar-accent)] sm:block" />
      <div className="min-w-0 flex-1 space-y-0.5" suppressHydrationWarning>
        {hasSchedule ? (
          <>
            <p className="truncate text-xs sm:text-sm">
              <span className="text-[10px] font-semibold tracking-wide text-[var(--ozer-accent-muted)] uppercase">
                Now
              </span>{' '}
              <span className="font-medium text-[var(--workspace-shell-text)]">
                {currentBlock
                  ? currentBlock.title
                  : nextBlock
                    ? 'Free until next block'
                    : 'Done for the day'}
              </span>
              {currentBlock ? (
                <span className="text-[var(--workspace-shell-text)]/40">
                  {' '}
                  · until {formatTime(currentBlock.end)}
                </span>
              ) : null}
            </p>
            <p className="truncate text-xs text-[var(--workspace-shell-text)]/55 sm:text-sm">
              <span className="text-[10px] font-semibold tracking-wide text-[var(--workspace-shell-text)]/35 uppercase">
                Next
              </span>{' '}
              {nextBlock
                ? `${nextBlock.title} · ${formatTime(nextBlock.start)}`
                : 'Nothing else scheduled'}
            </p>
          </>
        ) : (
          <p className="text-xs text-[var(--workspace-shell-text)]/55 sm:text-sm">
            No schedule yet —{' '}
            <Link
              href={planHref}
              className="text-[var(--ozer-accent)] hover:underline"
            >
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
        'flex min-w-0 items-start gap-2.5 rounded-xl border px-3 py-3 transition-colors sm:gap-3 sm:px-4',
        block.isCalendarEvent
          ? 'border-sky-400/15 bg-sky-400/10'
          : block.isBreak
            ? 'border-dashed border-[color:var(--workspace-shell-border)] bg-white/[0.015]'
            : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]',
        status === 'current' &&
          'border-[var(--ozer-accent)]/50 bg-[var(--ozer-accent-subtle)] ring-1 ring-[var(--ozer-accent)]/30',
        status === 'past' && 'opacity-45',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          block.isCalendarEvent
            ? 'text-sky-300/80'
            : block.isBreak
              ? 'text-[var(--workspace-shell-text)]/30'
              : 'text-[var(--ozer-accent-muted)]',
        )}
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="font-mono text-xs text-[var(--workspace-shell-text)]/45">
          {formatTime(block.start)} – {formatTime(block.end)}
        </p>
        <p
          className={cn(
            'mt-0.5 text-sm font-medium break-words',
            block.isBreak
              ? 'text-[var(--workspace-shell-text)]/45 italic'
              : 'text-[var(--workspace-shell-text)]',
          )}
        >
          {block.title}
        </p>
      </div>
      {status === 'current' ? (
        <span className="mt-0.5 shrink-0 rounded-full bg-[var(--ozer-accent)]/25 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--ozer-accent-muted)] uppercase">
          Now
        </span>
      ) : null}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  workspaceAccountId,
  onTaskUpdated,
}: {
  task: PlannerTask;
  onToggle: (task: PlannerTask) => void;
  workspaceAccountId?: string;
  onTaskUpdated?: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const done = task.status === 'completed';
  const clientName = task.clientName?.trim();
  const metaLabel = plannerTaskMetaWithoutClient(task);
  const pageTask = plannerTaskToPageTask(task);

  return (
    <>
      <li
        className={cn(
          'flex min-w-0 items-start gap-2.5 overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-3 sm:gap-3 sm:px-4',
          done && 'opacity-55',
        )}
      >
        <button
          type="button"
          onClick={() => onToggle(task)}
          aria-label={done ? 'Mark as not done' : 'Mark as done'}
          className="mt-0.5 shrink-0 text-[var(--workspace-shell-text)]/30 transition-colors hover:text-[var(--ozer-accent-muted)]"
        >
          {done ? (
            <CheckCircle2 className="h-4 w-4 text-[var(--ozer-accent)]" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="min-w-0 flex-1 overflow-hidden rounded-lg text-left transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)]/40 focus-visible:outline-none"
        >
          <p
            className={cn(
              'text-sm font-medium break-words text-[var(--workspace-shell-text)]',
              done && 'line-through decoration-white/40',
            )}
          >
            {task.title}
          </p>
          {clientName || metaLabel ? (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
              {clientName ? (
                <PlannerClientPill
                  name={clientName}
                  pictureUrl={task.clientPictureUrl}
                  color={task.accentColor}
                />
              ) : null}
              {metaLabel ? (
                <span className="min-w-0 text-xs break-words text-[var(--workspace-shell-text)]/45">
                  {metaLabel}
                </span>
              ) : null}
            </div>
          ) : null}
          {task.notes?.trim() ? (
            <p className="mt-1 line-clamp-2 text-xs break-words text-[var(--workspace-shell-text)]/35">
              {task.notes.trim()}
            </p>
          ) : null}
        </button>
      </li>

      <EditTaskDialog
        task={pageTask}
        open={editOpen}
        onOpenChange={setEditOpen}
        workspaceAccountId={workspaceAccountId}
        onSaved={onTaskUpdated}
        onDeleted={onTaskUpdated}
      />
    </>
  );
}

const STAGE_DOT_COLORS: Record<string, string> = {
  lead: '#3B82F6',
  qualified: '#FF5C34',
  call_booked: '#A855F7',
  proposal_sent: '#F97316',
  negotiation: '#EAB308',
};

function PipelineOverview({ pipeline }: { pipeline: DayViewPipeline }) {
  return (
    <section className="min-w-0 space-y-3 overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]/80">
            Pipeline
          </h2>
          <p className="mt-0.5 text-xs break-words text-[var(--workspace-shell-text)]/45">
            {pipeline.openCount} open deal{pipeline.openCount === 1 ? '' : 's'}{' '}
            · {gbp.format(pipeline.openValue)}
          </p>
        </div>
        <Link
          href={pipeline.href}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--ozer-accent)] hover:underline"
        >
          Open pipeline
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {pipeline.stages.map((stage) => (
          <span
            key={stage.key}
            className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-1.5 text-xs"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: STAGE_DOT_COLORS[stage.key] ?? '#64748B',
              }}
            />
            <span className="text-[var(--workspace-shell-text)]/70">
              {stage.label}
            </span>
            <span className="font-semibold text-[var(--workspace-shell-text)]">
              {stage.count}
            </span>
            {stage.value > 0 ? (
              <span className="text-[var(--workspace-shell-text)]/40">
                {gbp.format(stage.value)}
              </span>
            ) : null}
          </span>
        ))}
      </div>

      {pipeline.needsAction.length > 0 ? (
        <div className="space-y-1.5 border-t border-[color:var(--workspace-shell-border)] pt-3">
          <p className="text-[10px] font-semibold tracking-wide text-[var(--workspace-shell-text)]/35 uppercase">
            Next actions due
          </p>
          <ul className="space-y-1.5">
            {pipeline.needsAction.map((deal) => (
              <li
                key={deal.id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-[var(--workspace-shell-text)]">
                    {deal.name}
                  </span>
                  <span className="text-[var(--workspace-shell-text)]/50">
                    {' '}
                    — {deal.nextAction}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 text-xs',
                    deal.overdue
                      ? 'text-rose-300'
                      : 'text-[var(--workspace-shell-text)]/45',
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

function EmptySchedule() {
  return (
    <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-4 py-8 text-center">
      <Sparkles className="mx-auto h-6 w-6 text-[var(--ozer-accent-muted)]/70" />
      <p className="mt-3 text-sm text-[var(--workspace-shell-text)]/60">
        No plan for this day yet. Use Plan above to build one.
      </p>
    </div>
  );
}
