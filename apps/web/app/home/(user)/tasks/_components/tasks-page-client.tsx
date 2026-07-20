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
  Flame,
  KanbanSquare,
  List as ListIcon,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@kit/ui/avatar';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { cn } from '@kit/ui/utils';

import { workspacePageMainClassName } from '~/components/workspace-shell/workspace-shell-styles';
import pathsConfig from '~/config/paths.config';

import {
  compareYmd,
  parseDueDateParts,
  toIsoDateString,
} from '../../../_lib/due-date-ymd';
import { AddTaskDialog } from '../../_components/dashboard/add-task-dialog';
import { updateTask } from '../../_lib/actions/task-actions';
import type { TasksPageTask } from '../../_lib/server/tasks.loader';
import { InlineAddTaskRow } from './inline-add-task-row';
import { InlineTaskTitle } from './tasks-inline-task-title';

const EditTaskDialog = dynamic(
  () => import('./edit-task-dialog').then((mod) => mod.EditTaskDialog),
  { ssr: false },
);

const TasksKanbanBoard = dynamic(
  () => import('./tasks-kanban-board').then((mod) => mod.TasksKanbanBoard),
  { ssr: false },
);

type TaskStatus = TasksPageTask['status'];

const priorityConfig: Record<
  TasksPageTask['priority'],
  { label: string; className: string }
> = {
  low: { label: 'Low', className: 'text-[var(--workspace-shell-text-muted)]' },
  medium: { label: 'Medium', className: 'text-blue-400' },
  high: { label: 'High', className: 'text-amber-400' },
  urgent: { label: 'Urgent', className: 'text-rose-400' },
};

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

const STATUS_LABEL: Record<TaskStatus, string> = STATUS_COLUMNS.reduce(
  (acc, c) => ({ ...acc, [c.key]: c.label }),
  {} as Record<TaskStatus, string>,
);

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
  compact = false,
}: {
  name: string | null;
  color?: string | null;
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

function TaskRowMetaColumn({
  taskId,
  dueDate,
  dueDateLabel,
  overdue,
  calendarScheduleStatus,
  clientName,
  clientColor,
  onDueDateChanged,
}: {
  taskId: string;
  dueDate: string | null;
  dueDateLabel: string;
  overdue: boolean;
  calendarScheduleStatus?: 'scheduled' | 'failed' | null;
  clientName: string | null;
  clientColor?: string | null;
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
      <ClientCell name={clientName} color={clientColor} compact />
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
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isoValue = dueDate ? (toIsoDateString(dueDate) ?? '') : '';

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    try {
      el.showPicker?.();
    } catch {
      // showPicker may throw if not triggered by user gesture
    }
  }, [editing]);

  const save = useCallback(
    async (raw: string) => {
      setEditing(false);
      const normalized = raw.trim() ? toIsoDateString(raw.trim()) : null;
      const current = dueDate ? toIsoDateString(dueDate) : null;
      if (normalized === current) {
        return;
      }

      const prevDate = dueDate;
      const prevLabel = dueDateLabel;
      const nextLabel = formatDueDateLabel(normalized);

      onDueDateChanged?.(taskId, normalized, nextLabel);
      setPending(true);
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

  if (!dueDateLabel && !calendarScheduleStatus && !editing) {
    return (
      <span
        className={cn(
          'flex min-w-0 flex-col gap-1',
          align === 'end' && 'items-end',
        )}
        data-task-row-action
      >
        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className={cn(
            'inline-flex min-h-4 items-center gap-1 rounded px-1 py-0.5 text-[11px] text-[var(--workspace-shell-text-muted)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)] sm:text-xs',
            align === 'end' && 'justify-end',
            pending && 'opacity-60',
          )}
          aria-label="Set due date"
        >
          <CalendarDays
            className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
            aria-hidden
          />
          <span>Add date</span>
        </button>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'flex min-w-0 flex-col gap-1',
        align === 'end' && 'items-end',
      )}
      data-task-row-action
    >
      {editing ? (
        <input
          ref={inputRef}
          type="date"
          defaultValue={isoValue}
          disabled={pending}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            void save(e.target.value);
          }}
          onBlur={(e) => {
            if (e.target.value !== isoValue) {
              void save(e.target.value);
            } else {
              setEditing(false);
            }
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(false);
            }
          }}
          className={cn(
            'max-w-full rounded border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-1.5 py-0.5 text-[11px] text-[var(--workspace-shell-text)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--ozer-accent)]/50 sm:text-xs',
            align === 'end' && 'text-right',
          )}
        />
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className={cn(
            'flex min-w-0 items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]',
            align === 'end' && 'justify-end',
            pending && 'opacity-60',
          )}
          title={
            overdue
              ? `Overdue · ${dueDateLabel}`
              : dueDateLabel || 'Set due date'
          }
          aria-label={
            dueDateLabel ? `Edit due date ${dueDateLabel}` : 'Set due date'
          }
        >
          {dueDateLabel ? (
            <>
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
            </>
          ) : (
            <>
              <CalendarDays
                className="h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text-muted)] sm:h-4 sm:w-4"
                aria-hidden
              />
              <span className="text-[11px] text-[var(--workspace-shell-text-muted)] sm:text-xs">
                Add date
              </span>
            </>
          )}
        </button>
      )}
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

type TaskViewMode = 'list' | 'board' | 'byClient';
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

function PriorityGroupHeader({ variant }: { variant: 'high' | 'rest' }) {
  const isHigh = variant === 'high';
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b border-[color:var(--workspace-shell-border)] px-4 py-2 text-[11px] font-semibold tracking-wide uppercase',
        isHigh
          ? 'bg-amber-500/[0.07] text-amber-400/95'
          : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
      )}
    >
      {isHigh ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : null}
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          isHigh
            ? 'bg-amber-400'
            : 'bg-[var(--workspace-shell-panel-hover)]/70',
        )}
        aria-hidden
      />
      {isHigh ? 'High priority' : 'Everything else'}
    </div>
  );
}

type TaskRowHandlers = {
  showWorkspaceTag: boolean;
  workspaceAccountId?: string;
  today: string;
  expandedRootTaskIds: Set<string>;
  onToggleSubtasks: (taskId: string) => void;
  onStatusChanged: (taskId: string, status: TaskStatus) => void;
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
      today={handlers.today}
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
  const showActiveGroups = statusFilter === 'active';

  return (
    <>
      {showActiveGroups && urgent.length > 0 && (
        <>
          <PriorityGroupHeader variant="high" />
          {renderTaskRows(urgent, handlers)}
          <InlineAddTaskRow
            priority="high"
            clientId={inlineClientId}
            workspaceAccountId={handlers.workspaceAccountId}
          />
        </>
      )}
      {showActiveGroups && urgent.length > 0 && rest.length > 0 && (
        <PriorityGroupHeader variant="rest" />
      )}
      {showActiveGroups && urgent.length === 0 && rest.length > 0 && (
        <PriorityGroupHeader variant="rest" />
      )}
      {rest.length > 0 && (
        <>
          {renderTaskRows(rest, handlers)}
          <InlineAddTaskRow
            priority="medium"
            clientId={inlineClientId}
            workspaceAccountId={handlers.workspaceAccountId}
          />
        </>
      )}
      {!showActiveGroups && (
        <>
          {renderTaskRows([...urgent, ...rest], handlers)}
          <InlineAddTaskRow
            priority="medium"
            clientId={inlineClientId}
            workspaceAccountId={handlers.workspaceAccountId}
          />
        </>
      )}
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

function isOverdue(task: TasksPageTask, today = todayISO()): boolean {
  if (task.status === 'completed') return false;
  const due = parseDueDateParts(task.dueDate);
  const t = parseDueDateParts(today);
  if (!due || !t) return false;
  return compareYmd(due, t) < 0;
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

const toolbarIconButtonClass =
  'relative h-10 w-10 shrink-0 rounded-xl border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text-muted)] hover:bg-white/8 hover:text-[var(--workspace-shell-text)]';

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
          size="icon"
          aria-label="Filter tasks"
          className={toolbarIconButtonClass}
        >
          <SlidersHorizontal className="h-4 w-4" />
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
  ];

  const current = views.find((item) => item.value === props.view) ?? views[0]!;
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Change task view"
          className={toolbarIconButtonClass}
        >
          <CurrentIcon className="h-4 w-4" />
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
};

export function TasksPageClient({
  initialTasks,
  variant = 'personal',
  workspaceAccountId,
  workspaceAccountSlug,
  includeWorkspaceTasks = true,
  initialWorkspaceFilter = 'all',
}: Props) {
  const [tasks, setTasks] = useState<TasksPageTask[]>(initialTasks);
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

  const todayKey = todayISO();

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
        const inNotes = (t.notes ?? '').toLowerCase().includes(q);
        const inWorkspace = (t.workspaceName ?? '').toLowerCase().includes(q);
        const inClient = (t.clientName ?? '').toLowerCase().includes(q);
        if (!inTitle && !inNotes && !inWorkspace && !inClient) {
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

  const handleStatusChanged = useCallback(
    (taskId: string, nextStatus: TaskStatus) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t)),
      );
    },
    [],
  );

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
      today: todayKey,
      expandedRootTaskIds,
      onToggleSubtasks: toggleRootExpanded,
      onStatusChanged: handleStatusChanged,
      onTitleChanged: handleTitleChanged,
      onDueDateChanged: handleDueDateChanged,
    }),
    [
      showWorkspaceTag,
      workspaceAccountId,
      todayKey,
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

          <div className="flex shrink-0 items-center gap-2">
            {variant === 'workspace' && workspaceAccountSlug ? (
              <Button
                asChild
                type="button"
                variant="outline"
                size="sm"
                className="h-10 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
              >
                <Link
                  href={pathsConfig.app.accountTasksImport.replace(
                    '[account]',
                    workspaceAccountSlug,
                  )}
                >
                  Import CSV
                </Link>
              </Button>
            ) : null}
            {variant === 'personal' ? (
              <AddTaskDialog />
            ) : workspaceAccountId ? (
              <AddTaskDialog
                workspaceAccountId={workspaceAccountId}
                workspaceAccountSlug={workspaceAccountSlug}
              />
            ) : null}
          </div>
        </div>
      </div>

      {view === 'list' || view === 'byClient' ? (
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
  today,
  onStatusChanged,
  onTitleChanged,
  onDueDateChanged,
  subtasksExpanded = true,
  onToggleSubtasks,
}: {
  task: TasksPageTask;
  showWorkspaceTag?: boolean;
  workspaceAccountId?: string;
  today: string;
  onStatusChanged?: (taskId: string, status: TaskStatus) => void;
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
  const router = useRouter();
  const isDone = task.status === 'completed';
  const isRoot = !task.parentTaskId;
  const subtasks = task.subtasks ?? [];
  const subCount = subtasks.length;
  const doneSubCount = subtasks.filter((s) => s.status === 'completed').length;
  const overdue = isOverdue(task, today);

  const handleCheckedChange = (checked: boolean) => {
    const next: TaskStatus = checked ? 'completed' : 'pending';
    onStatusChanged?.(task.id, next);
    startTransition(async () => {
      const result = await updateTask(task.id, { status: next });
      if (result.success) {
        router.refresh();
      }
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
          {isRoot && subCount > 0 ? (
            <div className="mt-0.5 flex items-center gap-0.5">
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
        <div className="sm:hidden">
          <TaskRowMetaColumn
            taskId={task.id}
            dueDate={task.dueDate}
            dueDateLabel={task.dueDateLabel}
            overdue={overdue}
            calendarScheduleStatus={task.calendarScheduleStatus}
            clientName={task.clientName}
            clientColor={clientColor}
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
          <ClientCell name={task.clientName} color={clientColor} />
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
              today={today}
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
      />
    </div>
  );
}

// ─── Status / overdue pills ─────────────────────────────────────────

function StatusPill({
  status,
  compact = false,
}: {
  status: TaskStatus;
  compact?: boolean;
}) {
  const col = STATUS_COLUMNS.find((c) => c.key === status);
  if (!col) return null;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-[5px] font-medium text-[var(--workspace-shell-text)]',
        compact
          ? 'px-1.5 py-0 text-[11px] leading-5'
          : 'px-1.5 py-0.5 text-xs leading-5',
      )}
      style={{ backgroundColor: col.tint }}
    >
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: col.dot }}
      />
      <span className="truncate">{STATUS_LABEL[status]}</span>
    </span>
  );
}

function OverduePill({
  dueDate,
  compact = false,
}: {
  dueDate: string | null;
  compact?: boolean;
}) {
  const label = compact
    ? 'Overdue'
    : dueDate
      ? `Overdue · ${formatOverdueDate(dueDate)}`
      : 'Overdue';
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-[5px] border border-rose-400/25 bg-rose-500/12 font-medium text-rose-200',
        compact
          ? 'px-1.5 py-0 text-[11px] leading-5'
          : 'px-1.5 py-0.5 text-xs leading-5',
      )}
    >
      <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function formatOverdueDate(iso: string): string {
  const p = parseDueDateParts(iso);
  if (!p) return iso;
  const d = new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return iso;
  const cy = new Date().getFullYear();
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(p.y !== cy ? { year: 'numeric' as const } : {}),
  });
}
