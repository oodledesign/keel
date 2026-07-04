'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

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

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';

import { Button } from '@kit/ui/button';
import { Avatar, AvatarFallback } from '@kit/ui/avatar';
import { Checkbox } from '@kit/ui/checkbox';
import { cn } from '@kit/ui/utils';
import { workspacePageMainClassName } from '~/components/workspace-shell/workspace-shell-styles';
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

import { compareYmd, parseDueDateParts, toIsoDateString } from '../../../_lib/due-date-ymd';
import type { TasksPageTask } from '../../_lib/server/tasks.loader';
import { updateTask } from '../../_lib/actions/task-actions';
import { AddTaskDialog } from '../../_components/dashboard/add-task-dialog';
import { EditTaskDialog } from './edit-task-dialog';
import { InlineAddTaskRow } from './inline-add-task-row';

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

/** List row: expand · done · title · due (icon + label) · client (avatar + name) · priority */
function taskListRowGridClass() {
  return cn(
    'grid items-center gap-x-2 px-2 py-2.5 sm:gap-x-3 sm:px-4',
    // Mobile: expand · checkbox · title · date + client · priority
    'grid-cols-[1.25rem_1.5rem_minmax(0,1fr)_auto_1.25rem]',
    // Desktop: separate due date and client columns
    'sm:grid-cols-[1.25rem_1.5rem_minmax(0,1fr)_minmax(5.5rem,7.5rem)_minmax(6rem,10rem)_1.75rem]',
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
    return compact ? null : <span className="inline-block min-h-6 shrink-0" aria-hidden />;
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
      <span className="truncate text-xs text-[var(--workspace-shell-text-muted)]">{name}</span>
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
          <CalendarDays className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
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
          title={overdue ? `Overdue · ${dueDateLabel}` : dueDateLabel || 'Set due date'}
          aria-label={dueDateLabel ? `Edit due date ${dueDateLabel}` : 'Set due date'}
        >
          {dueDateLabel ? (
            <>
              <CalendarDays
                className={cn(
                  'h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4',
                  overdue ? 'text-rose-400' : 'text-[var(--workspace-shell-text-muted)]',
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
              overdue ? 'text-rose-400' : 'text-[var(--workspace-shell-text-muted)]',
            )}
            aria-hidden
          />
          <span
            className={cn(
              'truncate text-[11px] tabular-nums sm:text-xs',
              overdue ? 'font-medium text-rose-400' : 'text-[var(--workspace-shell-text-muted)]',
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

function PriorityGroupHeader({
  variant,
}: {
  variant: 'high' | 'rest';
}) {
  const isHigh = variant === 'high';
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b border-[color:var(--workspace-shell-border)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide',
        isHigh
          ? 'bg-amber-500/[0.07] text-amber-400/95'
          : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
      )}
    >
      {isHigh ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      ) : null}
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          isHigh ? 'bg-amber-400' : 'bg-[var(--workspace-shell-panel-hover)]/70',
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
              <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">{group.label}</p>
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
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--ozer-accent)]" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn('w-56', dropdownContentClass)}>
        <DropdownMenuLabel className="text-xs text-[var(--workspace-shell-text-muted)]">Due date</DropdownMenuLabel>
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
              className="focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
            >
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        {props.showStatusFilter ? (
          <>
            <DropdownMenuSeparator className="bg-[var(--workspace-shell-sidebar-accent)]" />
            <DropdownMenuLabel className="text-xs text-[var(--workspace-shell-text-muted)]">Status</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={props.statusFilter}
              onValueChange={(value) =>
                props.onStatusFilterChange(value as 'active' | 'completed')
              }
            >
              <DropdownMenuRadioItem
                value="active"
                className="focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
              >
                Active
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="completed"
                className="focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
              >
                Completed
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        ) : null}

        {props.showContextFilter ? (
          <>
            <DropdownMenuSeparator className="bg-[var(--workspace-shell-sidebar-accent)]" />
            <DropdownMenuLabel className="text-xs text-[var(--workspace-shell-text-muted)]">Scope</DropdownMenuLabel>
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
                  className="capitalize focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
                >
                  {value}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : null}

        {props.showWorkspaceFilter && props.workspaceFilterOptions.length > 0 ? (
          <>
            <DropdownMenuSeparator className="bg-[var(--workspace-shell-sidebar-accent)]" />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]">
                Workspace · {workspaceLabel}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className={dropdownContentClass}>
                <DropdownMenuRadioGroup
                  value={props.workspaceFilter}
                  onValueChange={props.onWorkspaceFilterChange}
                >
                  <DropdownMenuRadioItem
                    value="all"
                    className="focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
                  >
                    All workspaces
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="personal"
                    className="focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
                  >
                    Personal only
                  </DropdownMenuRadioItem>
                  {props.workspaceFilterOptions.map((ws) =>
                    ws.slug ? (
                      <DropdownMenuRadioItem
                        key={ws.slug}
                        value={ws.slug}
                        className="focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
                      >
                        {ws.name}
                      </DropdownMenuRadioItem>
                    ) : null,
                  )}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        ) : null}

        {props.clientOptions.length > 0 ? (
          <>
            <DropdownMenuSeparator className="bg-[var(--workspace-shell-sidebar-accent)]" />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]">
                Client · {clientLabel}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className={dropdownContentClass}>
                <DropdownMenuRadioGroup
                  value={props.clientFilter}
                  onValueChange={props.onClientFilterChange}
                >
                  <DropdownMenuRadioItem
                    value="all"
                    className="focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
                  >
                    All clients
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="__none__"
                    className="focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
                  >
                    No client
                  </DropdownMenuRadioItem>
                  {props.clientOptions.map(([id, name]) => (
                    <DropdownMenuRadioItem
                      key={id}
                      value={id}
                      className="focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
                    >
                      {name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
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
      <DropdownMenuContent align="end" className={cn('w-44', dropdownContentClass)}>
        <DropdownMenuLabel className="text-xs text-[var(--workspace-shell-text-muted)]">View</DropdownMenuLabel>
        {views.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => props.onViewChange(value)}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden hover:bg-[var(--workspace-shell-sidebar-accent)]',
              props.view === value ? 'text-[var(--workspace-shell-text)]' : 'text-[var(--workspace-shell-text-muted)]',
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
  const router = useRouter();
  const [tasks, setTasks] = useState<TasksPageTask[]>(initialTasks);
  const [view, setView] = useState<TaskViewMode>('list');
  const [filter, setFilter] = useState<'all' | 'work' | 'life'>(() =>
    variant === 'workspace'
      ? 'work'
      : includeWorkspaceTasks
        ? 'all'
        : 'life',
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
  const [activeDragTask, setActiveDragTask] = useState<TasksPageTask | null>(
    null,
  );
  const [, startTransition] = useTransition();

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
      if (
        variant !== 'workspace' &&
        filter !== 'all' &&
        t.context !== filter
      ) {
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
    [variant, filter, workspaceFilter, clientFilter, search, dueDateFilter, todayKey],
  );

  const filteredForList = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter === 'active' && t.status === 'completed') return false;
      if (statusFilter === 'completed' && t.status !== 'completed') return false;
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
          : (t.clientName?.trim() || 'Client');
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
    clientFilter !== 'all' && clientFilter !== '__none__'
      ? clientFilter
      : null;

  const activeCount = useMemo(
    () => tasks.filter((t) => t.status !== 'completed').length,
    [tasks],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      const found = tasks.find((t) => t.id === id);
      setActiveDragTask(found ?? null);
    },
    [tasks],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragTask(null);
      const { active, over } = event;
      if (!over) return;

      const taskId = String(active.id);
      const overId = String(over.id);
      const overStatus = (over.data.current as { status?: TaskStatus } | null)
        ?.status;
      let newStatus: TaskStatus | null = null;
      if (overStatus) {
        newStatus = overStatus;
      } else if (overId.startsWith('status-')) {
        newStatus = overId.replace('status-', '') as TaskStatus;
      } else {
        const target = tasks.find((t) => t.id === overId);
        if (target) newStatus = target.status;
      }
      if (!newStatus) return;

      const current = tasks.find((t) => t.id === taskId);
      if (!current || current.status === newStatus) return;

      const previousStatus = current.status;
      handleStatusChanged(taskId, newStatus);
      startTransition(async () => {
        const result = await updateTask(taskId, { status: newStatus! });
        if (!result.success) {
          handleStatusChanged(taskId, previousStatus);
        } else {
          router.refresh();
        }
      });
    },
    [tasks, handleStatusChanged, router],
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
    <div className={cn(workspacePageMainClassName, 'min-h-0 text-[var(--workspace-shell-text)]')}>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Tasks
          </h1>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">{headerSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="h-10 w-full rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] pl-10 pr-4 text-sm text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)] focus:border-[color:var(--workspace-shell-border)] focus:outline-none"
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

          <div className="shrink-0">
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {STATUS_COLUMNS.map((col) => (
              <BoardColumn
                key={col.key}
                column={col}
                tasks={(tasksByStatus.get(col.key) ?? []).filter(
                  (t) => !t.parentTaskId,
                )}
                today={todayKey}
                workspaceAccountId={workspaceAccountId}
                onTitleChanged={handleTitleChanged}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDragTask ? (
              <BoardCard
                task={activeDragTask}
                today={todayKey}
                workspaceAccountId={workspaceAccountId}
                onTitleChanged={handleTitleChanged}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

// ─── List row ───────────────────────────────────────────────────────

function InlineTaskTitle({
  taskId,
  title,
  isDone,
  onTitleChanged,
  isolatePointer,
  readOnly,
}: {
  taskId: string;
  title: string;
  isDone: boolean;
  onTitleChanged?: (taskId: string, title: string) => void;
  /** Stops dnd-kit drag sensors on this control (board cards). */
  isolatePointer?: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  const save = useCallback(() => {
    if (readOnly) return;
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(title);
      return;
    }
    if (trimmed === title) return;
    const prev = title;
    onTitleChanged?.(taskId, trimmed);
    void (async () => {
      const result = await updateTask(taskId, { title: trimmed });
      if (!result.success) {
        onTitleChanged?.(taskId, prev);
      }
      router.refresh();
    })();
  }, [draft, onTitleChanged, readOnly, router, taskId, title]);

  const cancel = useCallback(() => {
    setDraft(title);
    setEditing(false);
  }, [title]);

  if (readOnly) {
    return (
      <p
        className={`truncate text-[13px] font-medium leading-snug ${
          isDone ? 'text-[var(--workspace-shell-text-muted)] line-through' : 'text-[var(--workspace-shell-text)]'
        }`}
      >
        {title}
      </p>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPointerDown={(e) => isolatePointer && e.stopPropagation()}
        onClick={(e) => isolatePointer && e.stopPropagation()}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        className="w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 py-1 text-sm font-medium leading-snug text-[var(--workspace-shell-text)] shadow-none outline-none focus-visible:ring-1 focus-visible:ring-white/25"
        aria-label="Task title"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      onPointerDown={(e) => isolatePointer && e.stopPropagation()}
      className={`w-full min-w-0 rounded-sm text-left text-sm font-medium leading-snug transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/30 ${
        isDone ? 'text-[var(--workspace-shell-text-muted)] line-through' : 'text-[var(--workspace-shell-text)]'
      }`}
      aria-label="Edit title"
    >
      {title}
    </button>
  );
}

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
    <div
      className={cn(
        'relative',
        !isRoot && 'pl-6 sm:pl-8',
      )}
    >
      {!isRoot ? (
        <>
          <span
            aria-hidden
            className="absolute bottom-0 left-3 top-0 w-px bg-white/[0.12] sm:left-4"
          />
          <span
            aria-hidden
            className="absolute left-3 top-1/2 h-px w-3 bg-white/[0.16] sm:left-4 sm:w-4"
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
            'border-l-[3px] border-l-rose-500 bg-rose-500/[0.07] ring-1 ring-inset ring-rose-400/20 hover:bg-rose-500/[0.09]',
          !overdue && 'hover:bg-white/[0.035]',
          !isRoot && !overdue && 'bg-transparent hover:bg-white/[0.025]',
          'relative cursor-pointer border-b border-[color:var(--workspace-shell-border)] transition-colors',
        )}
      >
        <div className="flex justify-center" data-task-row-action>
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
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="inline-block w-3 shrink-0" aria-hidden />
          )}
        </div>
        <div className="flex justify-center pt-0.5" data-task-row-action>
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
            <span
              className="mt-0.5 block text-[10px] font-normal tabular-nums text-[var(--workspace-shell-text-muted)]"
              title="Subtasks completed / total"
            >
              {doneSubCount}/{subCount}
            </span>
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

// ─── Board column / card ────────────────────────────────────────────

function BoardColumn({
  column,
  tasks,
  today,
  workspaceAccountId,
  onTitleChanged,
}: {
  column: (typeof STATUS_COLUMNS)[number];
  tasks: TasksPageTask[];
  today: string;
  workspaceAccountId?: string;
  onTitleChanged: (taskId: string, title: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `status-${column.key}`,
    data: { status: column.key },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[200px] flex-col rounded-2xl border border-[color:var(--workspace-shell-border)] transition-colors ${
        isOver ? 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]' : 'bg-[var(--workspace-shell-panel)]'
      }`}
    >
      <div
        className="flex items-center justify-between rounded-t-2xl px-4 py-3"
        style={{ backgroundColor: column.tint }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: column.dot }}
          />
          <span className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            {column.label}
          </span>
        </div>
        <span className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-3 py-8 text-center text-xs text-[var(--workspace-shell-text-muted)]">
            Drop tasks here
          </div>
        ) : (
          tasks.map((t) => (
            <BoardCard
              key={t.id}
              task={t}
              today={today}
              workspaceAccountId={workspaceAccountId}
              onTitleChanged={onTitleChanged}
            />
          ))
        )}
      </div>
    </div>
  );
}

function BoardCard({
  task,
  today,
  workspaceAccountId,
  onTitleChanged,
  isOverlay = false,
}: {
  task: TasksPageTask;
  today: string;
  workspaceAccountId?: string;
  onTitleChanged?: (taskId: string, title: string) => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });
  const [editOpen, setEditOpen] = useState(false);

  const overdue = isOverdue(task, today);
  const priorityCfg = priorityConfig[task.priority];
  const isDone = task.status === 'completed';
  const subCount = task.subtasks?.length ?? 0;
  const doneSubCount =
    task.subtasks?.filter((s) => s.status === 'completed').length ?? 0;

  const style: React.CSSProperties = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : {};

  const baseClass = overdue
    ? 'rounded-xl border border-rose-400/30 border-l-[3px] border-l-rose-500 bg-rose-500/[0.08]'
    : 'rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)]';
  const interactClass = isOverlay
    ? 'shadow-[0_18px_48px_rgba(4,10,24,0.45)]'
    : isDragging
      ? 'opacity-40'
      : 'hover:border-[color:var(--workspace-shell-border)]';

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => {
          if (!isOverlay) setEditOpen(true);
        }}
        className={`group cursor-grab touch-none p-3 text-left transition-colors active:cursor-grabbing ${baseClass} ${interactClass}`}
      >
        <div className="min-w-0">
          <InlineTaskTitle
            taskId={task.id}
            title={task.title}
            isDone={isDone}
            onTitleChanged={onTitleChanged}
            isolatePointer
            readOnly={isOverlay}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--workspace-shell-text-muted)]">
          {overdue && <OverduePill dueDate={task.dueDate} compact />}
          {task.clientName && (
            <span className="rounded bg-[var(--workspace-shell-sidebar-accent)] px-1.5 py-0.5 font-medium text-[var(--workspace-shell-text-muted)]">
              {task.clientName}
            </span>
          )}
          {(task.projectName || task.areaLabel) && (
            <span className="flex items-center gap-1">
              {task.accentColor && (
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: task.accentColor }}
                />
              )}
              {task.projectName ?? task.areaLabel}
            </span>
          )}
          {!overdue && task.dueDateLabel && <span>{task.dueDateLabel}</span>}
          {task.priority !== 'low' && task.priority !== 'medium' && (
            <span className={`flex items-center gap-0.5 font-medium ${priorityCfg.className}`}>
              {task.priority === 'urgent' && <Flame className="h-3 w-3" />}
              {priorityCfg.label}
            </span>
          )}
          {subCount > 0 && (
            <span className="rounded bg-[var(--workspace-shell-sidebar-accent)] px-1.5 py-0.5 text-[var(--workspace-shell-text-muted)]">
              {doneSubCount}/{subCount} complete
            </span>
          )}
        </div>
      </div>

      {!isOverlay && (
        <EditTaskDialog
          task={task}
          open={editOpen}
          onOpenChange={setEditOpen}
          workspaceAccountId={workspaceAccountId}
        />
      )}
    </>
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
