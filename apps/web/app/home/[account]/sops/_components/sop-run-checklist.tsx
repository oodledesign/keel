'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Check, Copy, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import type {
  SopPlaybookRow,
  SopRunRow,
  SopRunStepRow,
  SopTeamMember,
} from '~/lib/sops/types';

import {
  duplicateSopRunAction,
  toggleSopRunStepAction,
  updateSopRunAssigneeAction,
  updateSopRunNotesAction,
} from '../_lib/server/sops-actions';
import { SopRunAssigneeSelect } from './sop-run-assignee-select';

const panelClass =
  'rounded-[24px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]';

type SopRunChecklistProps = {
  accountId: string;
  accountSlug: string;
  run: SopRunRow;
  playbook: SopPlaybookRow | null;
  steps: SopRunStepRow[];
  teamMembers: SopTeamMember[];
};

export function SopRunChecklist({
  accountId,
  accountSlug,
  run,
  playbook,
  steps,
  teamMembers,
}: SopRunChecklistProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(run.notes_md ?? '');
  const [assignedTo, setAssignedTo] = useState(run.assigned_to ?? '');
  const [notesPending, startNotesSave] = useTransition();
  const [assigneePending, startAssigneeSave] = useTransition();
  const [dupPending, startDup] = useTransition();
  const [stepPending, startStep] = useTransition();

  const completed = steps.filter((s) => s.is_complete).length;
  const total = steps.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const playbookPath = playbook
    ? pathsConfig.app.accountSopsPlaybook
        .replace('[account]', accountSlug)
        .replace('[playbookId]', playbook.id)
    : pathsConfig.app.accountSops.replace('[account]', accountSlug);

  function saveAssignee(nextAssignee: string | null) {
    setAssignedTo(nextAssignee ?? '');
    startAssigneeSave(async () => {
      try {
        await updateSopRunAssigneeAction({
          accountId,
          accountSlug,
          runId: run.id,
          assignedToUserId: nextAssignee,
        });
        toast.success(nextAssignee ? 'Assignee updated' : 'Run unassigned');
        router.refresh();
      } catch (e) {
        setAssignedTo(run.assigned_to ?? '');
        toast.error(
          e instanceof Error ? e.message : 'Could not update assignee',
        );
      }
    });
  }

  function saveNotes() {
    startNotesSave(async () => {
      try {
        await updateSopRunNotesAction({
          accountId,
          accountSlug,
          runId: run.id,
          notesMd: notes,
        });
        toast.success('Notes saved');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save notes');
      }
    });
  }

  function duplicateRun() {
    startDup(async () => {
      try {
        const result = await duplicateSopRunAction({
          accountId,
          accountSlug,
          runId: run.id,
        });
        if (result?.runId) {
          router.push(
            pathsConfig.app.accountSopsRun
              .replace('[account]', accountSlug)
              .replace('[runId]', result.runId),
          );
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not duplicate run');
      }
    });
  }

  function toggleStep(step: SopRunStepRow, checked: boolean) {
    startStep(async () => {
      try {
        const result = await toggleSopRunStepAction({
          accountId,
          accountSlug,
          stepStateId: step.id,
          isComplete: checked,
          stepNotes: step.step_notes,
        });
        if (result?.allDone) {
          toast.success('All steps complete — nice work!');
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not update step');
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 lg:px-0">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={playbookPath}
          className="text-[var(--ozer-accent)] hover:underline"
        >
          {playbook?.title ?? 'Playbook'}
        </Link>
        <span className="text-[var(--workspace-shell-text-muted)]">/</span>
        <span className="text-[var(--workspace-shell-text-muted)]">
          {run.period_label ?? 'Run'}
        </span>
        {run.status === 'completed' ? (
          <span className="rounded-full bg-[var(--ozer-accent-subtle)] px-2 py-0.5 text-xs text-[var(--ozer-accent)]">
            Completed
          </span>
        ) : null}
      </div>

      <div className={`${panelClass} p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--workspace-shell-text)]">
              {run.title}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {completed} of {total} steps complete ({pct}%)
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={dupPending}
            onClick={duplicateRun}
          >
            {dupPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Duplicate for new period
          </Button>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--workspace-shell-sidebar-accent)]">
          <div
            className="h-full rounded-full bg-[var(--ozer-accent)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {teamMembers.length > 0 ? (
          <div className="mt-4 max-w-xs">
            <SopRunAssigneeSelect
              id="run-assignee"
              members={teamMembers}
              value={assignedTo || null}
              disabled={assigneePending}
              onChange={saveAssignee}
            />
          </div>
        ) : null}
      </div>

      <div className={`${panelClass} divide-y divide-white/6`}>
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              'flex gap-4 px-5 py-4',
              step.is_complete && 'bg-[var(--ozer-accent)]/[0.04]',
            )}
          >
            <Checkbox
              checked={step.is_complete}
              disabled={stepPending}
              onCheckedChange={(v) => toggleStep(step, v === true)}
              className="mt-1 border-[color:var(--workspace-shell-border)] data-[state=checked]:border-[var(--ozer-accent)] data-[state=checked]:bg-[var(--ozer-accent)]"
            />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'font-medium text-[var(--workspace-shell-text)]',
                  step.is_complete &&
                    'text-[var(--workspace-shell-text-muted)] line-through',
                )}
              >
                {index + 1}. {step.title}
              </p>
              {step.body_md ? (
                <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
                  {step.body_md}
                </p>
              ) : null}
              {step.is_complete ? (
                <p className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
                  <Check className="h-3 w-3 text-[var(--ozer-accent)]" />
                  Done
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className={`${panelClass} space-y-3 p-6`}>
        <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Run notes
        </h2>
        <p className="text-muted-foreground text-xs">
          Client context, links, or anything specific to this month or project.
        </p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
          placeholder="Notes for this run…"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={notesPending}
          onClick={saveNotes}
        >
          {notesPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Save notes
        </Button>
      </div>
    </div>
  );
}
