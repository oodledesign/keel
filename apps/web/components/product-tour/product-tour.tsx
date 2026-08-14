'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import type { Driver } from 'driver.js';
import 'driver.js/dist/driver.css';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';

import '~/components/product-tour/product-tour.css';
import pathsConfig from '~/config/paths.config';
import { saveDefaultLandingAction } from '~/lib/dashboard-shortcuts/dashboard-shortcuts.actions';
import {
  markProductTourCompletedAction,
  resetProductTourAction,
} from '~/lib/product-tour/product-tour.actions';
import { getProductTourSteps } from '~/lib/product-tour/tour-steps';
import type { DriveableProductTourId } from '~/lib/product-tour/types';

type WorkspaceOption = { slug: string; name: string };

type ProductTourProps = {
  tourId: DriveableProductTourId;
  autoStart: boolean;
  forceStart?: boolean;
  showDefaultLandingPrompt: boolean;
  workspaceOptions: WorkspaceOption[];
  preferredWorkspaceSlug?: string | null;
};

export function ProductTour({
  tourId,
  autoStart,
  forceStart = false,
  showDefaultLandingPrompt,
  workspaceOptions,
  preferredWorkspaceSlug,
}: ProductTourProps) {
  const startedRef = useRef(false);
  const [landingOpen, setLandingOpen] = useState(false);
  const [selected, setSelected] = useState<string>(
    preferredWorkspaceSlug ? `workspace:${preferredWorkspaceSlug}` : 'personal',
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Driver.js needs DOM access after mount — intentional client-only init.
    if (!autoStart && !forceStart) return;
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    let skipMarkOnDestroy = false;
    let driverObj: Driver | null = null;

    const run = async () => {
      const { driver } = await import('driver.js');
      if (cancelled) return;

      // Expand mobile sidebar if needed so targets exist.
      const trigger = document.querySelector<HTMLButtonElement>(
        '[data-sidebar="trigger"]',
      );
      const sidebar = document.querySelector('[data-tour="sidebar"]');
      if (trigger && sidebar && getComputedStyle(sidebar).display === 'none') {
        trigger.click();
        await new Promise((r) => setTimeout(r, 250));
      }

      const steps = getProductTourSteps(tourId);
      if (steps.length === 0) {
        await markProductTourCompletedAction({ tourId });
        if (showDefaultLandingPrompt) setLandingOpen(true);
        return;
      }

      let marked = false;
      const markDone = async () => {
        if (marked) return;
        marked = true;
        try {
          await markProductTourCompletedAction({ tourId });
        } catch {
          // Non-blocking — tour UX should still finish.
        }
        if (showDefaultLandingPrompt) {
          setLandingOpen(true);
        }
      };

      driverObj = driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        skipMissingElement: true,
        overlayOpacity: 0.55,
        stagePadding: 8,
        stageRadius: 10,
        popoverClass: 'ozer-driver-popover',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Done',
        steps,
        onDestroyStarted: (_el, _step, { driver: activeDriver }) => {
          if (!skipMarkOnDestroy) {
            void markDone();
          }
          activeDriver.destroy();
        },
      });

      driverObj.drive();
    };

    void run();

    return () => {
      cancelled = true;
      skipMarkOnDestroy = true;
      startedRef.current = false;
      driverObj?.destroy();
    };
  }, [autoStart, forceStart, showDefaultLandingPrompt, tourId]);

  const saveLanding = () => {
    startTransition(async () => {
      const isPersonal = selected === 'personal';
      const slug = selected.startsWith('workspace:')
        ? selected.slice('workspace:'.length)
        : null;

      const result = await saveDefaultLandingAction({
        type: isPersonal ? 'personal' : 'workspace',
        workspaceSlug: slug,
      });

      if (!result.success) {
        toast.error(result.error ?? 'Could not save default landing');
        return;
      }

      try {
        await markProductTourCompletedAction({
          tourId: 'default_landing_prompt',
        });
      } catch {
        // ignore
      }

      toast.success('Default landing saved');
      setLandingOpen(false);
    });
  };

  const dismissLanding = () => {
    startTransition(async () => {
      try {
        await markProductTourCompletedAction({
          tourId: 'default_landing_prompt',
        });
      } catch {
        // ignore
      }
      setLandingOpen(false);
    });
  };

  return (
    <Dialog
      open={landingOpen}
      onOpenChange={(open) => !open && dismissLanding()}
    >
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Where should Ozer open next time?</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            Choose your default after sign-in. You can change this later in
            Settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2.5 has-[:checked]:border-[color:var(--ozer-accent)]">
            <input
              type="radio"
              name="default-landing"
              className="accent-[var(--ozer-accent)]"
              checked={selected === 'personal'}
              onChange={() => setSelected('personal')}
            />
            <span className="text-sm">Personal home</span>
          </label>

          {workspaceOptions.map((ws) => {
            const value = `workspace:${ws.slug}`;
            return (
              <label
                key={ws.slug}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2.5 has-[:checked]:border-[color:var(--ozer-accent)]"
              >
                <input
                  type="radio"
                  name="default-landing"
                  className="accent-[var(--ozer-accent)]"
                  checked={selected === value}
                  onChange={() => setSelected(value)}
                />
                <span className="text-sm">{ws.name}</span>
              </label>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            data-test="tour-landing-dismiss"
            onClick={dismissLanding}
          >
            Not now
          </Button>
          <Button
            type="button"
            disabled={pending}
            data-test="tour-landing-save"
            onClick={saveLanding}
            className="bg-[var(--ozer-accent)] text-white hover:bg-[var(--ozer-accent-hover)]"
          >
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ReplayProductTourButtonProps = {
  tourId: DriveableProductTourId;
  accountSlug?: string | null;
};

export function ReplayProductTourButton({
  tourId,
  accountSlug,
}: ReplayProductTourButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      data-test="tour-replay-button"
      onClick={() => {
        startTransition(async () => {
          try {
            await resetProductTourAction({ tourId });
            // Land on the matching home so ProductTourHost auto-starts.
            const href = accountSlug
              ? pathsConfig.app.accountHome.replace('[account]', accountSlug)
              : pathsConfig.app.home;
            window.location.assign(href);
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : 'Could not restart tour',
            );
          }
        });
      }}
    >
      {pending ? 'Starting…' : 'Take a quick tour'}
    </Button>
  );
}
