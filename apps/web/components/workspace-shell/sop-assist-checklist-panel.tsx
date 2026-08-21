'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { ChevronRight } from 'lucide-react';

import { Checkbox } from '@kit/ui/checkbox';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { toggleSopRunStepAction } from '~/home/[account]/sops/_lib/server/sops-actions';
import type {
  SopPlaybookStepRow,
  SopRunRow,
  SopRunStepRow,
} from '~/lib/sops/shared';
import {
  listingIdFromPathname,
  resolveSopTargetRoute,
  sopRunListingId,
} from '~/lib/sops/shared';

type SopAssistChecklistPanelProps = {
  accountId: string;
  accountSlug: string;
  run: SopRunRow;
  steps: SopRunStepRow[];
  playbookSteps: SopPlaybookStepRow[];
  /** Called after a successful toggle (e.g. refresh guides list). */
  onUpdated?: (result: { allDone: boolean }) => void;
  /** Compact spacing for the messenger panel. */
  compact?: boolean;
};

export function SopAssistChecklistPanel({
  accountId,
  accountSlug,
  run,
  steps: initialSteps,
  playbookSteps,
  onUpdated,
  compact = false,
}: SopAssistChecklistPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [steps, setSteps] = useState(initialSteps);
  const [listingId, setListingId] = useState<string | null>(
    () => sopRunListingId(run) ?? listingIdFromPathname(pathname),
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSteps(initialSteps);
  }, [initialSteps]);

  useEffect(() => {
    const fromRun = sopRunListingId(run);
    if (fromRun) {
      setListingId(fromRun);
      return;
    }
    const fromPath = listingIdFromPathname(pathname);
    if (fromPath) setListingId(fromPath);
  }, [run, pathname]);

  const playbookById = useMemo(() => {
    const map = new Map<string, SopPlaybookStepRow>();
    for (const step of playbookSteps) {
      map.set(step.id, step);
    }
    return map;
  }, [playbookSteps]);

  function stepNeedsListing(step: SopRunStepRow) {
    const pb = step.playbook_step_id
      ? playbookById.get(step.playbook_step_id)
      : undefined;
    return Boolean(pb?.target_route?.includes('[id]'));
  }

  async function navigateToStep(step: SopRunStepRow) {
    const pb = step.playbook_step_id
      ? playbookById.get(step.playbook_step_id)
      : undefined;

    if (stepNeedsListing(step) && !listingId) {
      toast.message('Create the disposal first', {
        description:
          'Open “Start the disposal record”, save the new disposal, then continue.',
      });
      const first = steps.find((s) => !stepNeedsListing(s)) ?? steps[0];
      if (first && first.id !== step.id) {
        await navigateToStep(first);
      }
      return;
    }

    const target =
      resolveSopTargetRoute(pb?.target_route, accountSlug, { listingId }) ??
      pathsConfig.app.accountListings.replace('[account]', accountSlug);

    const url = new URL(target, window.location.origin);
    url.searchParams.set('sopAssist', run.id);
    url.searchParams.set('sopStep', step.id);

    const nextPath = `${url.pathname}${url.search}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (nextPath !== current) {
      router.push(nextPath);
      return;
    }

    router.refresh();
  }

  function toggleStep(step: SopRunStepRow, nextComplete: boolean) {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === step.id
          ? {
              ...s,
              is_complete: nextComplete,
              completed_at: nextComplete ? new Date().toISOString() : null,
            }
          : s,
      ),
    );

    startTransition(async () => {
      try {
        const result = await toggleSopRunStepAction({
          accountId,
          accountSlug,
          stepStateId: step.id,
          isComplete: nextComplete,
        });

        onUpdated?.({ allDone: Boolean(result?.allDone) });

        if (result?.allDone) {
          router.refresh();
          return;
        }

        if (nextComplete) {
          const remaining = steps
            .map((s) => (s.id === step.id ? { ...s, is_complete: true } : s))
            .filter((s) => !s.is_complete);
          const next = remaining[0];
          if (next) {
            await navigateToStep(next);
          }
        }

        router.refresh();
      } catch (e) {
        setSteps(initialSteps);
        toast.error(
          e instanceof Error ? e.message : 'Could not update checklist',
        );
      }
    });
  }

  const completed = steps.filter((s) => s.is_complete).length;
  const total = steps.length;

  return (
    <div className={cn('space-y-1', compact ? 'p-0' : 'p-1')}>
      <p className="px-1 pb-2 text-xs text-[var(--workspace-shell-text-muted)]">
        {completed} of {total} steps · tap a step to go there
      </p>
      {steps.map((step) => (
        <div
          key={step.id}
          className={cn(
            'flex items-start gap-2 rounded-xl px-2 py-2 transition-colors',
            step.is_complete
              ? 'bg-[var(--ozer-accent-subtle)]/50'
              : 'hover:bg-[var(--workspace-shell-sidebar-accent)]',
          )}
        >
          <Checkbox
            checked={step.is_complete}
            disabled={pending}
            onCheckedChange={(checked) => {
              void toggleStep(step, checked === true);
            }}
            className="mt-0.5"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => {
              void navigateToStep(step);
            }}
          >
            <p
              className={cn(
                'text-sm font-medium text-[var(--workspace-shell-text)]',
                step.is_complete && 'line-through opacity-70',
              )}
            >
              {step.title}
            </p>
            {!step.is_complete ? (
              <p className="mt-0.5 text-[11px] text-[var(--workspace-shell-text-muted)]">
                Open this step
              </p>
            ) : null}
          </button>
          <button
            type="button"
            className="mt-0.5 rounded-md p-1 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
            aria-label={`Go to ${step.title}`}
            onClick={() => {
              void navigateToStep(step);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
