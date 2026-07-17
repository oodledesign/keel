'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';

import { getErrorMessage } from '../../_lib/error-message';
import type {
  JobBoardResult,
  JobBoardTask,
  PhaseListItem,
  PhaseTemplateListItem,
} from '../../_lib/schema/project-phases.schema';
import { createJobTask, moveTask } from '../../_lib/server/server-actions';
import {
  PHASE_STATUS_LABELS,
  PHASE_STATUS_STYLES,
  PRIORITY_DOT,
  TASK_STATUS_STYLES,
  UNPHASED_KEY,
  formatShortDate,
} from './job-project.constants';

type MemberLookup = Map<
  string,
  { name: string | null; email: string | null; picture_url?: string | null }
>;

function phasePath(accountSlug: string, jobId: string, phaseId: string) {
  return pathsConfig.app.accountJobPhaseDetail
    .replace('[account]', accountSlug)
    .replace('[id]', jobId)
    .replace('[phaseId]', phaseId);
}

function TaskCard({
  task,
  memberLookup,
  isOverlay,
}: {
  task: JobBoardTask;
  memberLookup: MemberLookup;
  isOverlay?: boolean;
}) {
  const assignee = task.user_id ? memberLookup.get(task.user_id) : null;
  const priorityKey = task.priority || 'none';

  return (
    <div
      className={`rounded-lg border border-[color:var(--workspace-shell-border)]/80 bg-[var(--workspace-shell-panel)]/80 p-3 shadow-sm ${
        isOverlay ? 'ring-2 ring-[var(--ozer-accent)]/40' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[priorityKey] ?? PRIORITY_DOT.none}`}
          title={task.priority}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug font-medium text-[var(--workspace-shell-text)]">
            {task.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                TASK_STATUS_STYLES[task.status] ?? TASK_STATUS_STYLES.todo
              }`}
            >
              {task.status.replace('_', ' ')}
            </span>
            {task.due_date && (
              <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
                {formatShortDate(task.due_date)}
              </span>
            )}
            {assignee && (
              <span className="truncate text-[11px] text-[var(--workspace-shell-text-muted)]">
                {assignee.name ?? assignee.email ?? 'Assigned'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableTaskCard({
  task,
  memberLookup,
  disabled,
}: {
  task: JobBoardTask;
  memberLookup: MemberLookup;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="touch-manipulation"
    >
      <div className="flex gap-1">
        {!disabled && (
          <button
            type="button"
            className="mt-3 shrink-0 cursor-grab text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text-muted)] active:cursor-grabbing"
            {...attributes}
            {...listeners}
            aria-label="Drag task"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <TaskCard task={task} memberLookup={memberLookup} />
        </div>
      </div>
    </div>
  );
}

function PhaseColumn({
  phase,
  tasks,
  accountSlug,
  jobId,
  canEditJobs,
  memberLookup,
  onAddTask,
  addingTask,
}: {
  phase: PhaseListItem | null;
  tasks: JobBoardTask[];
  accountSlug: string;
  jobId: string;
  canEditJobs: boolean;
  memberLookup: MemberLookup;
  onAddTask: (phaseId: string | null, title: string) => void;
  addingTask: boolean;
}) {
  const columnId = phase?.id ?? UNPHASED_KEY;
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: { phaseId: phase?.id ?? null },
  });
  const [draftTitle, setDraftTitle] = useState('');

  const colour = phase?.colour ?? '#64748B';

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[min(100%,280px)] shrink-0 flex-col rounded-xl border bg-[var(--workspace-shell-panel)]/80 ${
        isOver
          ? 'border-[var(--ozer-accent)]/50'
          : 'border-[color:var(--workspace-shell-border)]/80'
      }`}
      style={{ borderTopWidth: 3, borderTopColor: colour }}
    >
      <div className="border-b border-[color:var(--workspace-shell-border)]/80 p-3">
        {phase ? (
          <Link
            href={phasePath(accountSlug, jobId, phase.id)}
            prefetch={false}
            className="group block"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)] group-hover:underline">
                {phase.name}
              </h3>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  PHASE_STATUS_STYLES[phase.status]
                }`}
              >
                {PHASE_STATUS_LABELS[phase.status]}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--workspace-shell-text-muted)]">
              Due {formatShortDate(phase.due_date)} · {phase.progressPct}% done
            </p>
          </Link>
        ) : (
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text-muted)]">
            Unassigned
          </h3>
        )}
      </div>

      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-[120px] flex-1 flex-col gap-2 p-2">
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              memberLookup={memberLookup}
              disabled={!canEditJobs}
            />
          ))}
        </div>
      </SortableContext>

      {canEditJobs && (
        <form
          className="border-t border-[color:var(--workspace-shell-border)]/80 p-2"
          onSubmit={(e) => {
            e.preventDefault();
            const title = draftTitle.trim();
            if (!title) return;
            onAddTask(phase?.id ?? null, title);
            setDraftTitle('');
          }}
        >
          <div className="flex gap-1">
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Add task…"
              className="h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-sm text-[var(--workspace-shell-text)]"
              disabled={addingTask}
            />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="h-8 shrink-0 px-2 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
              disabled={!draftTitle.trim() || addingTask}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function SortablePhaseColumn(props: {
  phase: PhaseListItem;
  tasks: JobBoardTask[];
  accountSlug: string;
  jobId: string;
  canEditJobs: boolean;
  memberLookup: MemberLookup;
  onAddTask: (phaseId: string | null, title: string) => void;
  addingTask: boolean;
}) {
  return <PhaseColumn {...props} />;
}

export function JobProjectBoard({
  accountSlug,
  accountId,
  jobId,
  board,
  canEditJobs,
  members,
  onBoardChange,
  onSeedDefaultPhases,
  onApplyTemplate,
  phaseTemplates,
  seedingPhases,
}: {
  accountSlug: string;
  accountId: string;
  jobId: string;
  board: JobBoardResult;
  canEditJobs: boolean;
  members: {
    user_id: string;
    name: string | null;
    email: string | null;
    picture_url?: string | null;
  }[];
  onBoardChange: (board: JobBoardResult) => void;
  onSeedDefaultPhases: () => void;
  onApplyTemplate: (templateId: string) => void;
  phaseTemplates: PhaseTemplateListItem[];
  seedingPhases: boolean;
}) {
  const [activeTask, setActiveTask] = useState<JobBoardTask | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [isPending, startTransition] = useTransition();

  const memberLookup = useMemo<MemberLookup>(() => {
    const map: MemberLookup = new Map();
    for (const m of members) {
      map.set(m.user_id, {
        name: m.name,
        email: m.email,
        picture_url: m.picture_url,
      });
    }
    return map;
  }, [members]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const phases = board.phases;
  const tasksByPhase = board.tasksByPhase;

  const allTasks = useMemo(() => {
    const list: JobBoardTask[] = [];
    for (const tasks of Object.values(tasksByPhase)) {
      list.push(...tasks);
    }
    return list;
  }, [tasksByPhase]);

  const applyTasksByPhase = useCallback(
    (next: Record<string, JobBoardTask[]>) => {
      onBoardChange({ ...board, tasksByPhase: next });
    },
    [board, onBoardChange],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      const task = allTasks.find((t) => t.id === id);
      if (task) setActiveTask(task);
    },
    [allTasks],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);
      if (!canEditJobs) return;

      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const activeTaskRow = allTasks.find((t) => t.id === activeId);

      if (!activeTaskRow) {
        return;
      }

      const overId = String(over.id);
      let targetPhaseId: string | null = null;

      if (overId === UNPHASED_KEY) {
        targetPhaseId = null;
      } else if (phases.some((p) => p.id === overId)) {
        targetPhaseId = overId;
      } else {
        const overTask = allTasks.find((t) => t.id === overId);
        targetPhaseId = overTask?.phase_id ?? null;
      }

      const sourceKey = activeTaskRow.phase_id ?? UNPHASED_KEY;
      const targetKey = targetPhaseId ?? UNPHASED_KEY;
      if (sourceKey === targetKey && activeId === overId) return;

      const next = { ...tasksByPhase };
      const sourceList = [...(next[sourceKey] ?? [])].filter(
        (t) => t.id !== activeId,
      );
      let targetList = [...(next[targetKey] ?? [])].filter(
        (t) => t.id !== activeId,
      );

      const moved: JobBoardTask = {
        ...activeTaskRow,
        phase_id: targetPhaseId,
        job_id: jobId,
      };

      if (
        overId !== targetKey &&
        overId !== UNPHASED_KEY &&
        overId !== activeId
      ) {
        const overIndex = targetList.findIndex((t) => t.id === overId);
        if (overIndex >= 0) targetList.splice(overIndex, 0, moved);
        else targetList.push(moved);
      } else {
        targetList.push(moved);
      }

      targetList = targetList.map((t, i) => ({ ...t, sort_order: i }));
      next[sourceKey] = sourceList;
      next[targetKey] = targetList;
      applyTasksByPhase(next);

      startTransition(async () => {
        try {
          await moveTask({
            accountId,
            accountSlug,
            jobId,
            taskId: activeId,
            phaseId: targetPhaseId,
            sortOrder: targetList.findIndex((t) => t.id === activeId),
          });
        } catch (err) {
          toast.error(getErrorMessage(err));
          applyTasksByPhase(tasksByPhase);
        }
      });
    },
    [
      accountId,
      accountSlug,
      allTasks,
      applyTasksByPhase,
      board,
      canEditJobs,
      jobId,
      onBoardChange,
      phases,
      startTransition,
      tasksByPhase,
    ],
  );

  const handleAddTask = useCallback(
    (phaseId: string | null, title: string) => {
      setAddingTask(true);
      startTransition(async () => {
        try {
          const task = await createJobTask({
            accountId,
            accountSlug,
            jobId,
            phaseId,
            title,
            priority: 'medium',
          });
          const key = phaseId ?? UNPHASED_KEY;
          const next = { ...tasksByPhase };
          next[key] = [...(next[key] ?? []), task as JobBoardTask];
          onBoardChange({ ...board, tasksByPhase: next });
        } catch (err) {
          toast.error(getErrorMessage(err));
        } finally {
          setAddingTask(false);
        }
      });
    },
    [
      accountId,
      accountSlug,
      board,
      jobId,
      onBoardChange,
      startTransition,
      tasksByPhase,
    ],
  );

  if (phases.length === 0) {
    const primaryTemplate =
      phaseTemplates.find((item) => item.name === 'Standard delivery') ??
      phaseTemplates[0];
    const otherTemplates = phaseTemplates.filter(
      (item) => item.id !== primaryTemplate?.id,
    );

    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/30 px-6 py-16 text-center">
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No delivery phases yet. Apply a template or add phases one at a time.
        </p>
        {canEditJobs && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              disabled={seedingPhases || !primaryTemplate}
              onClick={onSeedDefaultPhases}
            >
              {primaryTemplate
                ? `Apply “${primaryTemplate.name}”`
                : 'Apply template'}
            </Button>
            {otherTemplates.map((template) => (
              <Button
                key={template.id}
                type="button"
                size="sm"
                variant="outline"
                className="border-[color:var(--workspace-shell-border)]"
                disabled={seedingPhases}
                onClick={() => onApplyTemplate(template.id)}
              >
                {template.name}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const unphasedTasks = tasksByPhase[UNPHASED_KEY] ?? [];

  return (
    <div className="space-y-2">
      {isPending && (
        <p className="text-xs text-amber-400/90">Saving changes…</p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex w-max gap-3 overflow-x-auto pt-1 pb-4">
          {phases.map((phase) => (
            <SortablePhaseColumn
              key={phase.id}
              phase={phase}
              tasks={tasksByPhase[phase.id] ?? []}
              accountSlug={accountSlug}
              jobId={jobId}
              canEditJobs={canEditJobs}
              memberLookup={memberLookup}
              onAddTask={handleAddTask}
              addingTask={addingTask}
            />
          ))}
          {unphasedTasks.length > 0 && (
            <PhaseColumn
              phase={null}
              tasks={unphasedTasks}
              accountSlug={accountSlug}
              jobId={jobId}
              canEditJobs={canEditJobs}
              memberLookup={memberLookup}
              onAddTask={handleAddTask}
              addingTask={addingTask}
            />
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <TaskCard task={activeTask} memberLookup={memberLookup} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
