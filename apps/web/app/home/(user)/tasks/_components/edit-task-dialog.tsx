'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

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
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { TaskPersonAssigneeSelect } from '~/components/task-person-assignee-select';
import pathsConfig from '~/config/paths.config';
import { TaskAssignmentCombobox } from '~/home/(user)/_components/dashboard/task-assignment-combobox';
import {
  createBlankWorkspaceNoteAction,
  saveWorkspaceNoteAction,
} from '~/home/[account]/_lib/workspace-content/notes-actions';
import { listNotesAndFilesForContextAction } from '~/home/[account]/_lib/workspace-content/notes-files-actions';
import type { TaskPersonAssigneeOption } from '~/lib/tasks/task-person-assignee';
import {
  parsePersonAssigneeSelectValue,
  personAssigneeSelectValue,
} from '~/lib/tasks/task-person-assignee';

import {
  type TaskAssignmentOption,
  type TaskAssignmentUpdate,
  createTask,
  deleteTask,
  loadTaskAssignmentOptions,
  loadTaskAssignmentOptionsForWorkspace,
  loadTaskForEdit,
  loadTaskPersonAssigneesAction,
  updateTask,
  updateTaskRecurringSeriesStatusAction,
} from '../../_lib/actions/task-actions';
import type { TasksPageTask } from '../../_lib/server/tasks.loader';

const PRIORITIES = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
  { key: 'urgent', label: 'Urgent' },
];

const STATUSES = [
  { key: 'pending', label: 'Not started' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'client_review', label: 'Client review' },
  { key: 'completed', label: 'Completed' },
];

const FREQUENCIES = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'fortnightly', label: 'Fortnightly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'yearly', label: 'Yearly' },
] as const;

type RecurrenceFrequency = (typeof FREQUENCIES)[number]['key'];

type Props = {
  task: TasksPageTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Team workspace tasks page — assignment limited to this account’s projects/clients. */
  workspaceAccountId?: string;
  /** Team workspace slug — needed to deep-link / create notes. */
  workspaceAccountSlug?: string;
  /** After a successful delete (e.g. refresh a client-side list). */
  onDeleted?: () => void;
  /** After a successful save (same use case as onDeleted). */
  onSaved?: () => void;
};

function initialAssignTo(task: TasksPageTask): string {
  if (task.projectId) {
    return task.projectId;
  }
  if (task.clientId) {
    return task.clientId;
  }
  if (task.areaId) {
    return task.areaId;
  }
  return 'none';
}

function initialPersonAssignee(task: TasksPageTask): string {
  if (task.assigneeContactId) {
    return personAssigneeSelectValue({
      kind: 'contact',
      contactId: task.assigneeContactId,
    });
  }
  if (task.assigneeUserId) {
    return personAssigneeSelectValue({
      kind: 'member',
      userId: task.assigneeUserId,
    });
  }
  return '__none__';
}

function assignmentFromSelection(
  assignTo: string,
  options: TaskAssignmentOption[],
): TaskAssignmentUpdate {
  if (assignTo === 'none') {
    return { kind: 'none' };
  }
  const selected = options.find((o) => o.id === assignTo);
  if (!selected) {
    return { kind: 'none' };
  }
  if (selected.type === 'project') {
    return { kind: 'project', id: selected.id };
  }
  if (selected.type === 'client') {
    return { kind: 'client', id: selected.id };
  }
  return { kind: 'area', id: selected.id };
}

function SubtaskEditorRow({
  subtask,
  disabled,
  onChange,
  onRemove,
}: {
  subtask: TasksPageTask;
  disabled?: boolean;
  onChange: (updated: TasksPageTask) => void;
  onRemove: (id: string) => void;
}) {
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDone = subtask.status === 'completed';
  const title = draftTitle ?? subtask.title;

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  const toggleStatus = useCallback(
    async (checked: boolean) => {
      const next = checked ? 'completed' : 'pending';
      setBusy(true);
      const result = await updateTask(subtask.id, { status: next });
      setBusy(false);
      if (result.success) {
        onChange({ ...subtask, status: next });
      }
    },
    [onChange, subtask],
  );

  const saveTitle = useCallback(async () => {
    setEditing(false);
    const trimmed = title.trim();
    setDraftTitle(null);
    if (!trimmed) {
      return;
    }
    if (trimmed === subtask.title) {
      return;
    }
    setBusy(true);
    const result = await updateTask(subtask.id, { title: trimmed });
    setBusy(false);
    if (result.success) {
      onChange({ ...subtask, title: trimmed });
    }
  }, [onChange, subtask, title]);

  const handleDelete = useCallback(async () => {
    setBusy(true);
    const result = await deleteTask(subtask.id);
    setBusy(false);
    if (result.success) {
      onRemove(subtask.id);
    }
  }, [onRemove, subtask.id]);

  return (
    <div className="group flex items-center gap-2 rounded-md py-1 pr-0.5 pl-1 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]/60">
      <Checkbox
        checked={isDone}
        disabled={disabled || busy}
        onCheckedChange={(value) => {
          if (value === 'indeterminate') return;
          void toggleStatus(Boolean(value));
        }}
        aria-label={
          isDone ? 'Mark subtask as not done' : 'Mark subtask as done'
        }
        className="h-4 w-4 shrink-0 rounded-full border-[color:var(--workspace-shell-border)] shadow-none data-[state=checked]:border-[var(--ozer-accent)] data-[state=checked]:bg-[var(--ozer-accent-subtle)] data-[state=checked]:text-[var(--ozer-accent)]"
      />
      {editing ? (
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void saveTitle();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setDraftTitle(null);
              setEditing(false);
            }
          }}
          disabled={busy}
          className="min-w-0 flex-1 rounded border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 py-1 text-sm text-[var(--workspace-shell-text)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--ozer-accent)]/50"
        />
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => {
            setDraftTitle(subtask.title);
            setEditing(true);
          }}
          className={cn(
            'min-w-0 flex-1 truncate text-left text-sm',
            isDone
              ? 'text-[var(--workspace-shell-text-muted)] line-through'
              : 'text-[var(--workspace-shell-text)]',
          )}
        >
          {subtask.title}
        </button>
      )}
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void handleDelete()}
        className="rounded p-1 text-[var(--workspace-shell-text-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[#E85D75] focus-visible:opacity-100 disabled:opacity-40"
        aria-label={`Delete subtask ${subtask.title}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function EditTaskDialog({
  task,
  open,
  onOpenChange,
  workspaceAccountId,
  workspaceAccountSlug,
  onDeleted,
  onSaved,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState(task.status);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [notes, setNotes] = useState(task.notes ?? '');
  const [options, setOptions] = useState<TaskAssignmentOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [assignTo, setAssignTo] = useState(initialAssignTo(task));
  const [personAssignee, setPersonAssignee] = useState(
    initialPersonAssignee(task),
  );
  const [personOptions, setPersonOptions] = useState<
    TaskPersonAssigneeOption[]
  >([]);
  const [personOptionsLoading, setPersonOptionsLoading] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [subtaskAdding, setSubtaskAdding] = useState(false);
  const [subtasks, setSubtasks] = useState<TasksPageTask[]>(
    task.subtasks ?? [],
  );
  const [subtasksExpanded, setSubtasksExpanded] = useState(true);
  const [subtasksLoading, setSubtasksLoading] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [firstCreateDate, setFirstCreateDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [dayOfMonth, setDayOfMonth] = useState(() =>
    String(new Date().getUTCDate()),
  );
  const [dueDays, setDueDays] = useState('0');
  const [noteRefs, setNoteRefs] = useState(task.noteRefs ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerNotes, setPickerNotes] = useState<
    Array<{ id: string; title: string; preview: string }>
  >([]);
  const [creatingNote, setCreatingNote] = useState(false);
  const [source, setSource] = useState(task.source ?? 'manual');
  const [sourceContext, setSourceContext] = useState(
    task.sourceContext ?? null,
  );
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const isWorkspaceMode = Boolean(workspaceAccountId);
  const notesAccountId = workspaceAccountId ?? task.accountId;
  const notesAccountSlug = workspaceAccountSlug ?? task.workspaceSlug;
  const canAttachNotes = Boolean(notesAccountId && notesAccountSlug);
  const isRootTask = !task.parentTaskId;
  const doneSubtaskCount = subtasks.filter(
    (s) => s.status === 'completed',
  ).length;

  const refreshSubtasks = useCallback(async () => {
    if (!isRootTask) return;
    setSubtasksLoading(true);
    try {
      const fresh = await loadTaskForEdit(task.id, workspaceAccountId);
      setSubtasks(fresh?.subtasks ?? []);
    } finally {
      setSubtasksLoading(false);
    }
  }, [isRootTask, task.id, workspaceAccountId]);

  useEffect(() => {
    if (!open) {
      setOptions([]);
      return;
    }

    void (async () => {
      setOptionsLoading(true);
      try {
        const data = workspaceAccountId
          ? await loadTaskAssignmentOptionsForWorkspace(workspaceAccountId)
          : await loadTaskAssignmentOptions();
        setOptions(data);
      } finally {
        setOptionsLoading(false);
      }
    })();
  }, [open, workspaceAccountId]);

  useEffect(() => {
    if (!open || !notesAccountId) {
      setPersonOptions([]);
      return;
    }

    let cancelled = false;
    setPersonOptionsLoading(true);
    void loadTaskPersonAssigneesAction({
      accountId: notesAccountId,
      clientId: task.clientId,
    })
      .then((rows) => {
        if (!cancelled) setPersonOptions(rows);
      })
      .catch(() => {
        if (!cancelled) setPersonOptions([]);
      })
      .finally(() => {
        if (!cancelled) setPersonOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, notesAccountId, task.clientId]);

  useEffect(() => {
    if (!open || !isRootTask) {
      return;
    }

    setSubtasks(task.subtasks ?? []);
    setSubtasksExpanded(true);
    void refreshSubtasks();
    // Intentionally depend on task.id (not task.subtasks): refreshSubtasks loads fresh rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid reset loops from nested subtasks
  }, [open, isRootTask, task.id, refreshSubtasks]);

  useEffect(() => {
    if (open) {
      setTitle(task.title);
      setPriority(task.priority);
      setStatus(task.status);
      setDueDate(task.dueDate ?? '');
      setNotes(task.notes ?? '');
      setNoteRefs(task.noteRefs ?? []);
      setAssignTo(initialAssignTo(task));
      setPersonAssignee(initialPersonAssignee(task));
      setError(null);
      setDeleteDialogOpen(false);
      setNewSubtaskTitle('');
      setRepeat(false);
      setRepeatOpen(false);
      setPickerOpen(false);
      setPickerQuery('');
      setFirstCreateDate(new Date().toISOString().slice(0, 10));
      setDayOfMonth(String(new Date().getUTCDate()));
      setDueDays('0');
      setFrequency('monthly');
      setSource(task.source ?? 'manual');
      setSourceContext(task.sourceContext ?? null);
      setSourceExpanded(false);
    }
    // Reset from the opened task snapshot; listing every nested field would still miss props.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open + task.id gate the form reset
  }, [
    open,
    task.id,
    task.title,
    task.priority,
    task.status,
    task.dueDate,
    task.notes,
    task.noteRefs,
    task.projectId,
    task.clientId,
    task.areaId,
    task.assigneeUserId,
    task.assigneeContactId,
    task.source,
    task.sourceContext,
  ]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setSourceLoading(true);
    void loadTaskForEdit(task.id, workspaceAccountId)
      .then((fresh) => {
        if (cancelled || !fresh) return;
        setSource(fresh.source ?? 'manual');
        setSourceContext(fresh.sourceContext ?? null);
        if (fresh.subtasks) {
          setSubtasks(fresh.subtasks);
        }
      })
      .finally(() => {
        if (!cancelled) setSourceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, task.id, workspaceAccountId]);

  useEffect(() => {
    if (!open || !pickerOpen || !notesAccountId) return;
    let cancelled = false;
    setPickerLoading(true);
    void listNotesAndFilesForContextAction({ accountId: notesAccountId })
      .then((result) => {
        if (cancelled) return;
        const notesOnly = (result.items ?? [])
          .filter((item) => item.type === 'note')
          .map((item) => ({
            id: item.id,
            title: item.title,
            preview: item.preview,
          }));
        setPickerNotes(notesOnly);
      })
      .catch(() => {
        if (!cancelled) setPickerNotes([]);
      })
      .finally(() => {
        if (!cancelled) setPickerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notesAccountId, open, pickerOpen]);

  async function handleAddSubtask() {
    if (!isRootTask) return;
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed) return;
    setError(null);
    setSubtaskAdding(true);
    try {
      const result = await createTask({
        title: trimmed,
        priority: 'medium',
        parentTaskId: task.id,
        parentTaskContext: {
          projectId: task.projectId,
          clientId: task.clientId,
          areaId: task.areaId,
        },
        projectId: task.projectId ?? undefined,
        clientId: task.clientId ?? undefined,
        areaId: task.areaId ?? undefined,
      });
      if (!result.success) {
        setError(result.error ?? 'Failed to add subtask');
        return;
      }
      setNewSubtaskTitle('');
      onSaved?.();
      await refreshSubtasks();
      router.refresh();
    } finally {
      setSubtaskAdding(false);
    }
  }

  function handleDeleteConfirm() {
    setError(null);
    setIsDeleting(true);
    startTransition(async () => {
      const result = await deleteTask(task.id);
      setIsDeleting(false);
      if (!result.success) {
        setError(result.error ?? 'Failed to delete task');
        return;
      }
      setDeleteDialogOpen(false);
      onOpenChange(false);
      onDeleted?.();
      router.refresh();
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title is required');
      return;
    }

    const selected = options.find((o) => o.id === assignTo);

    if (isWorkspaceMode && (!selected || assignTo === 'none')) {
      setError(
        'Choose a project or client so this task stays in this workspace.',
      );
      return;
    }

    const assignment = assignmentFromSelection(assignTo, options);
    const person = parsePersonAssigneeSelectValue(personAssignee);

    const showDayOfMonth =
      frequency === 'monthly' ||
      frequency === 'quarterly' ||
      frequency === 'yearly';

    startTransition(async () => {
      const result = await updateTask(task.id, {
        title: trimmedTitle,
        priority,
        status,
        dueDate: dueDate || null,
        notes: notes.trim() || null,
        noteRefs: canAttachNotes ? noteRefs : undefined,
        assignment,
        ...(notesAccountId
          ? {
              assigneeUserId:
                person.kind === 'member'
                  ? person.id
                  : person.kind === 'none'
                    ? null
                    : undefined,
              assigneeContactId:
                person.kind === 'contact'
                  ? person.id
                  : person.kind === 'member' || person.kind === 'none'
                    ? null
                    : undefined,
            }
          : {}),
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to update task');
        return;
      }

      if (repeat && !task.recurringSeriesId) {
        const dueDaysNum = Number.parseInt(dueDays, 10);
        const dayNum = Number.parseInt(dayOfMonth, 10);
        const seriesResult = await createTask({
          title: trimmedTitle,
          priority,
          notes: notes.trim() || null,
          projectId: task.projectId ?? undefined,
          clientId: task.clientId ?? undefined,
          areaId: task.areaId ?? undefined,
          accountId: notesAccountId ?? workspaceAccountId,
          recurrence: {
            frequency,
            firstCreateDate,
            dayOfMonth: showDayOfMonth
              ? Number.isFinite(dayNum)
                ? dayNum
                : undefined
              : null,
            dueDays: Number.isFinite(dueDaysNum) ? dueDaysNum : 0,
            createFirstNow: false,
          },
        });
        if (!seriesResult.success) {
          setError(
            seriesResult.error ??
              'Task saved, but could not start the recurring series',
          );
          onSaved?.();
          router.refresh();
          return;
        }
      }

      onOpenChange(false);
      onSaved?.();
      router.refresh();
    });
  }

  const projects = options.filter((o) => o.type === 'project');
  const clients = options.filter((o) => o.type === 'client');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                Source
              </p>
              {sourceLoading && !sourceContext && source === 'manual' ? (
                <p className="flex items-center gap-1.5 text-sm text-[var(--workspace-shell-text-muted)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading…
                </p>
              ) : source === 'manual' ? (
                <p className="text-sm text-[var(--workspace-shell-text)]">
                  Manual
                </p>
              ) : (
                <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-[var(--workspace-shell-text)]"
                    onClick={() => setSourceExpanded((v) => !v)}
                    aria-expanded={sourceExpanded}
                  >
                    <span className="font-medium">
                      {source === 'meeting' ? 'Meeting' : 'Email'}
                      {sourceContext?.title ? ` · ${sourceContext.title}` : ''}
                    </span>
                    {sourceExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
                    )}
                  </button>
                  {sourceExpanded ? (
                    <div className="space-y-2 border-t border-[color:var(--workspace-shell-border)] px-3 py-2.5">
                      {sourceLoading ? (
                        <p className="flex items-center gap-1.5 text-xs text-[var(--workspace-shell-text-muted)]">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading context…
                        </p>
                      ) : (
                        <>
                          {sourceContext?.excerpt ? (
                            <blockquote className="border-l-2 border-[var(--ozer-accent)]/60 pl-3 text-sm text-[var(--workspace-shell-text-muted)] italic">
                              {sourceContext.excerpt}
                            </blockquote>
                          ) : (
                            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                              No excerpt available for this{' '}
                              {source === 'meeting' ? 'meeting' : 'email'}.
                            </p>
                          )}
                          {sourceContext?.href ? (
                            <a
                              href={sourceContext.href}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex text-xs font-medium text-[var(--ozer-accent)] underline-offset-2 hover:underline"
                            >
                              Open {source === 'meeting' ? 'meeting' : 'email'}
                            </a>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {task.recurringSeriesId ? (
              <div className="flex flex-col gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[var(--workspace-shell-text)]">
                  This task is part of a recurring series.
                </p>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-[color:var(--workspace-shell-border)]"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await updateTaskRecurringSeriesStatusAction({
                            seriesId: task.recurringSeriesId!,
                            status: 'paused',
                          });
                          onSaved?.();
                          router.refresh();
                        } catch {
                          setError('Could not pause series');
                        }
                      });
                    }}
                  >
                    Pause series
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-[color:var(--workspace-shell-border)]"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await updateTaskRecurringSeriesStatusAction({
                            seriesId: task.recurringSeriesId!,
                            status: 'ended',
                          });
                          onSaved?.();
                          router.refresh();
                        } catch {
                          setError('Could not stop series');
                        }
                      });
                    }}
                  >
                    Stop series
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-2">
                <Label
                  htmlFor="edit-title"
                  className="text-[var(--workspace-shell-text-muted)]"
                >
                  Title *
                </Label>
                <Input
                  id="edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
                />
              </div>
              <div className="space-y-2 sm:w-[11rem]">
                <Label
                  htmlFor="edit-due"
                  className="text-[var(--workspace-shell-text-muted)]"
                >
                  Due date
                </Label>
                <Input
                  id="edit-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
                />
                {!task.recurringSeriesId ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--ozer-accent)] underline-offset-2 hover:underline"
                    onClick={() => {
                      setRepeatOpen((open) => {
                        const next = !open;
                        if (!next) setRepeat(false);
                        return next;
                      });
                    }}
                  >
                    {repeatOpen ? 'Hide recurring' : 'Make recurring'}
                  </button>
                ) : null}
              </div>
            </div>

            {!task.recurringSeriesId && repeatOpen ? (
              <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label
                      htmlFor="edit-repeat-task"
                      className="text-[var(--workspace-shell-text)]"
                    >
                      Repeat
                    </Label>
                    <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                      Schedule future copies of this task (won&apos;t duplicate
                      this one)
                    </p>
                  </div>
                  <Switch
                    id="edit-repeat-task"
                    checked={repeat}
                    onCheckedChange={setRepeat}
                  />
                </div>
                {repeat ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-[var(--workspace-shell-text-muted)]">
                        Frequency
                      </Label>
                      <Select
                        value={frequency}
                        onValueChange={(value) =>
                          setFrequency(value as RecurrenceFrequency)
                        }
                      >
                        <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                          {FREQUENCIES.map((item) => (
                            <SelectItem key={item.key} value={item.key}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="edit-first-create"
                        className="text-[var(--workspace-shell-text-muted)]"
                      >
                        Next create date
                      </Label>
                      <Input
                        id="edit-first-create"
                        type="date"
                        value={firstCreateDate}
                        onChange={(e) => {
                          setFirstCreateDate(e.target.value);
                          if (e.target.value) {
                            const day = Number.parseInt(
                              e.target.value.slice(8, 10),
                              10,
                            );
                            if (Number.isFinite(day)) {
                              setDayOfMonth(String(day));
                            }
                          }
                        }}
                        className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label
                        htmlFor="edit-due-days"
                        className="text-[var(--workspace-shell-text-muted)]"
                      >
                        Due days after create
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="edit-due-days"
                          type="number"
                          min={0}
                          max={365}
                          value={dueDays}
                          onChange={(e) => setDueDays(e.target.value)}
                          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                        />
                        <span className="shrink-0 text-sm text-[var(--workspace-shell-text-muted)]">
                          days
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label
                htmlFor="edit-notes"
                className="text-[var(--workspace-shell-text-muted)]"
              >
                Description
              </Label>
              <Textarea
                id="edit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add context, checklist items, links, or meeting notes…"
                className="min-h-[180px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-sm text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
              />
            </div>

            {canAttachNotes ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-[var(--workspace-shell-text-muted)]">
                    Attached notes
                  </Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[var(--workspace-shell-text-muted)]"
                      disabled={
                        isPending || creatingNote || noteRefs.length >= 30
                      }
                      onClick={() => {
                        if (!notesAccountId || !notesAccountSlug) return;
                        setCreatingNote(true);
                        void createBlankWorkspaceNoteAction({
                          accountId: notesAccountId,
                          accountSlug: notesAccountSlug,
                        })
                          .then(async (created) => {
                            const noteId = created.noteId as string;
                            await saveWorkspaceNoteAction({
                              accountId: notesAccountId,
                              accountSlug: notesAccountSlug,
                              noteId,
                              title: `Note for ${title.trim() || 'task'}`,
                              content: '',
                              link: { type: 'task', id: task.id },
                            });
                            setNoteRefs((prev) => [
                              ...prev,
                              {
                                id: noteId,
                                title: `Note for ${title.trim() || 'task'}`,
                              },
                            ]);
                          })
                          .catch(() => {
                            setError('Could not create note');
                          })
                          .finally(() => setCreatingNote(false));
                      }}
                    >
                      {creatingNote ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="mr-1 h-3.5 w-3.5" />
                      )}
                      New note
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[var(--workspace-shell-text-muted)]"
                      disabled={isPending || noteRefs.length >= 30}
                      onClick={() => setPickerOpen((v) => !v)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Attach
                    </Button>
                  </div>
                </div>

                {pickerOpen ? (
                  <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40 p-2.5">
                    <Input
                      value={pickerQuery}
                      onChange={(e) => setPickerQuery(e.target.value)}
                      placeholder="Search workspace notes…"
                      className="mb-2 h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-sm"
                      autoFocus
                    />
                    {pickerLoading ? (
                      <p className="px-1 py-3 text-xs text-[var(--workspace-shell-text-muted)]">
                        Loading notes…
                      </p>
                    ) : (
                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {pickerNotes
                          .filter(
                            (note) =>
                              !noteRefs.some((ref) => ref.id === note.id),
                          )
                          .filter((note) => {
                            const q = pickerQuery.trim().toLowerCase();
                            if (!q) return true;
                            return (
                              note.title.toLowerCase().includes(q) ||
                              note.preview.toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 20)
                          .map((note) => (
                            <button
                              key={note.id}
                              type="button"
                              className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-[var(--workspace-shell-sidebar-accent)]"
                              onClick={() => {
                                setNoteRefs((prev) => [
                                  ...prev,
                                  { id: note.id, title: note.title },
                                ]);
                                setPickerOpen(false);
                                setPickerQuery('');
                              }}
                            >
                              <span className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                                {note.title || 'Untitled note'}
                              </span>
                              {note.preview ? (
                                <span className="line-clamp-1 text-[11px] text-[var(--workspace-shell-text-muted)]">
                                  {note.preview}
                                </span>
                              ) : null}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {noteRefs.length === 0 ? (
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    Attach or create workspace notes for this task.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {noteRefs.map((ref) => {
                      const href = pathsConfig.app.accountNoteDetail
                        .replace('[account]', notesAccountSlug!)
                        .replace('[noteId]', ref.id);
                      return (
                        <li
                          key={ref.id}
                          className="flex items-center gap-2 rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40 px-2 py-1.5"
                        >
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 flex-1 truncate text-sm text-[var(--workspace-shell-text)] underline-offset-2 hover:underline"
                          >
                            {ref.title}
                          </a>
                          <button
                            type="button"
                            className="rounded p-1 text-[var(--workspace-shell-text-muted)] hover:text-[#E85D75]"
                            aria-label={`Detach ${ref.title}`}
                            onClick={() =>
                              setNoteRefs((prev) =>
                                prev.filter((item) => item.id !== ref.id),
                              )
                            }
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}

            {isRootTask ? (
              <div className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {subtasks.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSubtasksExpanded((v) => !v)}
                        className="rounded p-0.5 text-[var(--workspace-shell-text-muted)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
                        aria-expanded={subtasksExpanded}
                        aria-label={
                          subtasksExpanded
                            ? 'Collapse subtasks'
                            : 'Expand subtasks'
                        }
                      >
                        {subtasksExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                    <Label
                      htmlFor="new-subtask"
                      className="text-[var(--workspace-shell-text-muted)]"
                    >
                      Subtasks
                    </Label>
                  </div>
                  {subtasks.length > 0 ? (
                    <span className="shrink-0 text-xs text-[var(--workspace-shell-text-muted)] tabular-nums">
                      {doneSubtaskCount}/{subtasks.length} complete
                    </span>
                  ) : null}
                </div>

                {subtasks.length === 0 ? (
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    Break this task into smaller steps.
                  </p>
                ) : null}

                {subtasksExpanded && subtasks.length > 0 ? (
                  <div className="space-y-0.5 rounded-md border border-[color:var(--workspace-shell-border)]/60 bg-[var(--workspace-shell-panel)]/40 p-1.5">
                    {subtasksLoading ? (
                      <div className="flex items-center gap-2 px-1 py-2 text-xs text-[var(--workspace-shell-text-muted)]">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading subtasks…
                      </div>
                    ) : (
                      subtasks.map((subtask) => (
                        <SubtaskEditorRow
                          key={subtask.id}
                          subtask={subtask}
                          disabled={isPending || isDeleting || subtaskAdding}
                          onChange={(updated) => {
                            setSubtasks((prev) =>
                              prev.map((s) =>
                                s.id === updated.id ? updated : s,
                              ),
                            );
                            onSaved?.();
                            router.refresh();
                          }}
                          onRemove={(id) => {
                            setSubtasks((prev) =>
                              prev.filter((s) => s.id !== id),
                            );
                            onSaved?.();
                            router.refresh();
                          }}
                        />
                      ))
                    )}
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <Input
                    id="new-subtask"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleAddSubtask();
                      }
                    }}
                    placeholder="New subtask title"
                    className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)] sm:flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
                    disabled={
                      subtaskAdding || !newSubtaskTitle.trim() || isDeleting
                    }
                    onClick={() => void handleAddSubtask()}
                  >
                    {subtaskAdding ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Adding…
                      </>
                    ) : (
                      'Add subtask'
                    )}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[var(--workspace-shell-text-muted)]">
                  Priority
                </Label>
                <Select
                  value={priority}
                  onValueChange={(v) =>
                    setPriority(v as TasksPageTask['priority'])
                  }
                >
                  <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--workspace-shell-text-muted)]">
                  Status
                </Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as TasksPageTask['status'])}
                >
                  <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                    {STATUSES.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {notesAccountId ? (
              personOptionsLoading ? (
                <div className="flex h-9 items-center gap-2 rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 text-sm text-[var(--workspace-shell-text-muted)]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading assignees…
                </div>
              ) : (
                <TaskPersonAssigneeSelect
                  options={personOptions}
                  value={personAssignee}
                  onChange={setPersonAssignee}
                  disabled={isPending || isDeleting}
                />
              )
            ) : null}

            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">
                {isWorkspaceMode
                  ? 'Link to project or client *'
                  : 'Assign to (team project, client, or life area)'}
              </Label>
              {optionsLoading ? (
                <div className="flex h-9 items-center gap-2 rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 text-sm text-[var(--workspace-shell-text-muted)]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading…
                </div>
              ) : (
                <TaskAssignmentCombobox
                  value={assignTo}
                  onValueChange={setAssignTo}
                  options={options}
                  isWorkspaceMode={isWorkspaceMode}
                  placeholder={
                    isWorkspaceMode
                      ? 'Select project or client'
                      : 'No assignment'
                  }
                />
              )}
              {isWorkspaceMode &&
              !optionsLoading &&
              projects.length === 0 &&
              clients.length === 0 ? (
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Create a project or client in this workspace first.
                </p>
              ) : null}
            </div>

            {error && <p className="text-sm text-rose-400">{error}</p>}

            <DialogFooter className="flex-col gap-3 sm:flex-col">
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="h-9 rounded-xl border border-[color:var(--workspace-shell-border)] px-4 text-sm font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || isDeleting}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--ozer-accent)] px-4 text-sm font-medium text-[var(--workspace-shell-text)] shadow-sm transition-colors hover:bg-[var(--ozer-accent-hover)] disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save changes'
                  )}
                </button>
              </div>
              <div className="flex w-full justify-end border-t border-[color:var(--workspace-shell-border)] pt-3">
                <button
                  type="button"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isPending || isDeleting}
                  className="text-sm font-medium text-[#E85D75] transition-colors hover:text-rose-300 disabled:opacity-50"
                >
                  Delete task
                </button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--workspace-shell-text-muted)]">
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)]">
              Cancel
            </AlertDialogCancel>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="inline-flex h-10 items-center justify-center rounded-md bg-[#E85D75] px-4 text-sm font-medium text-[var(--workspace-shell-text)] transition-colors hover:bg-[#d64d65] disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
