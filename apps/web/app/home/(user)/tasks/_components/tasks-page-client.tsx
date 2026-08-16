'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  Flame,
  KanbanSquare,
  List as ListIcon,
  Repeat,
  Search,
  Share2,
  SlidersHorizontal,
  User,
  Users,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { Button } from '@kit/ui/button';
import { Calendar } from '@kit/ui/calendar';
import { Checkbox } from '@kit/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { workspacePageMainClassName } from '~/components/workspace-shell/workspace-shell-styles';
import { useCommandUndoStack } from '~/lib/hooks/use-command-undo-stack';
import {
  type TaskExportRow,
  downloadTextFile,
  exportFilename,
  flattenScheduledSeriesForExport,
  flattenTasksForExport,
  tasksToCsv,
  tasksToMarkdown,
  tasksToPlainText,
} from '~/lib/tasks/export-tasks';
import {
  isAssignedToSomeoneElse,
  taskAssigneeDisplayName,
} from '~/lib/tasks/task-assignee';

import {
  compareYmd,
  parseDueDateParts,
  toIsoDateString,
} from '../../../_lib/due-date-ymd';
import { AddTaskDialog } from '../../_components/dashboard/add-task-dialog';
import {
  listTaskRecurringSeriesAction,
  updateTask,
  updateTaskRecurringSeriesStatusAction,
} from '../../_lib/actions/task-actions';
import type { TasksPageTask } from '../../_lib/server/tasks.loader';
import { InlineAddTaskRow } from './inline-add-task-row';
import { InlineTaskTitle } from './tasks-inline-task-title';

type ScheduledSeriesItem = {
  id: string;
  title: string;
  frequency: string;
  status: 'active' | 'paused' | 'ended';
  nextCreateAt: string;
  nextCreateYmd: string;
  dueDays: number;
  occurrencesCreated: number;
  accountId: string | null;
  priority: string;
  notes: string | null;
  dayOfMonth: number | null;
  projectId: string | null;
  clientId: string | null;
  areaId: string | null;
};

const EditTaskDialog = dynamic(
  () => import('./edit-task-dialog').then((mod) => mod.EditTaskDialog),
  { ssr: false },
);

const EditScheduledSeriesDialog = dynamic(
  () =>
    import('./edit-scheduled-series-dialog').then(
      (mod) => mod.EditScheduledSeriesDialog,
    ),
  { ssr: false },
);

const TasksKanbanBoard = dynamic(
  () => import('./tasks-kanban-board').then((mod) => mod.TasksKanbanBoard),
  { ssr: false },
);

type TaskStatus = TasksPageTask['status'];

const STATUS_COLUMNS: Array<{
  key: TaskStatus;
  label: string;
  dot: string;
  tint: string;
}> = [
  {
    key: 'pending',
    label: 'Not started',
    dot: '#7E889D',
    tint: 'rgba(126,136,157,0.10)',
  },
  {
    key: 'in_progress',
    label: 'In progress',
    dot: '#3B82F6',
    tint: 'rgba(59,130,246,0.10)',
  },
  {
    key: 'client_review',
    label: 'Client review',
    dot: '#F7923D',
    tint: 'rgba(247,146,61,0.12)',
  },
  {
    key: 'completed',
    label: 'Completed',
    dot: 'var(--ozer-accent)',
    tint: 'rgba(87,200,127,0.10)',
  },
];

/** List row: done · title (+ subtask expand) · due · client · priority */
function taskListRowGridClass() {
  return cn(
    'grid items-center gap-x-2 px-2 py-2.5 sm:gap-x-3 sm:px-4',
    // Mobile: checkbox · title · date + client · priority
    'grid-cols-[1.5rem_minmax(0,1fr)_auto_1.25rem]',
    // Desktop: separate due date and client columns
    'sm:grid-cols-[1.5rem_minmax(0,1fr)_minmax(5.5rem,7.5rem)_minmax(6rem,10rem)_1.75rem]',
  );
}

function ClientCell({
  name,
  color,
  pictureUrl,
  compact = false,
}: {
  name: string | null;
  color?: string | null;
  pictureUrl?: string | null;
  compact?: boolean;
}) {
  if (!name?.trim()) {
    return compact ? null : (
      <span className="inline-block min-h-6 shrink-0" aria-hidden />
    );
  }

  const initial = (name.trim()[0] ?? '?').toUpperCase();

  if (compact) {
    return (
      <span
        className="max-w-[5.5rem] truncate text-[10px] leading-tight text-[var(--workspace-shell-text-muted)]"
        title={name}
      >
        {name}
      </span>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5" title={name}>
      <Avatar className="h-6 w-6 shrink-0">
        {pictureUrl ? (
          <AvatarImage src={pictureUrl} alt="" className="object-cover" />
        ) : null}
        <AvatarFallback
          className="text-[10px] font-semibold text-[var(--workspace-shell-text)]"
          style={{ backgroundColor: color ?? '#64748B' }}
        >
          {initial}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
        {name}
      </span>
    </span>
  );
}

function formatDueDateLabel(due: string | null): string {
  const parts = parseDueDateParts(due);
  if (!parts) return '';
  const date = new Date(parts.y, parts.m - 1, parts.d, 12, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** True when a contact or another team member owns the task. */
function TaskAssigneeChip({
  task,
  currentUserId,
  className,
}: {
  task: TasksPageTask;
  currentUserId?: string | null;
  className?: string;
}) {
  if (!isAssignedToSomeoneElse(task, currentUserId)) return null;
  const label = taskAssigneeDisplayName(task);
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 text-[11px] text-[var(--workspace-shell-text-muted)]',
        className,
      )}
      title={`Assigned to ${label}`}
    >
      <User className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

function TaskRowMetaColumn({
  taskId,
  dueDate,
  dueDateLabel,
  overdue,
  calendarScheduleStatus,
  clientName,
  clientColor,
  clientPictureUrl,
  onDueDateChanged,
}: {
  taskId: string;
  dueDate: string | null;
  dueDateLabel: string;
  overdue: boolean;
  calendarScheduleStatus?: 'scheduled' | 'failed' | null;
  clientName: string | null;
  clientColor?: string | null;
  clientPictureUrl?: string | null;
  onDueDateChanged?: (
    taskId: string,
    dueDate: string | null,
    dueDateLabel: string,
  ) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
      <InlineDueDate
        taskId={taskId}
        dueDate={dueDate}
        dueDateLabel={dueDateLabel}
        overdue={overdue}
        calendarScheduleStatus={calendarScheduleStatus}
        align="end"
        onDueDateChanged={onDueDateChanged}
      />
      <ClientCell
        name={clientName}
        color={clientColor}
        pictureUrl={clientPictureUrl}
        compact
      />
    </div>
  );
}

function InlineDueDate({
  taskId,
  dueDate,
  dueDateLabel,
  overdue,
  calendarScheduleStatus,
  align = 'start',
  onDueDateChanged,
  readOnly,
}: {
  taskId: string;
  dueDate: string | null;
  dueDateLabel: string;
  overdue: boolean;
  calendarScheduleStatus?: 'scheduled' | 'failed' | null;
  align?: 'start' | 'end';
  onDueDateChanged?: (
    taskId: string,
    dueDate: string | null,
    dueDateLabel: string,
  ) => void;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const isoValue = dueDate ? (toIsoDateString(dueDate) ?? '') : '';
  const selectedDate = (() => {
    const parts = parseDueDateParts(isoValue || null);
    if (!parts) return undefined;
    return new Date(parts.y, parts.m - 1, parts.d, 12, 0, 0, 0);
  })();

  const save = useCallback(
    async (raw: string | null) => {
      const normalized = raw?.trim() ? toIsoDateString(raw.trim()) : null;
      const current = dueDate ? toIsoDateString(dueDate) : null;
      if (normalized === current) {
        setOpen(false);
        return;
      }

      const prevDate = dueDate;
      const prevLabel = dueDateLabel;
      const nextLabel = formatDueDateLabel(normalized);

      onDueDateChanged?.(taskId, normalized, nextLabel);
      setPending(true);
      setOpen(false);
      const result = await updateTask(taskId, { dueDate: normalized });
      setPending(false);
      if (!result.success) {
        onDueDateChanged?.(taskId, prevDate, prevLabel);
        return;
      }
      router.refresh();
    },
    [dueDate, dueDateLabel, onDueDateChanged, router, taskId],
  );

  if (readOnly) {
    return (
      <DueDateCell
        dueDateLabel={dueDateLabel}
        overdue={overdue}
        calendarScheduleStatus={calendarScheduleStatus}
        align={align}
      />
    );
  }

  const triggerLabel = dueDateLabel || 'Add date';
  const triggerTitle = overdue
    ? `Overdue · ${dueDateLabel}`
    : dueDateLabel || 'Set due date';

  return (
    <span
      className={cn(
        'flex min-w-0 flex-col gap-1',
        align === 'end' && 'items-end',
      )}
      data-task-row-action
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={pending}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'flex min-w-0 items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]',
              align === 'end' && 'justify-end',
              pending && 'opacity-60',
              !dueDateLabel &&
                'text-[11px] text-[var(--workspace-shell-text-muted)] sm:text-xs',
            )}
            title={triggerTitle}
            aria-label={
              dueDateLabel ? `Edit due date ${dueDateLabel}` : 'Set due date'
            }
          >
            <CalendarDays
              className={cn(
                'h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4',
                overdue
                  ? 'text-rose-400'
                  : 'text-[var(--workspace-shell-text-muted)]',
              )}
              aria-hidden
            />
            <span
              className={cn(
                'truncate text-[11px] tabular-nums sm:text-xs',
                overdue
                  ? 'font-medium text-rose-400'
                  : 'text-[var(--workspace-shell-text-muted)]',
              )}
            >
              {triggerLabel}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align={align === 'end' ? 'end' : 'start'}
          className="w-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0 text-[var(--workspace-shell-text)]"
          onClick={(e) => e.stopPropagation()}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={(date) => {
              if (!date) return;
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, '0');
              const d = String(date.getDate()).padStart(2, '0');
              void save(`${y}-${m}-${d}`);
            }}
          />
          {dueDate ? (
            <div className="border-t border-[color:var(--workspace-shell-border)] p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-full text-[var(--workspace-shell-text-muted)]"
                disabled={pending}
                onClick={() => void save(null)}
              >
                Clear due date
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
      {calendarScheduleStatus === 'failed' ? (
        <span
          className="text-[11px] font-medium text-amber-300"
          title="Could not find a free calendar slot before the due date"
        >
          Couldn&apos;t auto-schedule
        </span>
      ) : null}
    </span>
  );
}

function DueDateCell({
  dueDateLabel,
  overdue,
  calendarScheduleStatus,
  align = 'start',
}: {
  dueDateLabel: string;
  overdue: boolean;
  calendarScheduleStatus?: 'scheduled' | 'failed' | null;
  align?: 'start' | 'end';
}) {
  if (!dueDateLabel && !calendarScheduleStatus) {
    return <span className="inline-block min-h-4 shrink-0" aria-hidden />;
  }

  return (
    <span
      className={cn(
        'flex min-w-0 flex-col gap-1',
        align === 'end' && 'items-end',
      )}
    >
      {dueDateLabel ? (
        <span
          className={cn(
            'flex min-w-0 items-center gap-1',
            align === 'end' && 'justify-end',
          )}
          title={overdue ? `Overdue · ${dueDateLabel}` : dueDateLabel}
        >
          <CalendarDays
            className={cn(
              'h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4',
              overdue
                ? 'text-rose-400'
                : 'text-[var(--workspace-shell-text-muted)]',
            )}
            aria-hidden
          />
          <span
            className={cn(
              'truncate text-[11px] tabular-nums sm:text-xs',
              overdue
                ? 'font-medium text-rose-400'
                : 'text-[var(--workspace-shell-text-muted)]',
            )}
          >
            {dueDateLabel}
          </span>
        </span>
      ) : null}
      {calendarScheduleStatus === 'failed' ? (
        <span
          className="text-[11px] font-medium text-amber-300"
          title="Could not find a free calendar slot before the due date"
        >
          Couldn&apos;t auto-schedule
        </span>
      ) : null}
    </span>
  );
}

function PriorityIndicator({
  priority,
}: {
  priority: TasksPageTask['priority'];
}) {
  if (priority === 'urgent') {
    return (
      <span title="Urgent priority" className="flex justify-center">
        <Flame className="h-3.5 w-3.5 text-rose-400" aria-hidden />
      </span>
    );
  }

  if (priority === 'high') {
    return (
      <span title="High priority" className="flex justify-center">
        <ArrowUp className="h-3.5 w-3.5 text-amber-400" aria-hidden />
      </span>
    );
  }

  if (priority === 'medium') {
    return (
      <span title="Medium priority" className="flex justify-center">
        <ArrowDown className="h-3.5 w-3.5 text-emerald-400/80" aria-hidden />
      </span>
    );
  }

  return <span className="inline-block h-3.5 w-3.5 shrink-0" aria-hidden />;
}

type TaskViewMode = 'list' | 'board' | 'byClient' | 'scheduled';
type DueDateFilter = 'all' | 'today' | 'week' | 'month';

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const p = parseDueDateParts(ymd);
  if (!p) return ymd;
  const d = new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function endOfWeekYmd(today: string): string {
  const p = parseDueDateParts(today);
  if (!p) return today;
  const d = new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0);
  const day = d.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  return addDaysYmd(today, daysUntilSunday);
}

function endOfMonthYmd(today: string): string {
  const p = parseDueDateParts(today);
  if (!p) return today;
  const last = new Date(p.y, p.m, 0, 12, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`;
}

function matchesDueDateFilter(
  task: TasksPageTask,
  filter: DueDateFilter,
  today: string,
): boolean {
  if (filter === 'all') return true;
  const due = task.dueDate;
  if (!due) return false;
  if (filter === 'today') return due === today;
  if (filter === 'week') {
    return due >= today && due <= endOfWeekYmd(today);
  }
  return due >= today && due <= endOfMonthYmd(today);
}

function isHighPriority(task: TasksPageTask): boolean {
  return task.priority === 'urgent' || task.priority === 'high';
}

function isOverdue(task: TasksPageTask, today = todayISO()): boolean {
  if (task.status === 'completed') return false;
  const due = parseDueDateParts(task.dueDate);
  const t = parseDueDateParts(today);
  if (!due || !t) return false;
  return compareYmd(due, t) < 0;
}

function DueDateGroupHeader({
  variant,
}: {
  variant: 'overdue' | 'upcoming' | 'later';
}) {
  const label =
    variant === 'overdue'
      ? 'Overdue'
      : variant === 'upcoming'
        ? 'Upcoming'
        : 'Later';
  const isOverdueGroup = variant === 'overdue';

  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b border-[color:var(--workspace-shell-border)] px-4 py-2 text-[11px] font-semibold tracking-wide uppercase',
        isOverdueGroup
          ? 'bg-rose-500/[0.07] text-rose-300/95'
          : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
      )}
    >
      {isOverdueGroup ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      ) : null}
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          isOverdueGroup
            ? 'bg-rose-400'
            : variant === 'upcoming'
              ? 'bg-[var(--ozer-accent)]'
              : 'bg-[var(--workspace-shell-panel-hover)]/70',
        )}
        aria-hidden
      />
      {label}
    </div>
  );
}

function compareTasksByDueDate(
  a: TasksPageTask,
  b: TasksPageTask,
  today: string,
): number {
  const ao = isOverdue(a, today) ? 0 : 1;
  const bo = isOverdue(b, today) ? 0 : 1;
  if (ao !== bo) return ao - bo;
  const ad = a.dueDate ?? '9999-12-31';
  const bd = b.dueDate ?? '9999-12-31';
  if (ad !== bd) return ad.localeCompare(bd);
  const priorityRank = (p: TasksPageTask['priority']) =>
    p === 'urgent' ? 0 : p === 'high' ? 1 : p === 'medium' ? 2 : 3;
  const pr = priorityRank(a.priority) - priorityRank(b.priority);
  if (pr !== 0) return pr;
  return a.title.localeCompare(b.title);
}

type TaskRowHandlers = {
  showWorkspaceTag: boolean;
  workspaceAccountId?: string;
  workspaceAccountSlug?: string;
  today: string;
  currentUserId?: string | null;
  expandedRootTaskIds: Set<string>;
  onToggleSubtasks: (taskId: string) => void;
  onStatusChanged: (taskId: string, status: TaskStatus) => void | Promise<void>;
  onTitleChanged: (taskId: string, title: string) => void;
  onDueDateChanged: (
    taskId: string,
    dueDate: string | null,
    dueDateLabel: string,
  ) => void;
};

function renderTaskRows(list: TasksPageTask[], handlers: TaskRowHandlers) {
  return list.map((task) => (
    <TaskRow
      key={task.id}
      task={task}
      showWorkspaceTag={handlers.showWorkspaceTag}
      workspaceAccountId={handlers.workspaceAccountId}
      workspaceAccountSlug={handlers.workspaceAccountSlug}
      today={handlers.today}
      currentUserId={handlers.currentUserId}
      onStatusChanged={handlers.onStatusChanged}
      onTitleChanged={handlers.onTitleChanged}
      onDueDateChanged={handlers.onDueDateChanged}
      subtasksExpanded={
        (task.subtasks?.length ?? 0) > 0
          ? handlers.expandedRootTaskIds.has(task.id)
          : false
      }
      onToggleSubtasks={
        (task.subtasks?.length ?? 0) > 0
          ? () => handlers.onToggleSubtasks(task.id)
          : undefined
      }
    />
  ));
}

function PriorityGroupedTaskList({
  urgent,
  rest,
  statusFilter,
  handlers,
  inlineClientId,
}: {
  urgent: TasksPageTask[];
  rest: TasksPageTask[];
  statusFilter: 'active' | 'completed';
  handlers: TaskRowHandlers;
  inlineClientId: string | null;
}) {
  const today = handlers.today;
  const upcomingEnd = endOfWeekYmd(today);
  const sorted = [...urgent, ...rest].sort((a, b) =>
    compareTasksByDueDate(a, b, today),
  );

  if (statusFilter !== 'active') {
    return (
      <>
        {renderTaskRows(sorted, handlers)}
        <InlineAddTaskRow
          priority="medium"
          clientId={inlineClientId}
          workspaceAccountId={handlers.workspaceAccountId}
        />
      </>
    );
  }

  const overdue = sorted.filter((task) => isOverdue(task, today));
  const upcoming = sorted.filter(
    (task) =>
      !isOverdue(task, today) &&
      task.dueDate != null &&
      task.dueDate <= upcomingEnd,
  );
  const later = sorted.filter(
    (task) =>
      !isOverdue(task, today) &&
      (task.dueDate == null || task.dueDate > upcomingEnd),
  );

  return (
    <>
      {overdue.length > 0 ? (
        <>
          <DueDateGroupHeader variant="overdue" />
          {renderTaskRows(overdue, handlers)}
        </>
      ) : null}
      {upcoming.length > 0 ? (
        <>
          <DueDateGroupHeader variant="upcoming" />
          {renderTaskRows(upcoming, handlers)}
        </>
      ) : null}
      {later.length > 0 ? (
        <>
          <DueDateGroupHeader variant="later" />
          {renderTaskRows(later, handlers)}
        </>
      ) : null}
      <InlineAddTaskRow
        priority="medium"
        clientId={inlineClientId}
        workspaceAccountId={handlers.workspaceAccountId}
      />
    </>
  );
}

function TasksByClientList({
  groups,
  statusFilter,
  handlers,
}: {
  groups: Array<{ id: string; label: string; tasks: TasksPageTask[] }>;
  statusFilter: 'active' | 'completed';
  handlers: TaskRowHandlers;
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const urgent = group.tasks.filter(isHighPriority);
        const rest = group.tasks.filter((t) => !isHighPriority(t));
        const clientId = group.id === '__unassigned__' ? null : group.id;

        return (
          <div
            key={group.id}
            className="overflow-x-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
          >
            <div className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-4 py-2.5">
              <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                {group.label}
              </p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                {group.tasks.length} task{group.tasks.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="space-y-0">
              <PriorityGroupedTaskList
                urgent={urgent}
                rest={rest}
                statusFilter={statusFilter}
                handlers={handlers}
                inlineClientId={clientId}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function updateTaskDueDateInTree(
  list: TasksPageTask[],
  taskId: string,
  dueDate: string | null,
  dueDateLabel: string,
): TasksPageTask[] {
  return list.map((node) => {
    if (node.id === taskId) {
      return { ...node, dueDate, dueDateLabel };
    }
    if (node.subtasks?.length) {
      return {
        ...node,
        subtasks: updateTaskDueDateInTree(
          node.subtasks,
          taskId,
          dueDate,
          dueDateLabel,
        ),
      };
    }
    return node;
  });
}

function updateTaskTitleInTree(
  list: TasksPageTask[],
  taskId: string,
  title: string,
): TasksPageTask[] {
  return list.map((node) => {
    if (node.id === taskId) return { ...node, title };
    if (node.subtasks?.length) {
      return {
        ...node,
        subtasks: updateTaskTitleInTree(node.subtasks, taskId, title),
      };
    }
    return node;
  });
}

function updateTaskStatusInTree(
  list: TasksPageTask[],
  taskId: string,
  status: TaskStatus,
): TasksPageTask[] {
  return list.map((node) => {
    if (node.id === taskId) return { ...node, status };
    if (node.subtasks?.length) {
      return {
        ...node,
        subtasks: updateTaskStatusInTree(node.subtasks, taskId, status),
      };
    }
    return node;
  });
}

function findTaskStatusInTree(
  list: TasksPageTask[],
  taskId: string,
): TaskStatus | null {
  for (const node of list) {
    if (node.id === taskId) return node.status;
    if (node.subtasks?.length) {
      const nested = findTaskStatusInTree(node.subtasks, taskId);
      if (nested) return nested;
    }
  }
  return null;
}

const toolbarLabeledButtonClass =
  'relative h-10 shrink-0 gap-1.5 rounded-xl border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 text-sm font-medium text-[var(--workspace-shell-text-muted)] hover:bg-white/8 hover:text-[var(--workspace-shell-text)]';

const dropdownContentClass =
  'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] shadow-lg';

const dropdownSubTriggerClass =
  'text-[var(--workspace-shell-text)] focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)] data-[state=open]:bg-[var(--workspace-shell-sidebar-accent)] data-[state=open]:text-[var(--workspace-shell-text)]';

const dropdownRadioItemClass =
  'text-[var(--workspace-shell-text)] focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]';

function useFilterSubmenuInline() {
  const [inline, setInline] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setInline(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return inline;
}

function TasksFilterMenu(props: {
  dueDateFilter: DueDateFilter;
  onDueDateFilterChange: (value: DueDateFilter) => void;
  clientFilter: string;
  onClientFilterChange: (value: string) => void;
  clientOptions: Array<[string, string]>;
  workspaceFilter: string;
  onWorkspaceFilterChange: (value: string) => void;
  workspaceFilterOptions: Array<{
    slug: string | null;
    name: string;
    color: string;
  }>;
  showWorkspaceFilter: boolean;
  contextFilter: 'all' | 'work' | 'life';
  onContextFilterChange: (value: 'all' | 'work' | 'life') => void;
  showContextFilter: boolean;
  statusFilter: 'active' | 'completed';
  onStatusFilterChange: (value: 'active' | 'completed') => void;
  showStatusFilter: boolean;
}) {
  const inlineSubmenus = useFilterSubmenuInline();
  const hasActiveFilters =
    props.dueDateFilter !== 'all' ||
    props.clientFilter !== 'all' ||
    props.workspaceFilter !== 'all' ||
    props.contextFilter !== 'all' ||
    props.statusFilter !== 'active';

  const clientLabel =
    props.clientFilter === 'all'
      ? 'All clients'
      : props.clientFilter === '__none__'
        ? 'No client'
        : (props.clientOptions.find(([id]) => id === props.clientFilter)?.[1] ??
          'Client');

  const workspaceLabel =
    props.workspaceFilter === 'all'
      ? 'All workspaces'
      : props.workspaceFilter === 'personal'
        ? 'Personal only'
        : (props.workspaceFilterOptions.find(
            (ws) => ws.slug === props.workspaceFilter,
          )?.name ?? 'Workspace');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Filter tasks"
          className={toolbarLabeledButtonClass}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          {hasActiveFilters ? (
            <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[var(--ozer-accent)]" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn('w-56', dropdownContentClass)}
      >
        <DropdownMenuLabel className="text-xs text-[var(--workspace-shell-text-muted)]">
          Due date
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={props.dueDateFilter}
          onValueChange={(value) =>
            props.onDueDateFilterChange(value as DueDateFilter)
          }
        >
          {(
            [
              ['today', 'Today'],
              ['week', 'This week'],
              ['month', 'This month'],
              ['all', 'All dates'],
            ] as const
          ).map(([value, label]) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              className={dropdownRadioItemClass}
            >
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        {props.showStatusFilter ? (
          <>
            <DropdownMenuSeparator className="bg-[var(--workspace-shell-sidebar-accent)]" />
            <DropdownMenuLabel className="text-xs text-[var(--workspace-shell-text-muted)]">
              Status
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={props.statusFilter}
              onValueChange={(value) =>
                props.onStatusFilterChange(value as 'active' | 'completed')
              }
            >
              <DropdownMenuRadioItem
                value="active"
                className={dropdownRadioItemClass}
              >
                Active
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="completed"
                className={dropdownRadioItemClass}
              >
                Completed
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        ) : null}

        {props.showContextFilter ? (
          <>
            <DropdownMenuSeparator className="bg-[var(--workspace-shell-sidebar-accent)]" />
            <DropdownMenuLabel className="text-xs text-[var(--workspace-shell-text-muted)]">
              Scope
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={props.contextFilter}
              onValueChange={(value) =>
                props.onContextFilterChange(value as 'all' | 'work' | 'life')
              }
            >
              {(['all', 'work', 'life'] as const).map((value) => (
                <DropdownMenuRadioItem
                  key={value}
                  value={value}
                  className={cn('capitalize', dropdownRadioItemClass)}
                >
                  {value}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : null}

        {props.showWorkspaceFilter &&
        props.workspaceFilterOptions.length > 0 ? (
          <>
            <DropdownMenuSeparator className="bg-[var(--workspace-shell-sidebar-accent)]" />
            {inlineSubmenus ? (
              <>
                <DropdownMenuLabel className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Workspace · {workspaceLabel}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={props.workspaceFilter}
                  onValueChange={props.onWorkspaceFilterChange}
                >
                  <DropdownMenuRadioItem
                    value="all"
                    className={dropdownRadioItemClass}
                  >
                    All workspaces
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="personal"
                    className={dropdownRadioItemClass}
                  >
                    Personal only
                  </DropdownMenuRadioItem>
                  {props.workspaceFilterOptions.map((ws) =>
                    ws.slug ? (
                      <DropdownMenuRadioItem
                        key={ws.slug}
                        value={ws.slug}
                        className={dropdownRadioItemClass}
                      >
                        {ws.name}
                      </DropdownMenuRadioItem>
                    ) : null,
                  )}
                </DropdownMenuRadioGroup>
              </>
            ) : (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={dropdownSubTriggerClass}>
                  Workspace · {workspaceLabel}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(dropdownContentClass, 'max-h-72')}
                  side="left"
                  collisionPadding={16}
                >
                  <DropdownMenuRadioGroup
                    value={props.workspaceFilter}
                    onValueChange={props.onWorkspaceFilterChange}
                  >
                    <DropdownMenuRadioItem
                      value="all"
                      className={dropdownRadioItemClass}
                    >
                      All workspaces
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="personal"
                      className={dropdownRadioItemClass}
                    >
                      Personal only
                    </DropdownMenuRadioItem>
                    {props.workspaceFilterOptions.map((ws) =>
                      ws.slug ? (
                        <DropdownMenuRadioItem
                          key={ws.slug}
                          value={ws.slug}
                          className={dropdownRadioItemClass}
                        >
                          {ws.name}
                        </DropdownMenuRadioItem>
                      ) : null,
                    )}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
          </>
        ) : null}

        {props.clientOptions.length > 0 ? (
          <>
            <DropdownMenuSeparator className="bg-[var(--workspace-shell-sidebar-accent)]" />
            {inlineSubmenus ? (
              <>
                <DropdownMenuLabel className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Client · {clientLabel}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={props.clientFilter}
                  onValueChange={props.onClientFilterChange}
                >
                  <DropdownMenuRadioItem
                    value="all"
                    className={dropdownRadioItemClass}
                  >
                    All clients
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="__none__"
                    className={dropdownRadioItemClass}
                  >
                    No client
                  </DropdownMenuRadioItem>
                  {props.clientOptions.map(([id, name]) => (
                    <DropdownMenuRadioItem
                      key={id}
                      value={id}
                      className={dropdownRadioItemClass}
                    >
                      {name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            ) : (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={dropdownSubTriggerClass}>
                  Client · {clientLabel}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(dropdownContentClass, 'max-h-72 w-56')}
                  side="left"
                  collisionPadding={16}
                >
                  <DropdownMenuRadioGroup
                    value={props.clientFilter}
                    onValueChange={props.onClientFilterChange}
                  >
                    <DropdownMenuRadioItem
                      value="all"
                      className={dropdownRadioItemClass}
                    >
                      All clients
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="__none__"
                      className={dropdownRadioItemClass}
                    >
                      No client
                    </DropdownMenuRadioItem>
                    {props.clientOptions.map(([id, name]) => (
                      <DropdownMenuRadioItem
                        key={id}
                        value={id}
                        className={dropdownRadioItemClass}
                      >
                        {name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TasksViewMenu(props: {
  view: TaskViewMode;
  onViewChange: (view: TaskViewMode) => void;
}) {
  const views: Array<{
    value: TaskViewMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { value: 'list', label: 'List', icon: ListIcon },
    { value: 'board', label: 'Board', icon: KanbanSquare },
    { value: 'byClient', label: 'By client', icon: Users },
    { value: 'scheduled', label: 'Scheduled', icon: Repeat },
  ];

  const current = views.find((item) => item.value === props.view) ?? views[0]!;
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Change task view"
          className={toolbarLabeledButtonClass}
        >
          <CurrentIcon className="h-4 w-4" />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn('w-44', dropdownContentClass)}
      >
        <DropdownMenuLabel className="text-xs text-[var(--workspace-shell-text-muted)]">
          View
        </DropdownMenuLabel>
        {views.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => props.onViewChange(value)}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden hover:bg-[var(--workspace-shell-sidebar-accent)]',
              props.view === value
                ? 'text-[var(--workspace-shell-text)]'
                : 'text-[var(--workspace-shell-text-muted)]',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {props.view === value ? (
              <Check className="h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
            ) : null}
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const shareMenuItemClass =
  'cursor-pointer gap-2 text-[var(--workspace-shell-text)] focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]';

function TasksShareMenu(props: { getRows: () => TaskExportRow[] }) {
  const copyText = async (content: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success(successMessage);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Share or export tasks"
          className={toolbarLabeledButtonClass}
        >
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn('w-52', dropdownContentClass)}
      >
        <DropdownMenuLabel className="text-xs text-[var(--workspace-shell-text-muted)]">
          Current view
        </DropdownMenuLabel>
        <DropdownMenuItem
          className={shareMenuItemClass}
          onSelect={() => {
            const rows = props.getRows();
            downloadTextFile(
              exportFilename('tasks', 'csv'),
              tasksToCsv(rows),
              'text/csv;charset=utf-8',
            );
            toast.success(
              rows.length === 0
                ? 'Downloaded empty CSV'
                : `Downloaded ${rows.length} task${rows.length === 1 ? '' : 's'}`,
            );
          }}
        >
          <Download className="h-4 w-4 shrink-0" />
          Download as CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          className={shareMenuItemClass}
          onSelect={() => {
            void copyText(
              tasksToPlainText(props.getRows()),
              'Copied tasks as text',
            );
          }}
        >
          <Copy className="h-4 w-4 shrink-0" />
          Copy as text
        </DropdownMenuItem>
        <DropdownMenuItem
          className={shareMenuItemClass}
          onSelect={() => {
            void copyText(
              tasksToMarkdown(props.getRows()),
              'Copied tasks as Markdown',
            );
          }}
        >
          <FileText className="h-4 w-4 shrink-0" />
          Copy as MD
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Props = {
  initialTasks: TasksPageTask[];
  /** Team workspace: only tasks linked to this account’s projects/clients; hides life/work scope toggle. */
  variant?: 'personal' | 'workspace';
  /** Required when `variant="workspace"` — enables Add Task for this team account. */
  workspaceAccountId?: string;
  /** Required for workspace AI extract link in Add Task dialog. */
  workspaceAccountSlug?: string;
  /** Personal: include workspace-linked tasks (from user settings). */
  includeWorkspaceTasks?: boolean;
  /** Personal: `all`, `personal`, or a workspace slug (from URL or settings). */
  initialWorkspaceFilter?: string;
  /** Workspace: link to meeting task review queue. */
  reviewHref?: string | null;
  /** Workspace: pending meeting suggestions awaiting review. */
  pendingReviewCount?: number;
  /** Signed-in user — used to hide assignee chip when the task is yours. */
  currentUserId?: string | null;
};

export function TasksPageClient({
  initialTasks,
  variant = 'personal',
  workspaceAccountId,
  workspaceAccountSlug,
  includeWorkspaceTasks = true,
  initialWorkspaceFilter = 'all',
  reviewHref = null,
  pendingReviewCount = 0,
  currentUserId = null,
}: Props) {
  const [tasks, setTasks] = useState<TasksPageTask[]>(initialTasks);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const [view, setView] = useState<TaskViewMode>('list');
  const [filter, setFilter] = useState<'all' | 'work' | 'life'>(() =>
    variant === 'workspace' ? 'work' : includeWorkspaceTasks ? 'all' : 'life',
  );
  const [workspaceFilter, setWorkspaceFilter] = useState<string>(
    initialWorkspaceFilter,
  );
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed'>(
    'active',
  );
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>('all');
  const [search, setSearch] = useState('');

  const [expandedRootTaskIds, setExpandedRootTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [scheduledSeries, setScheduledSeries] = useState<ScheduledSeriesItem[]>(
    [],
  );
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [editingSeries, setEditingSeries] =
    useState<ScheduledSeriesItem | null>(null);
  const [editSeriesOpen, setEditSeriesOpen] = useState(false);

  const router = useRouter();
  const { push: pushUndo } = useCommandUndoStack();
  const todayKey = todayISO();

  useEffect(() => {
    if (view !== 'scheduled') return;
    let cancelled = false;
    setScheduledLoading(true);
    void listTaskRecurringSeriesAction()
      .then((rows) => {
        if (cancelled) return;
        const filtered = (rows ?? []).filter((row) => {
          if (!workspaceAccountId) return true;
          return row.accountId === workspaceAccountId || row.accountId == null;
        });
        setScheduledSeries(filtered);
      })
      .catch(() => {
        if (!cancelled) setScheduledSeries([]);
      })
      .finally(() => {
        if (!cancelled) setScheduledLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, workspaceAccountId]);

  const initialTaskIdsSignature = useMemo(
    () => initialTasks.map((t) => t.id).join(','),
    [initialTasks],
  );

  // Re-sync local state when the server returns a fresh list (after router.refresh / nav).
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  // New server payload → collapse all parent groups again.
  useEffect(() => {
    setExpandedRootTaskIds(new Set());
  }, [initialTaskIdsSignature]);

  const toggleRootExpanded = useCallback((taskId: string) => {
    setExpandedRootTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const clientOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const t of tasks) {
      if (t.clientId && t.clientName) {
        set.set(t.clientId, t.clientName);
      }
    }
    return [...set.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [tasks]);

  const workspaceFilterOptions = useMemo(() => {
    const map = new Map<
      string,
      { slug: string | null; name: string; color: string }
    >();
    for (const t of tasks) {
      if (t.workspaceName) {
        const key = t.workspaceSlug ?? `name:${t.workspaceName}`;
        if (!map.has(key)) {
          map.set(key, {
            slug: t.workspaceSlug,
            name: t.workspaceName,
            color: t.workspaceColor ?? '#64748B',
          });
        }
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const matchesBaseFilters = useCallback(
    (t: TasksPageTask) => {
      if (variant !== 'workspace' && filter !== 'all' && t.context !== filter) {
        return false;
      }
      if (variant === 'personal' && workspaceFilter !== 'all') {
        if (workspaceFilter === 'personal') {
          if (t.context !== 'life') return false;
        } else if (t.workspaceSlug !== workspaceFilter) {
          return false;
        }
      }
      if (clientFilter !== 'all') {
        if (clientFilter === '__none__') {
          if (t.clientId) return false;
        } else if (t.clientId !== clientFilter) {
          return false;
        }
      }
      if (search) {
        const q = search.trim().toLowerCase();
        const inTitle = t.title.toLowerCase().includes(q);
        const inWorkspace = (t.workspaceName ?? '').toLowerCase().includes(q);
        const inClient = (t.clientName ?? '').toLowerCase().includes(q);
        if (!inTitle && !inWorkspace && !inClient) {
          return false;
        }
      }
      if (!matchesDueDateFilter(t, dueDateFilter, todayKey)) {
        return false;
      }
      return true;
    },
    [
      variant,
      filter,
      workspaceFilter,
      clientFilter,
      search,
      dueDateFilter,
      todayKey,
    ],
  );

  const filteredForList = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter === 'active' && t.status === 'completed') return false;
      if (statusFilter === 'completed' && t.status !== 'completed')
        return false;
      return matchesBaseFilters(t);
    });
  }, [tasks, statusFilter, matchesBaseFilters]);

  // Board mode shows all statuses, but still respects search/client/scope filters.
  const filteredForBoard = useMemo(
    () => tasks.filter((t) => matchesBaseFilters(t)),
    [tasks, matchesBaseFilters],
  );

  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, TasksPageTask[]>();
    for (const col of STATUS_COLUMNS) map.set(col.key, []);
    for (const t of filteredForBoard) {
      const arr = map.get(t.status) ?? [];
      arr.push(t);
      map.set(t.status, arr);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const ao = isOverdue(a, todayKey) ? 0 : 1;
        const bo = isOverdue(b, todayKey) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        const ad = a.dueDate ?? '9999-12-31';
        const bd = b.dueDate ?? '9999-12-31';
        if (ad !== bd) return ad.localeCompare(bd);
        return a.title.localeCompare(b.title);
      });
    }
    return map;
  }, [filteredForBoard, todayKey]);

  const overdueCount = useMemo(
    () => tasks.filter((t) => isOverdue(t, todayKey)).length,
    [tasks, todayKey],
  );

  const urgent = filteredForList.filter(isHighPriority);
  const rest = filteredForList.filter((t) => !isHighPriority(t));

  const clientGroups = useMemo(() => {
    const map = new Map<
      string,
      { id: string; label: string; tasks: TasksPageTask[] }
    >();
    for (const t of filteredForList) {
      const key = t.clientId ?? '__unassigned__';
      const label =
        key === '__unassigned__'
          ? 'Unassigned'
          : t.clientName?.trim() || 'Client';
      const existing = map.get(key);
      if (existing) {
        existing.tasks.push(t);
      } else {
        map.set(key, { id: key, label, tasks: [t] });
      }
    }
    return [...map.values()].sort((a, b) => {
      if (a.id === '__unassigned__') return 1;
      if (b.id === '__unassigned__') return -1;
      return a.label.localeCompare(b.label);
    });
  }, [filteredForList]);

  const showWorkspaceTag = variant === 'personal';
  const inlineClientId =
    clientFilter !== 'all' && clientFilter !== '__none__' ? clientFilter : null;

  const activeCount = useMemo(
    () => tasks.filter((t) => t.status !== 'completed').length,
    [tasks],
  );

  const applyTaskStatusRef = useRef<
    (
      taskId: string,
      nextStatus: TaskStatus,
      options?: { recordHistory?: boolean },
    ) => Promise<void>
  >(async () => undefined);

  const handleStatusChanged = useCallback(
    async (
      taskId: string,
      nextStatus: TaskStatus,
      options?: { recordHistory?: boolean },
    ) => {
      const recordHistory = options?.recordHistory !== false;
      const previous = findTaskStatusInTree(tasksRef.current, taskId);
      if (!previous || previous === nextStatus) return;

      const nextTasks = updateTaskStatusInTree(
        tasksRef.current,
        taskId,
        nextStatus,
      );
      tasksRef.current = nextTasks;
      setTasks(nextTasks);

      const result = await updateTask(taskId, { status: nextStatus });
      if (!result.success) {
        const reverted = updateTaskStatusInTree(
          tasksRef.current,
          taskId,
          previous,
        );
        tasksRef.current = reverted;
        setTasks(reverted);
        toast.error(result.error ?? 'Could not update task');
        return;
      }

      router.refresh();

      if (recordHistory) {
        pushUndo({
          label: 'task status',
          undo: () =>
            applyTaskStatusRef.current(taskId, previous, {
              recordHistory: false,
            }),
          redo: () =>
            applyTaskStatusRef.current(taskId, nextStatus, {
              recordHistory: false,
            }),
        });
      }
    },
    [pushUndo, router],
  );

  applyTaskStatusRef.current = handleStatusChanged;

  const handleTitleChanged = useCallback((taskId: string, title: string) => {
    setTasks((prev) => updateTaskTitleInTree(prev, taskId, title));
  }, []);

  const handleDueDateChanged = useCallback(
    (taskId: string, dueDate: string | null, dueDateLabel: string) => {
      setTasks((prev) =>
        updateTaskDueDateInTree(prev, taskId, dueDate, dueDateLabel),
      );
    },
    [],
  );

  const taskRowHandlers: TaskRowHandlers = useMemo(
    () => ({
      showWorkspaceTag,
      workspaceAccountId,
      workspaceAccountSlug,
      today: todayKey,
      currentUserId,
      expandedRootTaskIds,
      onToggleSubtasks: toggleRootExpanded,
      onStatusChanged: handleStatusChanged,
      onTitleChanged: handleTitleChanged,
      onDueDateChanged: handleDueDateChanged,
    }),
    [
      showWorkspaceTag,
      workspaceAccountId,
      workspaceAccountSlug,
      todayKey,
      currentUserId,
      expandedRootTaskIds,
      toggleRootExpanded,
      handleStatusChanged,
      handleTitleChanged,
      handleDueDateChanged,
    ],
  );

  const headerSubtitle = (() => {
    const base =
      variant === 'workspace'
        ? `${activeCount} active tasks linked to this workspace`
        : includeWorkspaceTasks
          ? `${activeCount} active tasks across personal life and your workspaces`
          : `${activeCount} active personal tasks`;
    if (overdueCount > 0) {
      return `${base} · ${overdueCount} overdue`;
    }
    return base;
  })();

  return (
    <div
      className={cn(
        workspacePageMainClassName,
        'min-h-0 text-[var(--workspace-shell-text)]',
      )}
    >
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Tasks
          </h1>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            {headerSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="h-10 w-full rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] pr-4 pl-10 text-sm text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)] focus:border-[color:var(--workspace-shell-border)] focus:outline-none"
            />
          </div>

          <TasksFilterMenu
            dueDateFilter={dueDateFilter}
            onDueDateFilterChange={setDueDateFilter}
            clientFilter={clientFilter}
            onClientFilterChange={setClientFilter}
            clientOptions={clientOptions}
            workspaceFilter={workspaceFilter}
            onWorkspaceFilterChange={(value) => {
              setWorkspaceFilter(value);
              if (value === 'personal') {
                setFilter('life');
              } else if (value !== 'all') {
                setFilter('work');
              }
            }}
            workspaceFilterOptions={workspaceFilterOptions}
            showWorkspaceFilter={
              variant === 'personal' &&
              includeWorkspaceTasks &&
              workspaceFilterOptions.length > 0
            }
            contextFilter={filter}
            onContextFilterChange={setFilter}
            showContextFilter={variant === 'personal'}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            showStatusFilter={view === 'list' || view === 'byClient'}
          />

          <TasksViewMenu view={view} onViewChange={setView} />

          <TasksShareMenu
            getRows={() => {
              if (view === 'scheduled') {
                return flattenScheduledSeriesForExport(scheduledSeries);
              }
              const source =
                view === 'board' ? filteredForBoard : filteredForList;
              return flattenTasksForExport(source);
            }}
          />

          {reviewHref ? (
            <Button
              type="button"
              variant="outline"
              asChild
              className={toolbarLabeledButtonClass}
            >
              <Link
                href={reviewHref}
                aria-label={
                  pendingReviewCount > 0
                    ? `Review ${pendingReviewCount} suggested tasks`
                    : 'Review suggested tasks'
                }
              >
                <ClipboardCheck className="h-4 w-4" />
                Review
                {pendingReviewCount > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--ozer-accent)] px-1.5 py-0.5 text-[10px] font-semibold text-[#09111F] tabular-nums">
                    {pendingReviewCount > 99 ? '99+' : pendingReviewCount}
                  </span>
                ) : null}
              </Link>
            </Button>
          ) : null}

          <div className="flex shrink-0 items-center gap-2">
            {variant === 'personal' ? (
              <AddTaskDialog lifeOnly />
            ) : workspaceAccountId ? (
              <AddTaskDialog
                workspaceAccountId={workspaceAccountId}
                workspaceAccountSlug={workspaceAccountSlug}
              />
            ) : null}
          </div>
        </div>
      </div>

      {view === 'scheduled' ? (
        <div className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
          <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Scheduled recurring tasks
            </p>
            <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
              Series that create tasks on a schedule — including ones that
              haven&apos;t spawned an open task yet.
            </p>
          </div>
          {scheduledLoading ? (
            <p className="px-4 py-8 text-sm text-[var(--workspace-shell-text-muted)]">
              Loading scheduled series…
            </p>
          ) : scheduledSeries.length === 0 ? (
            <p className="px-4 py-8 text-sm text-[var(--workspace-shell-text-muted)]">
              No active or paused recurring series yet. Turn on Repeat when
              creating or editing a task.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {scheduledSeries.map((series) => (
                <li
                  key={series.id}
                  className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-white/[0.035] sm:flex-row sm:items-center sm:justify-between"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setEditingSeries(series);
                      setEditSeriesOpen(true);
                    }}
                  >
                    <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                      {series.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                      {series.frequency}
                      {' · '}
                      next{' '}
                      {formatDueDateLabel(series.nextCreateYmd) ||
                        series.nextCreateYmd}
                      {series.dueDays > 0 ? ` · due +${series.dueDays}d` : null}
                      {' · '}
                      {series.occurrencesCreated} created
                      {series.status === 'paused' ? ' · paused' : null}
                    </p>
                  </button>
                  <div className="flex shrink-0 gap-2">
                    {series.status === 'active' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-[color:var(--workspace-shell-border)]"
                        onClick={() => {
                          void updateTaskRecurringSeriesStatusAction({
                            seriesId: series.id,
                            status: 'paused',
                          }).then(() => {
                            setScheduledSeries((prev) =>
                              prev.map((item) =>
                                item.id === series.id
                                  ? { ...item, status: 'paused' }
                                  : item,
                              ),
                            );
                          });
                        }}
                      >
                        Pause
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-[color:var(--workspace-shell-border)]"
                        onClick={() => {
                          void updateTaskRecurringSeriesStatusAction({
                            seriesId: series.id,
                            status: 'active',
                          }).then(() => {
                            setScheduledSeries((prev) =>
                              prev.map((item) =>
                                item.id === series.id
                                  ? { ...item, status: 'active' }
                                  : item,
                              ),
                            );
                          });
                        }}
                      >
                        Resume
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-[color:var(--workspace-shell-border)]"
                      onClick={() => {
                        setEditingSeries(series);
                        setEditSeriesOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <EditScheduledSeriesDialog
            series={editingSeries}
            open={editSeriesOpen}
            onOpenChange={(next) => {
              setEditSeriesOpen(next);
              if (!next) setEditingSeries(null);
            }}
            workspaceAccountId={workspaceAccountId}
            onSaved={(updated) => {
              setScheduledSeries((prev) =>
                prev.map((item) =>
                  item.id === updated.id
                    ? {
                        ...item,
                        ...updated,
                        nextCreateAt: updated.nextCreateAt ?? item.nextCreateAt,
                      }
                    : item,
                ),
              );
            }}
            onEnded={(seriesId) => {
              setScheduledSeries((prev) =>
                prev.filter((item) => item.id !== seriesId),
              );
            }}
          />
        </div>
      ) : view === 'list' || view === 'byClient' ? (
        <>
          {filteredForList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-6 py-12 text-center text-sm text-[var(--workspace-shell-text-muted)]">
              {statusFilter === 'completed'
                ? 'No completed tasks yet'
                : variant === 'workspace' && tasks.length === 0
                  ? 'No tasks linked to this workspace yet. Use Add Task and choose a project or client, or open a client record.'
                  : 'No tasks match your filters'}
            </div>
          ) : view === 'byClient' ? (
            <TasksByClientList
              groups={clientGroups}
              statusFilter={statusFilter}
              handlers={taskRowHandlers}
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
              <PriorityGroupedTaskList
                urgent={urgent}
                rest={rest}
                statusFilter={statusFilter}
                handlers={taskRowHandlers}
                inlineClientId={inlineClientId}
              />
            </div>
          )}
        </>
      ) : (
        <TasksKanbanBoard
          tasksByStatus={tasksByStatus}
          flatTasks={filteredForBoard}
          today={todayKey}
          workspaceAccountId={workspaceAccountId}
          currentUserId={currentUserId}
          onTitleChanged={handleTitleChanged}
          onStatusChanged={handleStatusChanged}
        />
      )}
    </div>
  );
}

// ─── List row ───────────────────────────────────────────────────────

function TaskRow({
  task,
  showWorkspaceTag = false,
  workspaceAccountId,
  workspaceAccountSlug,
  today,
  currentUserId,
  onStatusChanged,
  onTitleChanged,
  onDueDateChanged,
  subtasksExpanded = true,
  onToggleSubtasks,
}: {
  task: TasksPageTask;
  showWorkspaceTag?: boolean;
  workspaceAccountId?: string;
  workspaceAccountSlug?: string;
  today: string;
  currentUserId?: string | null;
  onStatusChanged?: (
    taskId: string,
    status: TaskStatus,
  ) => void | Promise<void>;
  onTitleChanged?: (taskId: string, title: string) => void;
  onDueDateChanged?: (
    taskId: string,
    dueDate: string | null,
    dueDateLabel: string,
  ) => void;
  /** When false, nested subtasks are hidden (root parents only). */
  subtasksExpanded?: boolean;
  onToggleSubtasks?: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isDone = task.status === 'completed';
  const isRoot = !task.parentTaskId;
  const subtasks = task.subtasks ?? [];
  const subCount = subtasks.length;
  const doneSubCount = subtasks.filter((s) => s.status === 'completed').length;
  const overdue = isOverdue(task, today);

  const handleCheckedChange = (checked: boolean) => {
    const next: TaskStatus = checked ? 'completed' : 'pending';
    startTransition(() => {
      void onStatusChanged?.(task.id, next);
    });
  };

  const showSubtasks = subtasksExpanded && subtasks.length > 0;
  const showExpandToggle = isRoot && subtasks.length > 0 && onToggleSubtasks;

  const rowGrid = taskListRowGridClass();
  const clientColor = task.accentColor ?? task.workspaceColor;

  const openEdit = () => setEditOpen(true);

  return (
    <div className={cn('relative', !isRoot && 'pl-6 sm:pl-8')}>
      {!isRoot ? (
        <>
          <span
            aria-hidden
            className="absolute top-0 bottom-0 left-3 w-px bg-white/[0.12] sm:left-4"
          />
          <span
            aria-hidden
            className="absolute top-1/2 left-3 h-px w-3 bg-white/[0.16] sm:left-4 sm:w-4"
          />
        </>
      ) : null}
      <div
        role="button"
        tabIndex={0}
        onClick={openEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openEdit();
          }
        }}
        className={cn(
          rowGrid,
          overdue &&
            'border-l-[3px] border-l-rose-500 bg-rose-500/[0.07] ring-1 ring-rose-400/20 ring-inset hover:bg-rose-500/[0.09]',
          !overdue && 'hover:bg-white/[0.035]',
          !isRoot && !overdue && 'bg-transparent hover:bg-white/[0.025]',
          'relative cursor-pointer border-b border-[color:var(--workspace-shell-border)] transition-colors',
        )}
      >
        <div className="flex justify-start pt-0.5" data-task-row-action>
          <Checkbox
            checked={isDone}
            disabled={isPending}
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={(value) => {
              if (value === 'indeterminate') return;
              handleCheckedChange(Boolean(value));
            }}
            aria-label={isDone ? 'Mark task as not done' : 'Mark task as done'}
            className="h-5 w-5 shrink-0 rounded-full border-[color:var(--workspace-shell-border)] shadow-none data-[state=checked]:border-[var(--ozer-accent)] data-[state=checked]:bg-[var(--ozer-accent-subtle)] data-[state=checked]:text-[var(--ozer-accent)]"
          />
        </div>
        <div className="min-w-0 pr-1">
          <InlineTaskTitle
            taskId={task.id}
            title={task.title}
            isDone={isDone}
            readOnly
          />
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <TaskAssigneeChip task={task} currentUserId={currentUserId} />
            {isRoot && subCount > 0 ? (
              <div className="flex items-center gap-0.5">
                <span
                  className="text-[10px] font-normal text-[var(--workspace-shell-text-muted)] tabular-nums"
                  title="Subtasks completed / total"
                >
                  {doneSubCount}/{subCount}
                </span>
                {showExpandToggle ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSubtasks?.();
                    }}
                    className="rounded p-0.5 text-[var(--workspace-shell-text-muted)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
                    aria-expanded={subtasksExpanded}
                    aria-label={
                      subtasksExpanded ? 'Collapse subtasks' : 'Expand subtasks'
                    }
                  >
                    {subtasksExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="sm:hidden">
          <TaskRowMetaColumn
            taskId={task.id}
            dueDate={task.dueDate}
            dueDateLabel={task.dueDateLabel}
            overdue={overdue}
            calendarScheduleStatus={task.calendarScheduleStatus}
            clientName={task.clientName}
            clientColor={clientColor}
            clientPictureUrl={task.clientPictureUrl}
            onDueDateChanged={onDueDateChanged}
          />
        </div>
        <div className="hidden sm:block">
          <InlineDueDate
            taskId={task.id}
            dueDate={task.dueDate}
            dueDateLabel={task.dueDateLabel}
            overdue={overdue}
            calendarScheduleStatus={task.calendarScheduleStatus}
            onDueDateChanged={onDueDateChanged}
          />
        </div>
        <div className="hidden sm:block">
          <ClientCell
            name={task.clientName}
            color={clientColor}
            pictureUrl={task.clientPictureUrl}
          />
        </div>
        <PriorityIndicator priority={task.priority} />
      </div>

      {showSubtasks ? (
        <div className="divide-y divide-white/[0.05]">
          {subtasks.map((st) => (
            <TaskRow
              key={st.id}
              task={st}
              showWorkspaceTag={showWorkspaceTag}
              workspaceAccountId={workspaceAccountId}
              workspaceAccountSlug={workspaceAccountSlug}
              today={today}
              currentUserId={currentUserId}
              onStatusChanged={onStatusChanged}
              onTitleChanged={onTitleChanged}
              onDueDateChanged={onDueDateChanged}
            />
          ))}
        </div>
      ) : null}

      <EditTaskDialog
        task={task}
        open={editOpen}
        onOpenChange={setEditOpen}
        workspaceAccountId={workspaceAccountId}
        workspaceAccountSlug={workspaceAccountSlug}
      />
    </div>
  );
}
