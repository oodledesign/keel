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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
import { groupProjectsByWorkspace } from '../../tasks/_lib/group-task-options';

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

    if (isWorkspaceMode && (!selected || assignTo === 'none')) {
      setError('Choose a project or client so this task appears in this workspace.');
      return;
    }

    startTransition(async () => {
      const result = await createTask({
        title,
        priority,
        dueDate: dueDate || undefined,
        projectId: selected?.type === 'project' ? selected.id : undefined,
        areaId: selected?.type === 'area' ? selected.id : undefined,
        clientId: selected?.type === 'client' ? selected.id : undefined,
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
  const areas = options.filter((o) => o.type === 'area');
  const projectGroups = groupProjectsByWorkspace(projects);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[var(--keel-teal)] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#238b7f]"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="border-white/8 bg-[#0F1923] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a new task</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {isWorkspaceMode
              ? 'Link the task to a project or client in this workspace. It will show up on this team’s Tasks list.'
              : 'Assign to a team workspace project or a personal life area. Projects are grouped by workspace.'}
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-zinc-300">
              Task title *
            </Label>
            <Input
              id="title"
              name="title"
              placeholder="What needs to be done?"
              required
              autoFocus
              className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="border-white/10 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1A2535] text-white">
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate" className="text-zinc-300">
                Due date
              </Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">
              {isWorkspaceMode ? 'Link to project or client *' : 'Assign to'}
            </Label>
            {optionsLoading ? (
              <div className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-zinc-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </div>
            ) : (
              <Select value={assignTo} onValueChange={setAssignTo}>
                <SelectTrigger className="border-white/10 bg-white/5 text-white">
                  <SelectValue
                    placeholder={
                      isWorkspaceMode
                        ? 'Select project or client'
                        : 'No assignment'
                    }
                  />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1A2535] text-white">
                  {!isWorkspaceMode ? (
                    <SelectItem value="none">No assignment</SelectItem>
                  ) : null}
                  {projectGroups.length > 0
                    ? projectGroups.map((group) => (
                        <SelectGroup key={group.key}>
                          <SelectLabel className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                            {isWorkspaceMode ? 'Projects' : group.label}
                          </SelectLabel>
                          {group.projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              <span className="flex items-center gap-2">
                                {p.color && (
                                  <span
                                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: p.color }}
                                  />
                                )}
                                {p.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))
                    : null}
                  {isWorkspaceMode && clients.length > 0 ? (
                    <>
                      {projectGroups.length > 0 ? (
                        <SelectSeparator className="my-1 bg-white/10" />
                      ) : null}
                      <SelectGroup>
                        <SelectLabel className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                          Clients
                        </SelectLabel>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  ) : null}
                  {!isWorkspaceMode && areas.length > 0 ? (
                    <>
                      {projectGroups.length > 0 ? (
                        <SelectSeparator className="my-1 bg-white/10" />
                      ) : null}
                      <SelectGroup>
                        <SelectLabel className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Life areas
                        </SelectLabel>
                        {areas.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            <span className="flex items-center gap-2">
                              {a.color && (
                                <span
                                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: a.color }}
                                />
                              )}
                              {a.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  ) : null}
                </SelectContent>
              </Select>
            )}
            {isWorkspaceMode &&
            !optionsLoading &&
            projects.length === 0 &&
            clients.length === 0 ? (
              <p className="text-xs text-zinc-500">
                Create a project or client in this workspace first, then link a
                task here.
              </p>
            ) : null}
            {allowInlineClientCreate && isWorkspaceMode ? (
              <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                {showNewClient ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="Client or company name"
                      className="border-white/10 bg-white/5 text-white"
                    />
                    <button
                      type="button"
                      disabled={creatingClient || !newClientName.trim()}
                      onClick={() => void handleCreateClient()}
                      className="h-9 shrink-0 rounded-lg bg-[var(--keel-teal)] px-3 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {creatingClient ? 'Adding…' : 'Add client'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowNewClient(true)}
                    className="text-xs font-medium text-[var(--keel-teal)] hover:underline"
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
            <p className="text-xs text-zinc-500">
              <Link
                href={pathsConfig.app.accountTasksExtract.replace(
                  '[account]',
                  workspaceAccountSlug,
                )}
                className="font-medium text-[var(--keel-teal)] hover:underline"
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
              className="h-9 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--keel-teal)] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#238b7f] disabled:opacity-50"
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
