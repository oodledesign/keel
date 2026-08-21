'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import type { Driver } from 'driver.js';
import { Check, ListChecks, X } from 'lucide-react';

import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import '~/components/product-tour/product-tour.css';
import { useOptionalPlatformSupportMessenger } from '~/components/workspace-shell/platform-support-messenger-context';
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
import {
  listingIdFromPathname,
  resolveSopTargetRoute,
  sopRunListingId,
} from '~/lib/sops/shared';

import {
  bindSopRunListingAction,
  toggleSopRunStepAction,
} from '../_lib/server/sops-actions';
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
  const pathname = usePathname();
  const messenger = useOptionalPlatformSupportMessenger();
  const [hidden, setHidden] = useState(() =>
    isSopTrackerHidden(accountId, run.id),
  );
  const [completedFlash, setCompletedFlash] = useState(false);
  const [steps, setSteps] = useState(initialSteps);
  const [listingId, setListingId] = useState<string | null>(
    () => sopRunListingId(run) ?? listingIdFromPathname(pathname),
  );
  const [, startTransition] = useTransition();
  const driverRef = useRef<Driver | null>(null);
  const lastHighlightRef = useRef<string | null>(null);

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

  function stepNeedsListing(step: SopRunStepRow) {
    const pb = step.playbook_step_id
      ? playbookById.get(step.playbook_step_id)
      : undefined;
    return Boolean(pb?.target_route?.includes('[id]'));
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
    }, 450);

    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- highlight on assist entry / step change
  }, [run.id, hidden, enableAssistTour, steps, pathname, listingId]);

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

  // When a new disposal is created during assist, listings-list dispatches this.
  useEffect(() => {
    function onListingBound(event: Event) {
      const detail = (event as CustomEvent<{ listingId?: string }>).detail;
      if (!detail?.listingId) return;
      setListingId(detail.listingId);

      const createStep = steps.find((s) => {
        const pb = s.playbook_step_id
          ? playbookById.get(s.playbook_step_id)
          : undefined;
        return !pb?.target_route?.includes('[id]');
      });

      if (createStep && !createStep.is_complete) {
        void toggleStep(createStep, true, { fromTour: true });
      }
    }

    window.addEventListener('sop-assist-listing-bound', onListingBound);
    return () => {
      window.removeEventListener('sop-assist-listing-bound', onListingBound);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, playbookById]);

  function openGuides() {
    setSopTrackerVisible(accountId, run.id, true);
    setHidden(false);
    messenger?.openMessenger({
      view: 'guides',
      accountId,
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
            Guide complete
          </p>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
            {run.title}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-4 bottom-[5.25rem] z-[65] hidden items-center gap-2 lg:flex">
      <button
        type="button"
        onClick={openGuides}
        className={cn(
          'group flex max-w-[14rem] items-center gap-2 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] py-1.5 pr-3 pl-1.5 text-left shadow-[0_2px_8px_rgba(42,23,32,0.06),0_8px_24px_rgba(42,23,32,0.08)] transition-colors hover:border-[var(--ozer-accent)]/40 hover:bg-[var(--ozer-accent-subtle)]',
        )}
        aria-label={`Open guide: ${run.title}`}
        title="Open guide checklist"
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--ozer-accent)]">
          <span
            className="absolute inset-0 rounded-full opacity-90"
            style={{
              background: ring,
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
              WebkitMask:
                'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
            }}
          />
          <ListChecks className="relative h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-[var(--workspace-shell-text)]">
            {run.title}
          </span>
          <span className="block text-[11px] text-[var(--workspace-shell-text-muted)]">
            {completed}/{total} · Open guides
          </span>
        </span>
      </button>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text-muted)] shadow-sm transition-colors hover:text-[var(--workspace-shell-text)]"
        aria-label="Hide guide chip"
        title="Hide for this session — reopen from Help → Guides"
        onClick={() => {
          setSopTrackerVisible(accountId, run.id, false);
          setHidden(true);
          destroyTour();
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Called from disposal create flow during an active assist run. */
export async function bindListingToActiveSopAssist(input: {
  accountId: string;
  accountSlug: string;
  runId: string;
  listingId: string;
}) {
  await bindSopRunListingAction(input);
  window.dispatchEvent(
    new CustomEvent('sop-assist-listing-bound', {
      detail: { listingId: input.listingId },
    }),
  );
}
