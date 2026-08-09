'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { CheckCircle2, Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
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

import { projectDetailHref } from '~/lib/projects/project-paths';

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
  const [, startTransition] = useTransition();
  const [name, setName] = useState(phase.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(phase.name);
  }, [phase.name, phase.id]);

  const patch = (updates: Partial<PhaseRecord>) => {
    const optimistic = { ...phase, ...updates };
    onPhaseChange(optimistic);
    startTransition(async () => {
      try {
        const saved = await updatePhase({
          accountId,
          accountSlug,
          jobId,
          phaseId: phase.id,
          name: updates.name,
          description: updates.description ?? undefined,
          status: updates.status,
          is_milestone: updates.is_milestone,
          colour: updates.colour,
          start_date:
            updates.start_date === undefined
              ? undefined
              : updates.start_date
                ? new Date(`${updates.start_date}T12:00:00`)
                : null,
          due_date:
            updates.due_date === undefined
              ? undefined
              : updates.due_date
                ? new Date(`${updates.due_date}T12:00:00`)
                : null,
        });
        onPhaseChange({ ...optimistic, ...(saved as PhaseRecord) });
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
        router.push(projectDetailHref(accountSlug, jobId));
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                const trimmed = name.trim();
                if (trimmed && trimmed !== phase.name) {
                  patch({ name: trimmed });
                } else {
                  setName(phase.name);
                }
              }}
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-lg font-semibold text-[var(--workspace-shell-text)]"
            />
          ) : (
            <h1 className="text-xl font-semibold text-[var(--workspace-shell-text)]">
              {phase.name}
            </h1>
          )}

          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
              PHASE_STATUS_STYLES[phase.status]
            }`}
          >
            {PHASE_STATUS_LABELS[phase.status]}
          </span>

          {phase.completed_at && (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Completed {formatShortDate(phase.completed_at.slice(0, 10))}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && phase.status !== 'complete' && (
            <Button
              type="button"
              size="sm"
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              onClick={() => patch({ status: 'complete' })}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              Mark complete
            </Button>
          )}

          {canEdit ? (
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-red-500/40 text-red-700 hover:bg-red-500/10 hover:text-red-800"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete phase
                </Button>
              </AlertDialogTrigger>
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
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
            Status
          </Label>
          {canEdit ? (
            <Select
              value={phase.status}
              onValueChange={(v) => patch({ status: v as PhaseStatus })}
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
              value={phase.colour ?? '#FF5C34'}
              onChange={(e) => patch({ colour: e.target.value })}
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
              defaultValue={toDateInputValue(phase.start_date)}
              className="mt-1 h-9 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
              onBlur={(e) => {
                const val = e.target.value || null;
                if (val !== toDateInputValue(phase.start_date)) {
                  patch({ start_date: val });
                }
              }}
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
              defaultValue={toDateInputValue(phase.due_date)}
              className="mt-1 h-9 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
              onBlur={(e) => {
                const val = e.target.value || null;
                if (val !== toDateInputValue(phase.due_date)) {
                  patch({ due_date: val });
                }
              }}
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
          checked={phase.is_milestone}
          disabled={!canEdit}
          onChange={(e) => patch({ is_milestone: e.target.checked })}
          className="rounded border-[color:var(--workspace-shell-border)]"
        />
        Milestone phase
      </label>
    </section>
  );
}
