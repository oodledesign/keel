'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import type { Driver } from 'driver.js';
import { Check, ListChecks, Minimize2, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import '~/components/product-tour/product-tour.css';
import pathsConfig from '~/config/paths.config';
import {
  type SopAssistTourStep,
  highlightSopAssistStep,
} from '~/lib/sops/assist-tour';
import type {
  SopPlaybookStepRow,
  SopRunRow,
  SopRunStepRow,
} from '~/lib/sops/shared';
import { resolveSopTargetRoute } from '~/lib/sops/shared';

import { toggleSopRunStepAction } from '../_lib/server/sops-actions';
import {
  isSopTrackerHidden,
  setSopTrackerVisible,
} from '../_lib/sop-tracker-session';

type SopTrackerWidgetProps = {
  accountId: string;
  accountSlug: string;
  run: SopRunRow;
  steps: SopRunStepRow[];
  playbookSteps: SopPlaybookStepRow[];
  /** When true, drive assist highlights for the current page. */
  enableAssistTour?: boolean;
};

export function SopTrackerWidget({
  accountId,
  accountSlug,
  run,
  steps: initialSteps,
  playbookSteps,
  enableAssistTour = true,
}: SopTrackerWidgetProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(() =>
    isSopTrackerHidden(accountId, run.id),
  );
  const [completedFlash, setCompletedFlash] = useState(false);
  const [steps, setSteps] = useState(initialSteps);
  const [pending, startTransition] = useTransition();
  const driverRef = useRef<Driver | null>(null);
  const lastHighlightRef = useRef<string | null>(null);

  useEffect(() => {
    setSteps(initialSteps);
  }, [initialSteps]);

  const playbookById = useMemo(() => {
    const map = new Map<string, SopPlaybookStepRow>();
    for (const step of playbookSteps) {
      map.set(step.id, step);
    }
    return map;
  }, [playbookSteps]);

  const completed = steps.filter((s) => s.is_complete).length;
  const total = steps.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const ring = `conic-gradient(var(--ozer-accent) ${pct}%, color-mix(in srgb, var(--workspace-shell-border) 80%, transparent) 0)`;

  function destroyTour() {
    driverRef.current?.destroy();
    driverRef.current = null;
    lastHighlightRef.current = null;
  }

  useEffect(() => {
    return () => {
      destroyTour();
    };
  }, []);

  function toTourStep(step: SopRunStepRow): SopAssistTourStep {
    const pb = step.playbook_step_id
      ? playbookById.get(step.playbook_step_id)
      : undefined;
    return {
      element: pb?.target_selector ?? undefined,
      title: step.title,
      description: step.body_md ?? '',
    };
  }

  async function highlightStep(step: SopRunStepRow) {
    if (!enableAssistTour) return;
    const pb = step.playbook_step_id
      ? playbookById.get(step.playbook_step_id)
      : undefined;
    if (!pb?.target_selector) return;

    if (lastHighlightRef.current === step.id && driverRef.current) {
      return;
    }

    destroyTour();
    lastHighlightRef.current = step.id;
    driverRef.current = await highlightSopAssistStep({
      step: toTourStep(step),
      onDone: () => {
        if (!step.is_complete) {
          void toggleStep(step, true, { fromTour: true });
        }
      },
    });
  }

  async function navigateToStep(step: SopRunStepRow) {
    const pb = step.playbook_step_id
      ? playbookById.get(step.playbook_step_id)
      : undefined;
    const target =
      resolveSopTargetRoute(pb?.target_route, accountSlug) ??
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

    await highlightStep(step);
  }

  useEffect(() => {
    if (typeof window === 'undefined' || hidden || !enableAssistTour) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('sopAssist') !== run.id) return;

    const stepId = params.get('sopStep');
    const targetStep =
      (stepId ? steps.find((s) => s.id === stepId) : null) ??
      steps.find((s) => !s.is_complete) ??
      steps[0];

    if (!targetStep) return;

    const timer = window.setTimeout(() => {
      void highlightStep(targetStep);
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- highlight on assist entry only
  }, [run.id, hidden, enableAssistTour, steps]);

  function toggleStep(
    step: SopRunStepRow,
    nextComplete: boolean,
    opts?: { fromTour?: boolean },
  ) {
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

        if (result?.allDone) {
          setCompletedFlash(true);
          destroyTour();
          window.setTimeout(() => {
            setHidden(true);
            router.refresh();
          }, 1800);
        } else if (nextComplete && !opts?.fromTour) {
          const remaining = steps
            .map((s) => (s.id === step.id ? { ...s, is_complete: true } : s))
            .filter((s) => !s.is_complete);
          const next = remaining[0];
          if (next) {
            await highlightStep(next);
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

  if (hidden && !completedFlash) {
    return null;
  }

  if (completedFlash) {
    return (
      <div className="fixed right-4 bottom-[5.25rem] z-[65] hidden lg:block">
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-3 text-sm shadow-[0_2px_8px_rgba(42,23,32,0.06),0_8px_24px_rgba(42,23,32,0.08)]">
          <p className="flex items-center gap-2 font-medium text-[var(--workspace-shell-text)]">
            <Check className="h-4 w-4 text-[var(--ozer-accent)]" />
            SOP complete
          </p>
          <p className="text-muted-foreground mt-1 text-xs">{run.title}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-4 bottom-[5.25rem] z-[65] hidden flex-col items-end gap-2 lg:flex">
      {expanded ? (
        <div
          className={cn(
            'w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_2px_8px_rgba(42,23,32,0.06),0_8px_24px_rgba(42,23,32,0.08)]',
          )}
        >
          <div className="flex items-start justify-between gap-2 border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--workspace-shell-text)]">
                {run.title}
              </p>
              <p className="text-muted-foreground text-xs">
                {completed} of {total} steps complete
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setExpanded(false)}
                aria-label="Minimise checklist"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  setSopTrackerVisible(accountId, run.id, false);
                  setHidden(true);
                  destroyTour();
                }}
                aria-label="Close checklist"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="max-h-[min(60vh,24rem)] space-y-1 overflow-y-auto p-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-start gap-3 rounded-xl px-2 py-2',
                  step.is_complete && 'bg-[var(--ozer-accent-subtle)]/50',
                )}
              >
                <Checkbox
                  checked={step.is_complete}
                  disabled={pending}
                  onCheckedChange={(checked) => {
                    void toggleStep(step, checked === true);
                  }}
                  className="mt-0.5"
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
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'relative flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--ozer-accent)] shadow-[0_2px_8px_rgba(42,23,32,0.06),0_8px_24px_rgba(42,23,32,0.08)] transition-colors hover:border-[var(--ozer-accent)]/40 hover:bg-[var(--ozer-accent-subtle)]',
        )}
        aria-label={expanded ? 'Collapse SOP checklist' : 'Open SOP checklist'}
        aria-expanded={expanded}
        title="SOP checklist"
      >
        <span
          className="absolute inset-0 rounded-full opacity-90"
          style={{
            background: ring,
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
            WebkitMask:
              'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
          }}
        />
        <ListChecks className="relative h-5 w-5" />
        {completed < total ? (
          <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-[var(--ozer-accent)]" />
        ) : null}
      </button>
    </div>
  );
}
