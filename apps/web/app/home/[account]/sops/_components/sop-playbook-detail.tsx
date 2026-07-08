'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Loader2, Play } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type {
  SopPlaybookRow,
  SopPlaybookStepRow,
  SopRunRow,
  SopTeamMember,
} from '~/lib/sops/types';

import { startSopRunAction } from '../_lib/server/sops-actions';
import { SopRunAssigneeSelect } from './sop-run-assignee-select';

const panelClass =
  'rounded-[24px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]';

type SopPlaybookDetailProps = {
  accountId: string;
  accountSlug: string;
  playbook: SopPlaybookRow;
  steps: SopPlaybookStepRow[];
  runs: SopRunRow[];
  teamMembers: SopTeamMember[];
};

export function SopPlaybookDetail({
  accountId,
  accountSlug,
  playbook,
  steps,
  runs,
  teamMembers,
}: SopPlaybookDetailProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [runTitle, setRunTitle] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState<string | null>(null);

  const libraryPath = pathsConfig.app.accountSops.replace('[account]', accountSlug);

  function startRun() {
    startTransition(async () => {
      try {
        const result = await startSopRunAction({
          accountId,
          accountSlug,
          playbookId: playbook.id,
          title: runTitle.trim() || undefined,
          assignedToUserId: assignedToUserId ?? undefined,
        });
        if (result?.runId) {
          router.push(
            pathsConfig.app.accountSopsRun
              .replace('[account]', accountSlug)
              .replace('[runId]', result.runId),
          );
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not start run');
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 lg:px-0">
      <Link href={libraryPath} className="text-sm text-[var(--ozer-accent)] hover:underline">
        ← All SOPs
      </Link>

      <div className={`${panelClass} p-6`}>
        <h1 className="text-xl font-bold text-[var(--workspace-shell-text)]">{playbook.title}</h1>
        {playbook.description ? (
          <p className="text-muted-foreground mt-2 text-sm">{playbook.description}</p>
        ) : null}
        <p className="text-muted-foreground mt-3 text-xs">
          {steps.length} steps · {playbook.category ?? 'General'}
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <label className="text-xs text-[var(--workspace-shell-text-muted)]" htmlFor="run-title">
              Run title (optional)
            </label>
            <Input
              id="run-title"
              value={runTitle}
              onChange={(e) => setRunTitle(e.target.value)}
              placeholder="e.g. March 2026 — Acme Co"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
            />
          </div>
          {teamMembers.length > 0 ? (
            <div className="w-full min-w-0 sm:w-56">
              <SopRunAssigneeSelect
                id="start-run-assignee"
                members={teamMembers}
                value={assignedToUserId}
                disabled={pending}
                onChange={setAssignedToUserId}
              />
            </div>
          ) : null}
          <Button
            type="button"
            disabled={pending || steps.length === 0}
            onClick={startRun}
            className="ozer-gradient-btn shrink-0"
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Start checklist
          </Button>
        </div>
      </div>

      <div className={`${panelClass} divide-y divide-white/6`}>
        <div className="px-5 py-3">
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">Process steps</h2>
        </div>
        {steps.map((step, index) => (
          <div key={step.id} className="px-5 py-4">
            <p className="font-medium text-[var(--workspace-shell-text)]">
              {index + 1}. {step.title}
            </p>
            {step.body_md ? (
              <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-sm">
                {step.body_md}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {runs.length > 0 ? (
        <div className={`${panelClass} divide-y divide-white/6`}>
          <div className="px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">Past runs</h2>
          </div>
          {runs.map((run) => (
            <Link
              key={run.id}
              href={pathsConfig.app.accountSopsRun
                .replace('[account]', accountSlug)
                .replace('[runId]', run.id)}
              className="block px-5 py-4 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
            >
              <p className="font-medium text-[var(--workspace-shell-text)]">{run.title}</p>
              <p className="text-muted-foreground text-xs capitalize">
                {run.status}
                {run.period_label ? ` · ${run.period_label}` : ''}
              </p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
