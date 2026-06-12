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
  ChevronDown,
  ChevronRight,
  Flame,
  KanbanSquare,
  List as ListIcon,
  Pencil,
  Search,
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
import { Checkbox } from '@kit/ui/checkbox';
import { cn } from '@kit/ui/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import { compareYmd, parseDueDateParts } from '../../../_lib/due-date-ymd';
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
  low: { label: 'Low', className: 'text-zinc-400' },
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
    dot: 'var(--keel-teal)',
    tint: 'rgba(87,200,127,0.10)',
  },
];

const STATUS_LABEL: Record<TaskStatus, string> = STATUS_COLUMNS.reduce(
  (acc, c) => ({ ...acc, [c.key]: c.label }),
  {} as Record<TaskStatus, string>,
);

/** Shared grid for list header + task rows (ClickUp-style columns). */
function taskListRowGridClass(showWorkspace: boolean) {
  return showWorkspace
    ? 'grid grid-cols-[1.25rem_1.5rem_minmax(260px,1.65fr)_minmax(120px,0.75fr)_minmax(130px,0.8fr)_minmax(140px,0.85fr)_6.75rem_5.5rem_4.75rem_2.25rem] items-center gap-x-2 px-3 py-2 sm:gap-x-3 sm:px-4'
    : 'grid grid-cols-[1.25rem_1.5rem_minmax(280px,1.8fr)_minmax(140px,0.9fr)_minmax(150px,1fr)_6.75rem_5.5rem_4.75rem_2.25rem] items-center gap-x-2 px-3 py-2 sm:gap-x-3 sm:px-4';
}

function TaskTableHeader({ showWorkspaceTag }: { showWorkspaceTag: boolean }) {
  const g = taskListRowGridClass(showWorkspaceTag);
  return (
    <div
      className={cn(
        g,
        'border-b border-white/10 bg-white/[0.04] text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500',
      )}
      role="row"
    >
      <span aria-hidden className="block w-3 shrink-0" />
      <span className="sr-only">Done</span>
      <span className="truncate">Name</span>
      {showWorkspaceTag ? <span className="truncate">Workspace</span> : null}
      <span className="truncate">Client</span>
      <span className="truncate">List</span>
      <span className="truncate">Due</span>
      <span className="truncate">Status</span>
      <span className="truncate">Priority</span>
      <span className="sr-only">Edit</span>
    </div>
  );
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
        'flex items-center gap-2 border-b border-white/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide',
        isHigh
          ? 'bg-amber-500/[0.07] text-amber-400/95'
          : 'bg-white/[0.03] text-zinc-500',
      )}
    >
      {isHigh ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      ) : null}
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          isHigh ? 'bg-amber-400' : 'bg-zinc-500/70',
        )}
        aria-hidden
      />
      {isHigh ? 'High priority' : 'Everything else'}
    </div>
  );
}

function WorkspaceColorChip({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[11px] font-medium text-white/90">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="truncate">{name}</span>
    </span>
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
            className="overflow-x-auto rounded-xl border border-white/6 bg-[var(--workspace-shell-panel)] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
          >
            <div className="border-b border-white/8 bg-white/[0.04] px-4 py-2.5">
              <p className="text-sm font-semibold text-white">{group.label}</p>
              <p className="text-xs text-zinc-500">
                {group.tasks.length} task{group.tasks.length === 1 ? '' : 's'}
              </p>
            </div>
            <div
              className={cn(
                handlers.showWorkspaceTag ? 'min-w-[1080px]' : 'min-w-[940px]',
              )}
            >
              <TaskTableHeader showWorkspaceTag={handlers.showWorkspaceTag} />
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

  const taskRowHandlers: TaskRowHandlers = useMemo(
    () => ({
      showWorkspaceTag,
      workspaceAccountId,
      today: todayKey,
      expandedRootTaskIds,
      onToggleSubtasks: toggleRootExpanded,
      onStatusChanged: handleStatusChanged,
      onTitleChanged: handleTitleChanged,
    }),
    [
      showWorkspaceTag,
      workspaceAccountId,
      todayKey,
      expandedRootTaskIds,
      toggleRootExpanded,
      handleStatusChanged,
      handleTitleChanged,
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
    <div className="flex min-h-0 flex-1 flex-col gap-6 bg-transparent px-4 pb-12 pt-6 text-white md:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Tasks
          </h1>
          <p className="mt-1 text-sm text-zinc-400">{headerSubtitle}</p>
        </div>
        {variant === 'personal' ? (
          <AddTaskDialog />
        ) : workspaceAccountId ? (
          <AddTaskDialog
            workspaceAccountId={workspaceAccountId}
            workspaceAccountSlug={workspaceAccountSlug}
          />
        ) : null}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="h-10 w-full rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-white/16 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {variant === 'personal' &&
          includeWorkspaceTasks &&
          workspaceFilterOptions.length > 0 ? (
            <Select
              value={workspaceFilter}
              onValueChange={(value) => {
                setWorkspaceFilter(value);
                if (value === 'personal') {
                  setFilter('life');
                } else if (value !== 'all') {
                  setFilter('work');
                }
              }}
            >
              <SelectTrigger className="h-9 w-[200px] border-white/8 bg-[var(--workspace-shell-panel)] text-xs text-white">
                <SelectValue placeholder="All workspaces" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#1A2535] text-white">
                <SelectItem value="all">All workspaces</SelectItem>
                <SelectItem value="personal">Personal only</SelectItem>
                {workspaceFilterOptions.map((ws) =>
                  ws.slug ? (
                    <SelectItem key={ws.slug} value={ws.slug}>
                      {ws.name}
                    </SelectItem>
                  ) : null,
                )}
              </SelectContent>
            </Select>
          ) : null}
          {clientOptions.length > 0 && (
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="h-9 w-[180px] border-white/8 bg-[var(--workspace-shell-panel)] text-xs text-white">
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#1A2535] text-white">
                <SelectItem value="all">All clients</SelectItem>
                <SelectItem value="__none__">No client</SelectItem>
                {clientOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] p-1 text-xs">
            {(
              [
                ['today', 'Today'],
                ['week', 'This week'],
                ['month', 'This month'],
                ['all', 'All'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDueDateFilter(key)}
                className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors sm:px-3 ${
                  dueDateFilter === key
                    ? 'bg-white/10 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {variant === 'personal' ? (
            <div className="flex rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] p-1 text-xs">
              {(['all', 'work', 'life'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1.5 font-medium capitalize transition-colors ${
                    filter === f
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          ) : null}
          {(view === 'list' || view === 'byClient') && (
            <div className="flex rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] p-1 text-xs">
              {(['active', 'completed'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-lg px-3 py-1.5 font-medium capitalize transition-colors ${
                    statusFilter === s
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] p-1 text-xs">
            <button
              type="button"
              onClick={() => setView('list')}
              aria-label="List view"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                view === 'list'
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ListIcon className="h-3.5 w-3.5" />
              List
            </button>
            <button
              type="button"
              onClick={() => setView('board')}
              aria-label="Board view"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                view === 'board'
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <KanbanSquare className="h-3.5 w-3.5" />
              Board
            </button>
            <button
              type="button"
              onClick={() => setView('byClient')}
              aria-label="By client view"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                view === 'byClient'
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              By Client
            </button>
          </div>
        </div>
      </div>

      {view === 'list' || view === 'byClient' ? (
        <>
          {filteredForList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/8 px-6 py-12 text-center text-sm text-zinc-500">
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
            <div className="overflow-x-auto rounded-xl border border-white/6 bg-[var(--workspace-shell-panel)] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
              <div
                className={cn(
                  showWorkspaceTag ? 'min-w-[1080px]' : 'min-w-[940px]',
                )}
              >
                <TaskTableHeader showWorkspaceTag={showWorkspaceTag} />
                <PriorityGroupedTaskList
                  urgent={urgent}
                  rest={rest}
                  statusFilter={statusFilter}
                  handlers={taskRowHandlers}
                  inlineClientId={inlineClientId}
                />
              </div>
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
        className={`text-sm font-medium leading-snug ${
          isDone ? 'text-zinc-500 line-through' : 'text-white'
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
        className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-1 text-sm font-medium leading-snug text-white shadow-none outline-none focus-visible:ring-1 focus-visible:ring-white/25"
        aria-label="Task title"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      onPointerDown={(e) => isolatePointer && e.stopPropagation()}
      className={`w-full min-w-0 rounded-sm text-left text-sm font-medium leading-snug transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/30 ${
        isDone ? 'text-zinc-500 line-through' : 'text-white'
      }`}
      aria-label="Edit title"
    >
      {title}
    </button>
  );
}

function TaskRow({
  task,
  showWorkspaceTag,
  workspaceAccountId,
  today,
  onStatusChanged,
  onTitleChanged,
  subtasksExpanded = true,
  onToggleSubtasks,
}: {
  task: TasksPageTask;
  showWorkspaceTag?: boolean;
  workspaceAccountId?: string;
  today: string;
  onStatusChanged?: (taskId: string, status: TaskStatus) => void;
  onTitleChanged?: (taskId: string, title: string) => void;
  /** When false, nested subtasks are hidden (root parents only). */
  subtasksExpanded?: boolean;
  onToggleSubtasks?: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const priorityCfg = priorityConfig[task.priority];
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

  const rowGrid = taskListRowGridClass(showWorkspaceTag);

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
        className={cn(
          rowGrid,
          overdue &&
            'border-l-[3px] border-l-rose-500 bg-rose-500/[0.07] ring-1 ring-inset ring-rose-400/20 hover:bg-rose-500/[0.09]',
          !overdue && 'hover:bg-white/[0.035]',
          !isRoot && !overdue && 'bg-transparent hover:bg-white/[0.025]',
          'relative border-b border-white/[0.06] transition-colors',
        )}
      >
        <div className="flex justify-center">
          {showExpandToggle ? (
            <button
              type="button"
              onClick={() => onToggleSubtasks?.()}
              className="rounded p-0.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
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
        <div className="flex justify-center pt-0.5">
          <Checkbox
            checked={isDone}
            disabled={isPending}
            onCheckedChange={(value) => {
              if (value === 'indeterminate') return;
              handleCheckedChange(Boolean(value));
            }}
            aria-label={isDone ? 'Mark task as not done' : 'Mark task as done'}
            className="h-5 w-5 shrink-0 rounded-full border-white/25 shadow-none data-[state=checked]:border-[var(--keel-teal)] data-[state=checked]:bg-[var(--keel-teal)]/20 data-[state=checked]:text-[var(--keel-teal)]"
          />
        </div>
        <div className="min-w-0">
          <InlineTaskTitle
            taskId={task.id}
            title={task.title}
            isDone={isDone}
            onTitleChanged={onTitleChanged}
          />
          {isRoot && subCount > 0 ? (
            <span
              className="mt-0.5 block text-[11px] font-normal tabular-nums text-zinc-500"
              title="Subtasks completed / total"
            >
              {doneSubCount}/{subCount}
            </span>
          ) : null}
        </div>
        {showWorkspaceTag ? (
          <div className="min-w-0">
            {task.workspaceName ? (
              <WorkspaceColorChip
                name={task.workspaceName}
                color={task.workspaceColor ?? '#64748B'}
              />
            ) : (
              <span className="text-xs text-zinc-600">—</span>
            )}
          </div>
        ) : null}
        <span
          className="min-w-0 truncate text-xs text-zinc-300"
          title={task.clientName ?? undefined}
        >
          {task.clientName ?? '—'}
        </span>
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-zinc-400">
          {task.projectName || task.areaLabel ? (
            <>
              {task.accentColor ? (
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: task.accentColor }}
                />
              ) : null}
              <span className="truncate">
                {task.projectName ?? task.areaLabel}
              </span>
            </>
          ) : (
            <span className="text-zinc-600">—</span>
          )}
        </div>
        <div className="min-w-0">
          {overdue ? (
            <OverduePill dueDate={task.dueDate} compact />
          ) : task.dueDateLabel ? (
            <span className="block truncate text-xs text-zinc-400">
              {task.dueDateLabel}
            </span>
          ) : (
            <span className="text-xs text-zinc-600">—</span>
          )}
        </div>
        <div className="min-w-0">
          {task.status === 'pending' && !isDone ? (
            <span className="block truncate text-[11px] leading-5 text-zinc-500">
              Not started
            </span>
          ) : (
            <StatusPill status={task.status} compact />
          )}
        </div>
        <span
          className={cn(
            'text-xs font-medium tabular-nums',
            priorityCfg.className,
          )}
        >
          {priorityCfg.label}
        </span>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Edit task"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
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
      className={`flex min-h-[200px] flex-col rounded-2xl border border-white/6 transition-colors ${
        isOver ? 'border-white/16 bg-white/[0.03]' : 'bg-[var(--workspace-shell-panel)]'
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
          <span className="text-sm font-semibold text-white">
            {column.label}
          </span>
        </div>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-300">
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/8 px-3 py-8 text-center text-xs text-zinc-600">
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
    : 'rounded-xl border border-white/8 bg-[var(--workspace-shell-canvas)]';
  const interactClass = isOverlay
    ? 'shadow-[0_18px_48px_rgba(4,10,24,0.45)]'
    : isDragging
      ? 'opacity-40'
      : 'hover:border-white/16';

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`group cursor-grab touch-none p-3 text-left transition-colors active:cursor-grabbing ${baseClass} ${interactClass}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <InlineTaskTitle
              taskId={task.id}
              title={task.title}
              isDone={isDone}
              onTitleChanged={onTitleChanged}
              isolatePointer
              readOnly={isOverlay}
            />
          </div>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setEditOpen(true);
            }}
            className="rounded-md p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-white/5 hover:text-white group-hover:opacity-100"
            aria-label="Edit task"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
          {overdue && <OverduePill dueDate={task.dueDate} compact />}
          {task.clientName && (
            <span className="rounded bg-white/5 px-1.5 py-0.5 font-medium text-zinc-300">
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
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-400">
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
        'inline-flex max-w-full items-center gap-1 rounded-[5px] font-medium text-zinc-200',
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
