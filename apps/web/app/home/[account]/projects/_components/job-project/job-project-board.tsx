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
import { GripVertical, MoreHorizontal, Trash2 } from 'lucide-react';

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
import { toast } from '@kit/ui/sonner';

import { projectPhaseHref } from '~/lib/projects/project-paths';

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
import { AddProjectTaskForm } from './add-project-task-form';
import { JobProjectTaskSheet } from './job-project-task-sheet';
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

type ContactLookup = Map<
  string,
  { name: string | null; email: string | null; picture_url?: string | null }
>;

function resolveTaskAssigneeLabel(
  task: JobBoardTask,
  memberLookup: MemberLookup,
  contactLookup: ContactLookup,
): string | null {
  if (task.assignee_contact_id) {
    const contact = contactLookup.get(task.assignee_contact_id);
    return contact?.name ?? contact?.email ?? 'Assigned contact';
  }
  if (task.user_id) {
    const member = memberLookup.get(task.user_id);
    return member?.name ?? member?.email ?? 'Assigned';
  }
  return null;
}

function phasePath(accountSlug: string, jobId: string, phaseId: string) {
  return projectPhaseHref(accountSlug, jobId, phaseId);
}

function TaskCard({
  task,
  memberLookup,
  contactLookup,
  isOverlay,
  onOpen,
  subtasks = [],
}: {
  task: JobBoardTask;
  memberLookup: MemberLookup;
  contactLookup: ContactLookup;
  isOverlay?: boolean;
  onOpen?: () => void;
  subtasks?: JobBoardTask[];
}) {
  const assigneeLabel = resolveTaskAssigneeLabel(
    task,
    memberLookup,
    contactLookup,
  );
  const priorityKey = task.priority || 'none';
  const linkCount = task.links?.length ?? 0;
  const attachedNoteCount = task.note_refs?.length ?? 0;
  const hasNotes = Boolean(task.notes?.trim());
  const metaBits = [
    attachedNoteCount > 0
      ? `${attachedNoteCount} note${attachedNoteCount === 1 ? '' : 's'}`
      : null,
    hasNotes ? 'Scratch' : null,
    linkCount > 0 ? `${linkCount} link${linkCount === 1 ? '' : 's'}` : null,
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
            {assigneeLabel ? (
              <span className="truncate text-[11px] text-[var(--workspace-shell-text-muted)]">
                {assigneeLabel}
              </span>
            ) : null}
            {metaBits.length > 0 && (
              <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
                {metaBits.join(' · ')}
              </span>
            )}
          </div>
          {subtasks.length > 0 ? (
            <ul className="mt-2 space-y-1 border-t border-[color:var(--workspace-shell-border)]/60 pt-2">
              {subtasks.map((subtask) => (
                <li
                  key={subtask.id}
                  className="truncate pl-1 text-[11px] text-[var(--workspace-shell-text-muted)]"
                >
                  {subtask.status === 'done' ? '✓ ' : '○ '}
                  {subtask.title}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SortableTaskCard({
  task,
  memberLookup,
  contactLookup,
  disabled,
  onOpen,
  subtasks = [],
}: {
  task: JobBoardTask;
  memberLookup: MemberLookup;
  contactLookup: ContactLookup;
  disabled: boolean;
  onOpen: () => void;
  subtasks?: JobBoardTask[];
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
          <TaskCard
            task={task}
            memberLookup={memberLookup}
            contactLookup={contactLookup}
            onOpen={onOpen}
            subtasks={subtasks}
          />
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
  contactLookup,
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
  contactLookup: ContactLookup;
  onAddTask: (
    phaseId: string | null,
    title: string,
    subtaskTitles: string[],
  ) => void;
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const rootTasks = tasks.filter((task) => !task.parent_task_id);
  const subtasksByParent = new Map<string, JobBoardTask[]>();
  for (const task of tasks) {
    if (!task.parent_task_id) continue;
    const list = subtasksByParent.get(task.parent_task_id) ?? [];
    list.push(task);
    subtasksByParent.set(task.parent_task_id, list);
  }

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
        items={rootTasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
          {rootTasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              memberLookup={memberLookup}
              contactLookup={contactLookup}
              disabled={!canEditJobs}
              onOpen={() => onOpenTask(task)}
              subtasks={subtasksByParent.get(task.id) ?? []}
            />
          ))}
        </div>
      </SortableContext>

      {canEditJobs && (
        <div className="border-t border-[color:var(--workspace-shell-border)]/80 p-2">
          <AddProjectTaskForm
            disabled={addingTask}
            onSubmit={(title, subtaskTitles) =>
              onAddTask(phase?.id ?? null, title, subtaskTitles)
            }
          />
        </div>
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
  contactLookup: ContactLookup;
  onAddTask: (
    phaseId: string | null,
    title: string,
    subtaskTitles: string[],
  ) => void;
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

  const contactLookup = useMemo<ContactLookup>(() => {
    const map: ContactLookup = new Map();
    for (const contact of board.contactAssignees ?? []) {
      map.set(contact.id, {
        name: contact.name,
        email: contact.email,
        picture_url: contact.picture_url ?? undefined,
      });
    }
    return map;
  }, [board.contactAssignees]);

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

      const childTasks = allTasks.filter(
        (task) => task.parent_task_id === activeId,
      );
      const childIds = new Set(childTasks.map((task) => task.id));

      const next = { ...tasksByPhase };
      const sourceList = [...(next[sourceKey] ?? [])].filter(
        (t) => t.id !== activeId && !childIds.has(t.id),
      );
      let targetList = [...(next[targetKey] ?? [])].filter(
        (t) => t.id !== activeId && !childIds.has(t.id),
      );

      const moved: JobBoardTask = {
        ...activeTaskRow,
        phase_id: targetPhaseId,
        job_id: jobId,
      };
      const movedChildren = childTasks.map((task) => ({
        ...task,
        phase_id: targetPhaseId,
      }));

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

      targetList = [...targetList, ...movedChildren];

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
    (phaseId: string | null, title: string, subtaskTitles: string[]) => {
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
            subtaskTitles,
          });
          const key = phaseId ?? UNPHASED_KEY;
          const next = { ...tasksByPhase };
          next[key] = [
            ...(next[key] ?? []),
            task as JobBoardTask,
            ...((task as JobBoardTask).subtasks ?? []),
          ];
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
              contactLookup={contactLookup}
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
              contactLookup={contactLookup}
              onAddTask={handleAddTask}
              addingTask={addingTask}
              onOpenTask={openTask}
            />
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              memberLookup={memberLookup}
              contactLookup={contactLookup}
              isOverlay
            />
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
        subtasks={
          selectedTask
            ? allTasks.filter((item) => item.parent_task_id === selectedTask.id)
            : []
        }
        onSubtaskCreated={(subtask) => {
          const key = subtask.phase_id ?? UNPHASED_KEY;
          const next = { ...board.tasksByPhase };
          next[key] = [...(next[key] ?? []), subtask];
          onBoardChange({ ...board, tasksByPhase: next });
        }}
        onDeleted={(deleted) => {
          const next: Record<string, JobBoardTask[]> = {};
          for (const [key, list] of Object.entries(board.tasksByPhase)) {
            next[key] = (list ?? []).filter(
              (item) =>
                item.id !== deleted.id && item.parent_task_id !== deleted.id,
            );
          }
          onBoardChange({ ...board, tasksByPhase: next });
          setSelectedTask(null);
        }}
      />
    </div>
  );
}
