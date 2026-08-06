'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from '@kit/ui/textarea';

import { TaskAssignmentCombobox } from '~/home/(user)/_components/dashboard/task-assignment-combobox';

import {
  type TaskAssignmentOption,
  type TaskAssignmentUpdate,
  loadTaskAssignmentOptions,
  loadTaskAssignmentOptionsForWorkspace,
  updateTaskRecurringSeriesAction,
  updateTaskRecurringSeriesStatusAction,
} from '../../_lib/actions/task-actions';

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

export type EditableScheduledSeries = {
  id: string;
  title: string;
  frequency: string;
  status: 'active' | 'paused' | 'ended';
  nextCreateAt?: string;
  nextCreateYmd: string;
  dueDays: number;
  occurrencesCreated: number;
  accountId: string | null;
  priority: string;
  notes: string | null;
  dayOfMonth: number | null;
  projectId: string | null;
  clientId: string | null;
  areaId: string | null;
};

type Props = {
  series: EditableScheduledSeries | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceAccountId?: string;
  onSaved?: (series: EditableScheduledSeries) => void;
  onEnded?: (seriesId: string) => void;
};

function initialAssignTo(series: EditableScheduledSeries): string {
  if (series.projectId) return series.projectId;
  if (series.clientId) return series.clientId;
  if (series.areaId) return series.areaId;
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

export function EditScheduledSeriesDialog({
  series,
  open,
  onOpenChange,
  workspaceAccountId,
  onSaved,
  onEnded,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [notes, setNotes] = useState('');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [nextCreateDate, setNextCreateDate] = useState('');
  const [dueDays, setDueDays] = useState('0');
  const [status, setStatus] = useState<'active' | 'paused'>('active');

  const [options, setOptions] = useState<TaskAssignmentOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [assignTo, setAssignTo] = useState('none');

  const isWorkspaceMode = Boolean(workspaceAccountId);
  const showDayOfMonth =
    frequency === 'monthly' ||
    frequency === 'quarterly' ||
    frequency === 'yearly';

  useEffect(() => {
    if (!open || !series) return;
    setTitle(series.title);
    setPriority(series.priority || 'medium');
    setNotes(series.notes ?? '');
    setFrequency(
      (FREQUENCIES.some((f) => f.key === series.frequency)
        ? series.frequency
        : 'monthly') as RecurrenceFrequency,
    );
    setNextCreateDate(series.nextCreateYmd);
    setDueDays(String(series.dueDays ?? 0));
    setStatus(series.status === 'paused' ? 'paused' : 'active');
    setAssignTo(initialAssignTo(series));
    setError(null);
  }, [open, series]);

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!series) return;

    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required');
      return;
    }
    if (!nextCreateDate) {
      setError('Next create date is required');
      return;
    }

    const selected = options.find((o) => o.id === assignTo);
    if (isWorkspaceMode && (!selected || assignTo === 'none')) {
      setError(
        'Choose a project or client so this series stays in this workspace.',
      );
      return;
    }

    const dueDaysNum = Number.parseInt(dueDays, 10);
    const dayFromDate = Number.parseInt(nextCreateDate.slice(8, 10), 10);

    startTransition(async () => {
      const result = await updateTaskRecurringSeriesAction({
        seriesId: series.id,
        title: trimmed,
        priority,
        notes: notes.trim() || null,
        frequency,
        nextCreateDate,
        dayOfMonth: showDayOfMonth
          ? Number.isFinite(dayFromDate)
            ? dayFromDate
            : (series.dayOfMonth ?? null)
          : null,
        dueDays: Number.isFinite(dueDaysNum) ? dueDaysNum : 0,
        status,
        assignment: assignmentFromSelection(assignTo, options),
      });

      if (!result.success || !result.series) {
        setError(result.error ?? 'Failed to update series');
        return;
      }

      onSaved?.(result.series);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit scheduled series</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            Changes apply to future task copies. Already created tasks are
            unchanged.
            {series ? <> {series.occurrencesCreated} created so far.</> : null}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="series-title"
              className="text-[var(--workspace-shell-text-muted)]"
            >
              Title *
            </Label>
            <Input
              id="series-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
            />
          </div>

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
                htmlFor="series-next-create"
                className="text-[var(--workspace-shell-text-muted)]"
              >
                Next create date
              </Label>
              <Input
                id="series-next-create"
                type="date"
                value={nextCreateDate}
                onChange={(e) => setNextCreateDate(e.target.value)}
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="series-due-days"
                className="text-[var(--workspace-shell-text-muted)]"
              >
                Due days after create
              </Label>
              <Input
                id="series-due-days"
                type="number"
                min={0}
                max={365}
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value)}
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">
                Priority
              </Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                  {PRIORITIES.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[var(--workspace-shell-text-muted)]">
              Status
            </Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as 'active' | 'paused')}
            >
              <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
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
                  isWorkspaceMode ? 'Select project or client' : 'No assignment'
                }
              />
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="series-notes"
              className="text-[var(--workspace-shell-text-muted)]"
            >
              Notes
            </Label>
            <Textarea
              id="series-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Copied onto each created task…"
              className="min-h-[100px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-sm text-[var(--workspace-shell-text)]"
            />
          </div>

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="border-[color:var(--workspace-shell-border)] text-[#E85D75]"
              disabled={isPending || !series}
              onClick={() => {
                if (!series) return;
                startTransition(async () => {
                  try {
                    await updateTaskRecurringSeriesStatusAction({
                      seriesId: series.id,
                      status: 'ended',
                    });
                    onEnded?.(series.id);
                    onOpenChange(false);
                    router.refresh();
                  } catch {
                    setError('Could not stop series');
                  }
                });
              }}
            >
              Stop series
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-[color:var(--workspace-shell-border)]"
                disabled={isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-[var(--ozer-accent)] text-[#09111F] hover:bg-[var(--ozer-accent)]/90"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
