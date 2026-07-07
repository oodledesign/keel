'use client';

import { useCallback, useState, useTransition } from 'react';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import { AlertTriangle, Flame } from 'lucide-react';

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

import { parseDueDateParts } from '../../../_lib/due-date-ymd';
import type { TasksPageTask } from '../../_lib/server/tasks.loader';
import { updateTask } from '../../_lib/actions/task-actions';
import { InlineTaskTitle } from './tasks-inline-task-title';

const EditTaskDialog = dynamic(
  () => import('./edit-task-dialog').then((mod) => mod.EditTaskDialog),
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

const priorityConfig: Record<
  TasksPageTask['priority'],
  { label: string; className: string }
> = {
  low: { label: 'Low', className: 'text-[var(--workspace-shell-text-muted)]' },
  medium: { label: 'Medium', className: 'text-blue-400' },
  high: { label: 'High', className: 'text-amber-400' },
  urgent: { label: 'Urgent', className: 'text-rose-400' },
};

function isOverdue(task: TasksPageTask, today: string): boolean {
  if (!task.dueDate || task.status === 'completed') return false;
  return task.dueDate < today;
}

function formatOverdueDate(iso: string): string {
  const p = parseDueDateParts(iso);
  if (!p) return iso;
  const d = new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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
      className={`inline-flex max-w-full items-center gap-1 rounded-[5px] border border-rose-400/25 bg-rose-500/12 font-medium text-rose-200 ${
        compact
          ? 'px-1.5 py-0 text-[11px] leading-5'
          : 'px-1.5 py-0.5 text-xs leading-5'
      }`}
    >
      <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
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
            <span
              className={`flex items-center gap-0.5 font-medium ${priorityCfg.className}`}
            >
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
        isOver
          ? 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]'
          : 'bg-[var(--workspace-shell-panel)]'
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

export type TasksKanbanBoardProps = {
  tasksByStatus: Map<TaskStatus, TasksPageTask[]>;
  flatTasks: TasksPageTask[];
  today: string;
  workspaceAccountId?: string;
  onTitleChanged: (taskId: string, title: string) => void;
  onStatusChanged: (taskId: string, status: TaskStatus) => void;
};

export function TasksKanbanBoard({
  tasksByStatus,
  flatTasks,
  today,
  workspaceAccountId,
  onTitleChanged,
  onStatusChanged,
}: TasksKanbanBoardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [activeDragTask, setActiveDragTask] = useState<TasksPageTask | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const onDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    const found = flatTasks.find((t) => t.id === id);
    setActiveDragTask(found ?? null);
  }, [flatTasks]);

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
        const target = flatTasks.find((t) => t.id === overId);
        if (target) newStatus = target.status;
      }
      if (!newStatus) return;

      const current = flatTasks.find((t) => t.id === taskId);
      if (!current || current.status === newStatus) return;

      const previousStatus = current.status;
      onStatusChanged(taskId, newStatus);
      startTransition(async () => {
        const result = await updateTask(taskId, { status: newStatus! });
        if (!result.success) {
          onStatusChanged(taskId, previousStatus);
        } else {
          router.refresh();
        }
      });
    },
    [flatTasks, onStatusChanged, router],
  );

  return (
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
            today={today}
            workspaceAccountId={workspaceAccountId}
            onTitleChanged={onTitleChanged}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragTask ? (
          <BoardCard
            task={activeDragTask}
            today={today}
            workspaceAccountId={workspaceAccountId}
            onTitleChanged={onTitleChanged}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
