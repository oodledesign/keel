'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@kit/ui/dialog';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { TaskAssignmentCombobox } from '~/home/(user)/_components/dashboard/task-assignment-combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import { Loader2 } from 'lucide-react';

import type { TasksPageTask } from '../../_lib/server/tasks.loader';
import {
  createTask,
  deleteTask,
  loadTaskAssignmentOptions,
  loadTaskAssignmentOptionsForWorkspace,
  updateTask,
  type TaskAssignmentOption,
  type TaskAssignmentUpdate,
} from '../../_lib/actions/task-actions';

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

type Props = {
  task: TasksPageTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Team workspace tasks page — assignment limited to this account’s projects/clients. */
  workspaceAccountId?: string;
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

export function EditTaskDialog({
  task,
  open,
  onOpenChange,
  workspaceAccountId,
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
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [subtaskAdding, setSubtaskAdding] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const isWorkspaceMode = Boolean(workspaceAccountId);
  const isRootTask = !task.parentTaskId;

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
    if (open) {
      setTitle(task.title);
      setPriority(task.priority);
      setStatus(task.status);
      setDueDate(task.dueDate ?? '');
      setNotes(task.notes ?? '');
      setAssignTo(initialAssignTo(task));
      setError(null);
      setDeleteDialogOpen(false);
      setNewSubtaskTitle('');
    }
  }, [
    open,
    task.id,
    task.title,
    task.priority,
    task.status,
    task.dueDate,
    task.notes,
    task.projectId,
    task.clientId,
    task.areaId,
  ]);

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

    if (
      isWorkspaceMode &&
      (!selected || assignTo === 'none')
    ) {
      setError(
        'Choose a project or client so this task stays in this workspace.',
      );
      return;
    }

    const assignment = assignmentFromSelection(assignTo, options);

    startTransition(async () => {
      const result = await updateTask(task.id, {
        title: trimmedTitle,
        priority,
        status,
        dueDate: dueDate || null,
        notes: notes.trim() || null,
        assignment,
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to update task');
        return;
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
            <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
              <strong className="font-medium text-[var(--workspace-shell-text-muted)]">Work</strong> means
              linked to a team workspace project or CRM client (your business
              workspace). <strong className="font-medium text-[var(--workspace-shell-text-muted)]">
                Life
              </strong>{' '}
              is a personal area or no link — separate from team workspaces.
            </DialogDescription>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title" className="text-[var(--workspace-shell-text-muted)]">
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

            <div className="space-y-2">
              <Label htmlFor="edit-notes" className="text-[var(--workspace-shell-text-muted)]">
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

            {isRootTask ? (
              <div className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
                <Label htmlFor="new-subtask" className="text-[var(--workspace-shell-text-muted)]">
                  Subtasks
                </Label>
                {(task.subtasks?.length ?? 0) > 0 ? (
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    {(task.subtasks ?? []).filter((s) => s.status === 'completed').length}
                    /{(task.subtasks ?? []).length} complete
                  </p>
                ) : (
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    Break this task into smaller steps.
                  </p>
                )}
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
                <Label className="text-[var(--workspace-shell-text-muted)]">Priority</Label>
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
                <Label className="text-[var(--workspace-shell-text-muted)]">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) =>
                    setStatus(v as TasksPageTask['status'])
                  }
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

            <div className="space-y-2">
              <Label htmlFor="edit-due" className="text-[var(--workspace-shell-text-muted)]">
                Due date
              </Label>
              <Input
                id="edit-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
              />
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
