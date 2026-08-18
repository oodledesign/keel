'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { CheckCircle2, MoreHorizontal, Trash2 } from 'lucide-react';

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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';

import { getErrorMessage } from '../../_lib/error-message';
import type { PhaseStatus } from '../../_lib/schema/project-phases.schema';
import { deletePhase, updatePhase } from '../../_lib/server/server-actions';
import {
  PHASE_STATUS_LABELS,
  PHASE_STATUS_STYLES,
  formatShortDate,
  toDateInputValue,
} from '../job-project/job-project.constants';

export type PhaseRecord = {
  id: string;
  name: string;
  description: string | null;
  status: PhaseStatus;
  is_milestone: boolean;
  colour: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
};

const STATUS_OPTIONS: PhaseStatus[] = [
  'not_started',
  'in_progress',
  'blocked',
  'complete',
];

type PhaseDraft = {
  name: string;
  status: PhaseStatus;
  colour: string;
  start_date: string;
  due_date: string;
  is_milestone: boolean;
};

function toDraft(phase: PhaseRecord): PhaseDraft {
  return {
    name: phase.name,
    status: phase.status,
    colour: phase.colour ?? '#FF5C34',
    start_date: toDateInputValue(phase.start_date),
    due_date: toDateInputValue(phase.due_date),
    is_milestone: phase.is_milestone,
  };
}

export function PhaseMetaPanel({
  accountId,
  accountSlug,
  jobId,
  phase,
  canEdit,
  onPhaseChange,
}: {
  accountId: string;
  accountSlug: string;
  jobId: string;
  phase: PhaseRecord;
  canEdit: boolean;
  onPhaseChange: (phase: PhaseRecord) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<PhaseDraft>(() => toDraft(phase));
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setDraft(toDraft(phase));
  }, [phase]);

  const save = (next: PhaseDraft, successMessage: string) => {
    const trimmed = next.name.trim();
    if (!trimmed) {
      toast.error('Phase name is required');
      return;
    }

    const optimistic: PhaseRecord = {
      ...phase,
      name: trimmed,
      status: next.status,
      colour: next.colour,
      start_date: next.start_date || null,
      due_date: next.due_date || null,
      is_milestone: next.is_milestone,
    };
    onPhaseChange(optimistic);

    startTransition(async () => {
      try {
        const saved = await updatePhase({
          accountId,
          accountSlug,
          jobId,
          phaseId: phase.id,
          name: trimmed,
          status: next.status,
          is_milestone: next.is_milestone,
          colour: next.colour,
          start_date: next.start_date
            ? new Date(`${next.start_date}T12:00:00`)
            : null,
          due_date: next.due_date
            ? new Date(`${next.due_date}T12:00:00`)
            : null,
        });
        onPhaseChange({ ...optimistic, ...(saved as PhaseRecord) });
        toast.success(successMessage);
      } catch (err) {
        toast.error(getErrorMessage(err));
        onPhaseChange(phase);
      }
    });
  };

  const handleDelete = () => {
    setDeleting(true);
    startTransition(async () => {
      try {
        await deletePhase({
          accountId,
          accountSlug,
          jobId,
          phaseId: phase.id,
        });
        toast.success('Phase deleted');
        router.push(
          pathsConfig.app.accountJobDetail
            .replace('[account]', accountSlug)
            .replace('[id]', jobId),
        );
        router.refresh();
      } catch (err) {
        toast.error(getErrorMessage(err));
        setDeleting(false);
        setDeleteOpen(false);
      }
    });
  };

  return (
    <section className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          {canEdit ? (
            <Input
              value={draft.name}
              disabled={pending || deleting}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, name: e.target.value }))
              }
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-lg font-semibold text-[var(--workspace-shell-text)]"
            />
          ) : (
            <h1 className="text-xl font-semibold text-[var(--workspace-shell-text)]">
              {phase.name}
            </h1>
          )}

          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
              PHASE_STATUS_STYLES[draft.status]
            }`}
          >
            {PHASE_STATUS_LABELS[draft.status]}
          </span>

          {phase.completed_at && (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Completed {formatShortDate(phase.completed_at.slice(0, 10))}
            </p>
          )}
        </div>

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending || deleting}
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              onClick={() => save(draft, 'Phase saved')}
            >
              {pending && !deleting ? 'Saving…' : 'Save'}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={pending || deleting}
                  className="h-8 w-8 border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
                  aria-label="Phase actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]"
              >
                {draft.status !== 'complete' ? (
                  <DropdownMenuItem
                    className="cursor-pointer focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
                    onSelect={() =>
                      save(
                        { ...draft, status: 'complete' },
                        'Phase marked complete',
                      )
                    }
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Mark complete
                  </DropdownMenuItem>
                ) : null}
                {draft.status !== 'complete' ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem
                  className="cursor-pointer text-red-700 focus:bg-red-500/10 focus:text-red-800"
                  onSelect={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete phase
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{phase.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the phase from the project. Tasks in this phase
                    stay on the project and move to Unassigned. Notes and docs
                    linked to the phase are unlinked.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 sm:gap-0">
                  <AlertDialogCancel
                    disabled={deleting}
                    className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
                  >
                    Cancel
                  </AlertDialogCancel>
                  <Button
                    variant="destructive"
                    disabled={deleting}
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-500"
                  >
                    {deleting ? 'Deleting…' : 'Delete phase'}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
            Status
          </Label>
          {canEdit ? (
            <Select
              value={draft.status}
              disabled={pending || deleting}
              onValueChange={(v) =>
                setDraft((prev) => ({ ...prev, status: v as PhaseStatus }))
              }
            >
              <SelectTrigger className="mt-1 h-9 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PHASE_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
              {PHASE_STATUS_LABELS[phase.status]}
            </p>
          )}
        </div>

        <div>
          <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
            Colour
          </Label>
          {canEdit ? (
            <Input
              type="color"
              value={draft.colour}
              disabled={pending || deleting}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, colour: e.target.value }))
              }
              className="mt-1 h-9 w-full cursor-pointer border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-1"
            />
          ) : (
            <div
              className="mt-2 h-4 w-4 rounded"
              style={{ backgroundColor: phase.colour ?? '#FF5C34' }}
            />
          )}
        </div>

        <div>
          <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
            Start
          </Label>
          {canEdit ? (
            <Input
              type="date"
              value={draft.start_date}
              disabled={pending || deleting}
              className="mt-1 h-9 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, start_date: e.target.value }))
              }
            />
          ) : (
            <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
              {formatShortDate(phase.start_date)}
            </p>
          )}
        </div>

        <div>
          <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
            Due
          </Label>
          {canEdit ? (
            <Input
              type="date"
              value={draft.due_date}
              disabled={pending || deleting}
              className="mt-1 h-9 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, due_date: e.target.value }))
              }
            />
          ) : (
            <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
              {formatShortDate(phase.due_date)}
            </p>
          )}
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-[var(--workspace-shell-text-muted)]">
        <input
          type="checkbox"
          checked={draft.is_milestone}
          disabled={!canEdit || pending || deleting}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, is_milestone: e.target.checked }))
          }
          className="rounded border-[color:var(--workspace-shell-border)]"
        />
        Milestone phase
      </label>
    </section>
  );
}
