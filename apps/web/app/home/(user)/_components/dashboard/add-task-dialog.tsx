'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import Link from 'next/link';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
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

import { Loader2, Plus, Sparkles } from 'lucide-react';

import pathsConfig from '~/config/paths.config';

import {
  createTask,
  loadTaskAssignmentOptions,
  loadTaskAssignmentOptionsForWorkspace,
  type TaskAssignmentOption,
} from '../../_lib/actions/task-actions';
import { createClient } from '~/home/[account]/clients/_lib/server/server-actions';
import { TaskAssignmentCombobox } from './task-assignment-combobox';

const PRIORITIES = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
  { key: 'urgent', label: 'Urgent' },
];

type AddTaskDialogProps = {
  /** When set, only projects/clients in this team workspace; assignment required so the task appears on workspace Tasks. */
  workspaceAccountId?: string;
  /** Slug for workspace routes (e.g. AI task extract). Required when `workspaceAccountId` is set. */
  workspaceAccountSlug?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  allowInlineClientCreate?: boolean;
};

export function AddTaskDialog({
  workspaceAccountId,
  workspaceAccountSlug,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  allowInlineClientCreate = false,
}: AddTaskDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<TaskAssignmentOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [priority, setPriority] = useState('medium');
  const [assignTo, setAssignTo] = useState('none');

  const isWorkspaceMode = Boolean(workspaceAccountId);

  useEffect(() => {
    if (!open) {
      setOptions([]);
      setAssignTo('none');
      setError(null);
      setShowNewClient(false);
      setNewClientName('');
      return;
    }

    void loadOptions();
  }, [open, workspaceAccountId]);

  async function loadOptions(): Promise<TaskAssignmentOption[]> {
    setOptionsLoading(true);
    try {
      const data = workspaceAccountId
        ? await loadTaskAssignmentOptionsForWorkspace(workspaceAccountId)
        : await loadTaskAssignmentOptions();
      setOptions(data);
      return data;
    } finally {
      setOptionsLoading(false);
    }
  }

  async function handleCreateClient() {
    if (!workspaceAccountId || !newClientName.trim()) {
      return;
    }

    setCreatingClient(true);
    setError(null);
    try {
      await createClient({
        accountId: workspaceAccountId,
        client_type: 'business',
        company_name: newClientName.trim(),
        first_name: newClientName.trim(),
      });
      const fresh = await loadOptions();
      const match = fresh.find(
        (option) =>
          option.type === 'client' &&
          option.name.toLowerCase() === newClientName.trim().toLowerCase(),
      );
      if (match) {
        setAssignTo(match.id);
      }
      setShowNewClient(false);
      setNewClientName('');
    } catch {
      setError('Could not create client');
    } finally {
      setCreatingClient(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    const title = (form.get('title') as string).trim();
    const dueDate = (form.get('dueDate') as string).trim();

    if (!title) {
      setError('Task title is required');
      return;
    }

    const selected = options.find((o) => o.id === assignTo);

    startTransition(async () => {
      const result = await createTask({
        title,
        priority,
        dueDate: dueDate || undefined,
        projectId: selected?.type === 'project' ? selected.id : undefined,
        areaId: selected?.type === 'area' ? selected.id : undefined,
        clientId: selected?.type === 'client' ? selected.id : undefined,
        accountId: workspaceAccountId,
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to create task');
        return;
      }

      setOpen(false);
      setPriority('medium');
      setAssignTo('none');
      formRef.current?.reset();
      router.refresh();
    });
  }

  const projects = options.filter((o) => o.type === 'project');
  const clients = options.filter((o) => o.type === 'client');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-accent)] px-4 text-sm font-medium text-[var(--workspace-shell-text)] shadow-sm transition-colors hover:bg-[var(--ozer-accent-hover)]"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a new task</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            {isWorkspaceMode
              ? 'Link to a project or client, or leave unassigned — the task still belongs to this workspace.'
              : 'Assign to a team workspace project or a personal life area. Projects are grouped by workspace.'}
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-[var(--workspace-shell-text-muted)]">
              Task title *
            </Label>
            <Input
              id="title"
              name="title"
              placeholder="What needs to be done?"
              required
              autoFocus
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
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
              <Label htmlFor="dueDate" className="text-[var(--workspace-shell-text-muted)]">
                Due date
              </Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[var(--workspace-shell-text-muted)]">
              {isWorkspaceMode ? 'Link to project or client' : 'Assign to'}
            </Label>
            {optionsLoading ? (
              <div className="flex h-9 items-center gap-2 rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 text-sm text-[var(--workspace-shell-text-muted)]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </div>
            ) : (
              <TaskAssignmentCombobox
                value={assignTo}
                onValueChange={setAssignTo}
                options={options}
                isWorkspaceMode={isWorkspaceMode}
                placeholder={
                  isWorkspaceMode
                    ? 'Workspace only (no project/client)'
                    : 'No assignment'
                }
              />
            )}
            {isWorkspaceMode &&
            !optionsLoading &&
            projects.length === 0 &&
            clients.length === 0 ? (
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Create a project or client in this workspace first, then link a
                task here.
              </p>
            ) : null}
            {allowInlineClientCreate && isWorkspaceMode ? (
              <div className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
                {showNewClient ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="Client or company name"
                      className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                    />
                    <button
                      type="button"
                      disabled={creatingClient || !newClientName.trim()}
                      onClick={() => void handleCreateClient()}
                      className="h-9 shrink-0 rounded-lg bg-[var(--ozer-accent)] px-3 text-sm font-medium text-[var(--workspace-shell-text)] disabled:opacity-50"
                    >
                      {creatingClient ? 'Adding…' : 'Add client'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowNewClient(true)}
                    className="text-xs font-medium text-[var(--ozer-accent)] hover:underline"
                  >
                    + Create new client
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {error && (
            <p className="text-sm text-rose-400">{error}</p>
          )}

          {isWorkspaceMode && workspaceAccountSlug ? (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              <Link
                href={pathsConfig.app.accountTasksExtract.replace(
                  '[account]',
                  workspaceAccountSlug,
                )}
                className="font-medium text-[var(--ozer-accent)] hover:underline"
              >
                <Sparkles className="mr-1 inline h-3 w-3" />
                Extract tasks from email or transcript (AI)
              </Link>
            </p>
          ) : null}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 rounded-xl border border-[color:var(--workspace-shell-border)] px-4 text-sm font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--ozer-accent)] px-4 text-sm font-medium text-[var(--workspace-shell-text)] shadow-sm transition-colors hover:bg-[var(--ozer-accent-hover)] disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Task'
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
