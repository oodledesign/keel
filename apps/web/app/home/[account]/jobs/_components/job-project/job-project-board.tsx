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
import { GripVertical, MoreHorizontal, Plus, Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
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
import {
  createJobTask,
  deletePhase,
  moveTask,
} from '../../_lib/server/server-actions';
import {
  PHASE_STATUS_LABELS,
  PHASE_STATUS_STYLES,
  PRIORITY_DOT,
  TASK_STATUS_STYLES,
  UNPHASED_KEY,
  formatShortDate,
} from './job-project.constants';
import { JobProjectTaskSheet } from './job-project-task-sheet';

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
  onOpen,
}: {
  task: JobBoardTask;
  memberLookup: MemberLookup;
  isOverlay?: boolean;
  onOpen?: () => void;
}) {
  const assignee = task.user_id ? memberLookup.get(task.user_id) : null;
  const priorityKey = task.priority || 'none';
  const linkCount = task.links?.length ?? 0;
  const attachedNoteCount = task.note_refs?.length ?? 0;
  const hasNotes = Boolean(task.notes?.trim());
  const metaBits = [
    attachedNoteCount > 0
      ? `${attachedNoteCount} note${attachedNoteCount === 1 ? '' : 's'}`
      : null,
    hasNotes ? 'Scratch' : null,
    linkCount > 0
      ? `${linkCount} link${linkCount === 1 ? '' : 's'}`
      : null,
  ].filter(Boolean);

  return (
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (!onOpen) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`rounded-lg border border-[color:var(--workspace-shell-border)]/80 bg-[var(--workspace-shell-panel)]/80 p-3 shadow-sm transition-colors ${
        isOverlay ? 'ring-2 ring-[var(--ozer-accent)]/40' : ''
      } ${onOpen ? 'cursor-pointer hover:border-[var(--ozer-accent)]/35 hover:bg-[var(--workspace-shell-panel)]' : ''}`}
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
            {metaBits.length > 0 && (
              <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
                {metaBits.join(' · ')}
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
  onOpen,
}: {
  task: JobBoardTask;
  memberLookup: MemberLookup;
  disabled: boolean;
  onOpen: () => void;
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
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <TaskCard task={task} memberLookup={memberLookup} onOpen={onOpen} />
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
  onDeletePhase,
  deletingPhase,
  onOpenTask,
}: {
  phase: PhaseListItem | null;
  tasks: JobBoardTask[];
  accountSlug: string;
  jobId: string;
  canEditJobs: boolean;
  memberLookup: MemberLookup;
  onAddTask: (phaseId: string | null, title: string) => void;
  addingTask: boolean;
  onDeletePhase?: (phaseId: string) => void;
  deletingPhase?: boolean;
  onOpenTask: (task: JobBoardTask) => void;
}) {
  const columnId = phase?.id ?? UNPHASED_KEY;
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: { phaseId: phase?.id ?? null },
  });
  const [draftTitle, setDraftTitle] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const colour = phase?.colour ?? '#64748B';

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full w-[min(100%,280px)] shrink-0 flex-col rounded-xl border bg-[var(--workspace-shell-panel)]/80 ${
        isOver
          ? 'border-[var(--ozer-accent)]/50'
          : 'border-[color:var(--workspace-shell-border)]/80'
      }`}
      style={{ borderTopWidth: 3, borderTopColor: colour }}
    >
      <div className="border-b border-[color:var(--workspace-shell-border)]/80 p-3">
        {phase ? (
          <div className="flex items-start gap-1">
            <Link
              href={phasePath(accountSlug, jobId, phase.id)}
              prefetch={false}
              className="group block min-w-0 flex-1"
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
                Due {formatShortDate(phase.due_date)} · {phase.progressPct}%
                done
              </p>
            </Link>

            {canEditJobs && onDeletePhase ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 p-0 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                      aria-label={`Phase options for ${phase.name}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]"
                  >
                    <DropdownMenuItem
                      className="cursor-pointer text-red-700 focus:text-red-800"
                      onSelect={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete phase
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                  <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Delete “{phase.name}”?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Tasks in this phase stay on the project and move to
                        Unassigned.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:gap-0">
                      <AlertDialogCancel
                        disabled={deletingPhase}
                        className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
                      >
                        Cancel
                      </AlertDialogCancel>
                      <Button
                        variant="destructive"
                        disabled={deletingPhase}
                        className="bg-red-600 hover:bg-red-500"
                        onClick={() => {
                          onDeletePhase(phase.id);
                          setDeleteOpen(false);
                        }}
                      >
                        {deletingPhase ? 'Deleting…' : 'Delete phase'}
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : null}
          </div>
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
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              memberLookup={memberLookup}
              disabled={!canEditJobs}
              onOpen={() => onOpenTask(task)}
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
  onDeletePhase?: (phaseId: string) => void;
  deletingPhase?: boolean;
  onOpenTask: (task: JobBoardTask) => void;
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
  onOpenTemplatePicker,
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
  onOpenTemplatePicker: () => void;
  phaseTemplates: PhaseTemplateListItem[];
  seedingPhases: boolean;
}) {
  const [activeTask, setActiveTask] = useState<JobBoardTask | null>(null);
  const [selectedTask, setSelectedTask] = useState<JobBoardTask | null>(null);
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [deletingPhase, setDeletingPhase] = useState(false);
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

  const handleDeletePhase = useCallback(
    (phaseId: string) => {
      setDeletingPhase(true);
      startTransition(async () => {
        try {
          await deletePhase({
            accountId,
            accountSlug,
            jobId,
            phaseId,
          });

          const phaseTasks = tasksByPhase[phaseId] ?? [];
          const nextTasks = { ...tasksByPhase };
          delete nextTasks[phaseId];
          nextTasks[UNPHASED_KEY] = [
            ...(nextTasks[UNPHASED_KEY] ?? []),
            ...phaseTasks.map((task) => ({ ...task, phase_id: null })),
          ];

          onBoardChange({
            ...board,
            phases: board.phases.filter((phase) => phase.id !== phaseId),
            tasksByPhase: nextTasks,
          });
          toast.success('Phase deleted');
        } catch (err) {
          toast.error(getErrorMessage(err));
        } finally {
          setDeletingPhase(false);
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
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/30 px-6 py-16 text-center">
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No delivery phases yet. Choose a template or add phases one at a time.
        </p>
        {canEditJobs && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              disabled={seedingPhases || phaseTemplates.length === 0}
              onClick={onOpenTemplatePicker}
            >
              {seedingPhases ? 'Applying…' : 'Choose template'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const unphasedTasks = tasksByPhase[UNPHASED_KEY] ?? [];

  const openTask = useCallback((task: JobBoardTask) => {
    setSelectedTask(task);
    setTaskSheetOpen(true);
  }, []);

  const handleTaskUpdated = useCallback(
    (updated: JobBoardTask) => {
      setSelectedTask(updated);
      const next: Record<string, JobBoardTask[]> = {};
      for (const [key, tasks] of Object.entries(board.tasksByPhase)) {
        next[key] = tasks.map((task) =>
          task.id === updated.id ? { ...task, ...updated } : task,
        );
      }
      onBoardChange({ ...board, tasksByPhase: next });
    },
    [board, onBoardChange],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {isPending && (
        <p className="mb-2 shrink-0 text-xs text-amber-400/90">
          Saving changes…
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden pb-1">
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
              onDeletePhase={handleDeletePhase}
              deletingPhase={deletingPhase}
              onOpenTask={openTask}
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
              onOpenTask={openTask}
            />
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <TaskCard task={activeTask} memberLookup={memberLookup} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      <JobProjectTaskSheet
        open={taskSheetOpen}
        onOpenChange={setTaskSheetOpen}
        task={selectedTask}
        accountId={accountId}
        accountSlug={accountSlug}
        jobId={jobId}
        canEditJobs={canEditJobs}
        onUpdated={handleTaskUpdated}
      />
    </div>
  );
}
