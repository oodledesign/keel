'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Loader2, Plus, Sparkles } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Switch } from '@kit/ui/switch';

import pathsConfig from '~/config/paths.config';
import { createClient } from '~/home/[account]/clients/_lib/server/server-actions';
import { PERSONAL_WORKSPACE_VALUE } from '~/lib/workspace-personal-switcher';

import {
  type TaskAssignmentOption,
  createTask,
  loadPersonalLifeAssignmentOptions,
  loadTaskAssignmentOptionsForWorkspace,
} from '../../_lib/actions/task-actions';
import { TaskAssignmentCombobox } from './task-assignment-combobox';

const PRIORITIES = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
  { key: 'urgent', label: 'Urgent' },
];

const FREQUENCIES = [
  { key: 'weekly', label: 'Every week' },
  { key: 'fortnightly', label: 'Every 2 weeks' },
  { key: 'monthly', label: 'Every month' },
  { key: 'quarterly', label: 'Every quarter' },
  { key: 'yearly', label: 'Every year' },
] as const;

type RecurrenceFrequency = (typeof FREQUENCIES)[number]['key'];

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}
export type CreateTaskWorkspaceChoice = {
  id: string;
  name: string;
  slug: string;
};

type AddTaskDialogProps = {
  /** When set, default target is this team workspace. */
  workspaceAccountId?: string;
  /** Slug for workspace routes (e.g. AI task extract). */
  workspaceAccountSlug?: string;
  /**
   * Personal shell: only life areas; task always stays personal.
   * No cross-workspace assignment.
   */
  lifeOnly?: boolean;
  /**
   * Team shell: let the user assign the task to Personal or another workspace
   * without leaving the current shell.
   */
  workspaceChoices?: CreateTaskWorkspaceChoice[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  allowInlineClientCreate?: boolean;
  /** Called after a task is created successfully. */
  onCreated?: (taskId: string | null) => void;
};

export function AddTaskDialog({
  workspaceAccountId,
  workspaceAccountSlug,
  lifeOnly = false,
  workspaceChoices,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  allowInlineClientCreate = false,
  onCreated,
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
  const [repeat, setRepeat] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [firstCreateDate, setFirstCreateDate] = useState(todayYmd);
  const [dayOfMonth, setDayOfMonth] = useState(() =>
    String(new Date().getUTCDate()),
  );
  const [dueDays, setDueDays] = useState('0');
  /** `PERSONAL_WORKSPACE_VALUE` = personal/life; otherwise a team account id. */
  const [targetKey, setTargetKey] = useState(() =>
    lifeOnly
      ? PERSONAL_WORKSPACE_VALUE
      : (workspaceAccountId ?? PERSONAL_WORKSPACE_VALUE),
  );

  const teamChoices: CreateTaskWorkspaceChoice[] =
    workspaceChoices && workspaceChoices.length > 0
      ? workspaceChoices
      : workspaceAccountId
        ? [
            {
              id: workspaceAccountId,
              name: 'This workspace',
              slug: workspaceAccountSlug ?? '',
            },
          ]
        : [];

  const canSwitchWorkspace = !lifeOnly && teamChoices.length > 0;

  const isPersonalTarget =
    lifeOnly || targetKey === PERSONAL_WORKSPACE_VALUE || !targetKey;

  const targetAccountId = isPersonalTarget ? undefined : targetKey;
  const targetSlug = isPersonalTarget
    ? undefined
    : teamChoices.find((w) => w.id === targetKey)?.slug ||
      (targetKey === workspaceAccountId ? workspaceAccountSlug : undefined);

  const isWorkspaceMode = Boolean(targetAccountId);

  useEffect(() => {
    if (!open) {
      setOptions([]);
      setAssignTo('none');
      setError(null);
      setShowNewClient(false);
      setNewClientName('');
      setRepeat(false);
      setFrequency('monthly');
      setFirstCreateDate(todayYmd());
      setDayOfMonth(String(new Date().getUTCDate()));
      setDueDays('0');
      setTargetKey(
        lifeOnly
          ? PERSONAL_WORKSPACE_VALUE
          : (workspaceAccountId ?? PERSONAL_WORKSPACE_VALUE),
      );
      return;
    }

    void loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when target changes while open
  }, [open, targetKey, lifeOnly, workspaceAccountId]);

  async function loadOptions(): Promise<TaskAssignmentOption[]> {
    setOptionsLoading(true);
    try {
      const data =
        lifeOnly || targetKey === PERSONAL_WORKSPACE_VALUE || !targetKey
          ? await loadPersonalLifeAssignmentOptions()
          : await loadTaskAssignmentOptionsForWorkspace(targetKey);
      setOptions(data);
      return data;
    } finally {
      setOptionsLoading(false);
    }
  }

  async function handleCreateClient() {
    if (!targetAccountId || !newClientName.trim()) {
      return;
    }

    setCreatingClient(true);
    setError(null);
    try {
      await createClient({
        accountId: targetAccountId,
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

  function handleTargetChange(next: string) {
    setTargetKey(next);
    setAssignTo('none');
    setShowNewClient(false);
    setNewClientName('');
    setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    const title = String(form.get('title') ?? '').trim();
    const dueDate = String(form.get('dueDate') ?? '').trim();

    if (!title) {
      setError('Task title is required');
      return;
    }

    const selected = options.find((o) => o.id === assignTo);
    const needsDayOfMonth =
      frequency === 'monthly' ||
      frequency === 'quarterly' ||
      frequency === 'yearly';

    if (repeat && !firstCreateDate) {
      setError('Choose when the first task should be created');
      return;
    }

    const parsedDueDays = Number.parseInt(dueDays, 10);
    if (repeat && (!Number.isFinite(parsedDueDays) || parsedDueDays < 0)) {
      setError('Due days must be 0 or more');
      return;
    }

    startTransition(async () => {
      const result = await createTask({
        title,
        priority,
        dueDate: repeat ? undefined : dueDate || undefined,
        projectId: selected?.type === 'project' ? selected.id : undefined,
        areaId: selected?.type === 'area' ? selected.id : undefined,
        clientId: selected?.type === 'client' ? selected.id : undefined,
        accountId: targetAccountId,
        recurrence: repeat
          ? {
              frequency,
              firstCreateDate,
              dayOfMonth: needsDayOfMonth
                ? Number.parseInt(dayOfMonth, 10) || 1
                : null,
              dueDays: Number.isFinite(parsedDueDays) ? parsedDueDays : 0,
            }
          : undefined,
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to create task');
        return;
      }

      setOpen(false);
      setPriority('medium');
      setAssignTo('none');
      setRepeat(false);
      formRef.current?.reset();
      onCreated?.(result.id);
      router.refresh();
    });
  }

  const showDayOfMonth =
    repeat &&
    (frequency === 'monthly' ||
      frequency === 'quarterly' ||
      frequency === 'yearly');

  const projects = options.filter((o) => o.type === 'project');
  const clients = options.filter((o) => o.type === 'client');

  const description = lifeOnly
    ? 'Assign to a life area, or leave unassigned. Tasks created here stay in Personal.'
    : canSwitchWorkspace
      ? isPersonalTarget
        ? 'This task will be created in Personal. Assign a life area or leave unassigned.'
        : 'Link to a project or client in the selected workspace, or leave unassigned.'
      : isWorkspaceMode
        ? 'Link to a project or client, or leave unassigned — the task still belongs to this workspace.'
        : 'Assign to a life area, or leave unassigned. Tasks created here stay in Personal.';

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
            {description}
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="title"
              className="text-[var(--workspace-shell-text-muted)]"
            >
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
              <Label className="text-[var(--workspace-shell-text-muted)]">
                Priority
              </Label>
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
            {!repeat ? (
              <div className="space-y-2">
                <Label
                  htmlFor="dueDate"
                  className="text-[var(--workspace-shell-text-muted)]"
                >
                  Due date
                </Label>
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label
                  htmlFor="dueDays"
                  className="text-[var(--workspace-shell-text-muted)]"
                >
                  Due after create
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="dueDays"
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
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label
                  htmlFor="repeat-task"
                  className="text-[var(--workspace-shell-text)]"
                >
                  Repeat
                </Label>
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Create this task on a schedule, like recurring invoices
                </p>
              </div>
              <Switch
                id="repeat-task"
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
                    htmlFor="firstCreateDate"
                    className="text-[var(--workspace-shell-text-muted)]"
                  >
                    First create date
                  </Label>
                  <Input
                    id="firstCreateDate"
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

                {showDayOfMonth ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[var(--workspace-shell-text-muted)]">
                      Day of month
                    </Label>
                    <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                      <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(
                          (day) => (
                            <SelectItem key={day} value={String(day)}>
                              {day}
                              {day === 31
                                ? ' (or last day of shorter months)'
                                : ''}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                      Each occurrence is created on this calendar day. Due date
                      is{' '}
                      {dueDays === '0'
                        ? 'the same day'
                        : `${dueDays} days later`}
                      .
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--workspace-shell-text-muted)] sm:col-span-2">
                    Repeats on the same weekday as the first create date. Due
                    date is{' '}
                    {dueDays === '0' ? 'the same day' : `${dueDays} days later`}
                    .
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {canSwitchWorkspace ? (
            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">
                Workspace
              </Label>
              <Select value={targetKey} onValueChange={handleTargetChange}>
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                  <SelectItem value={PERSONAL_WORKSPACE_VALUE}>
                    Personal
                  </SelectItem>
                  {(teamChoices ?? []).map((choice) => (
                    <SelectItem key={choice.id} value={choice.id}>
                      {choice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label className="text-[var(--workspace-shell-text-muted)]">
              {isWorkspaceMode ? 'Link to project or client' : 'Life area'}
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
                workspaceName={
                  isWorkspaceMode
                    ? (teamChoices.find((w) => w.id === targetKey)?.name ??
                      null)
                    : null
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

          {error && <p className="text-sm text-rose-400">{error}</p>}

          {isWorkspaceMode && targetSlug ? (
            <div className="space-y-1.5 text-xs text-[var(--workspace-shell-text-muted)]">
              <p>
                <Link
                  href={pathsConfig.app.accountTasksExtract.replace(
                    '[account]',
                    targetSlug,
                  )}
                  className="font-medium text-[var(--ozer-accent)] hover:underline"
                  onClick={() => setOpen(false)}
                >
                  <Sparkles className="mr-1 inline h-3 w-3" />
                  Extract tasks from email or transcript (AI)
                </Link>
              </p>
              <p>
                Or{' '}
                <Link
                  href={pathsConfig.app.accountTasksImport.replace(
                    '[account]',
                    targetSlug,
                  )}
                  className="font-medium text-[var(--ozer-accent)] hover:underline"
                  onClick={() => setOpen(false)}
                >
                  upload via CSV
                </Link>
              </p>
            </div>
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
