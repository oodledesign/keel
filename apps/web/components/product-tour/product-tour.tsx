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
import { useOptionalPlatformSupportMessenger } from '~/components/workspace-shell/platform-support-messenger-context';
import pathsConfig from '~/config/paths.config';
import { saveDefaultLandingAction } from '~/lib/dashboard-shortcuts/dashboard-shortcuts.actions';
import {
  markProductTourCompletedAction,
  resetProductTourAction,
} from '~/lib/product-tour/product-tour.actions';
import {
  type TourChromeAction,
  getProductTourStepDefs,
} from '~/lib/product-tour/tour-steps';
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

function setTourChromeOpen(active: boolean) {
  document.body.classList.toggle('ozer-tour-chrome-open', active);
}

function setTourNavOpen(active: boolean) {
  document.body.classList.toggle('ozer-tour-nav-open', active);
}

function clickTourTarget(root: Element | undefined | null) {
  if (!root) return;
  const clickable =
    root instanceof HTMLElement &&
    (root.matches('button, a, [role="button"]')
      ? root
      : root.querySelector<HTMLElement>('button, a, [role="button"]'));
  clickable?.click();
}

function closeChromeUi(action: TourChromeAction | null) {
  if (!action) return;

  if (action === 'open-support') {
    // closed by caller via messenger
    return;
  }

  const selector =
    action === 'open-workspace-switcher'
      ? '[data-tour="workspace-switcher"]'
      : action === 'open-new-menu'
        ? '[data-tour="new-menu"]'
        : '[data-tour="profile-menu"]';

  // Toggle the same control closed (avoid Escape — driver.js treats it as cancel).
  clickTourTarget(document.querySelector(selector));
}

function isMobileNavOpen() {
  const menu = document.querySelector<HTMLElement>('[data-mobile-nav="menu"]');
  if (!menu) return false;
  return menu.getAttribute('aria-hidden') === 'false';
}

async function ensureNavigationVisible() {
  // Mobile: open the full-screen menu so nav tour targets exist in the DOM.
  if (!isMobileNavOpen()) {
    const mobileTrigger = document.querySelector<HTMLButtonElement>(
      '[data-tour="mobile-nav-trigger"]',
    );
    if (mobileTrigger) {
      mobileTrigger.click();
      setTourNavOpen(true);
      await new Promise((r) => setTimeout(r, 320));
      return;
    }
  } else {
    setTourNavOpen(true);
    return;
  }

  // Desktop: expand the sidebar if it is collapsed/hidden.
  const trigger = document.querySelector<HTMLButtonElement>(
    '[data-sidebar="trigger"]',
  );
  const sidebar = document.querySelector('[data-tour="sidebar"]');
  if (trigger && sidebar && getComputedStyle(sidebar).display === 'none') {
    trigger.click();
    await new Promise((r) => setTimeout(r, 250));
  }
}

function closeMobileNavIfOpen() {
  setTourNavOpen(false);
  if (!isMobileNavOpen()) return;
  const closeButton = document.querySelector<HTMLButtonElement>(
    '[data-mobile-nav="menu"] button[aria-label="Close menu"]',
  );
  closeButton?.click();
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Bottom-bar New FAB is unmounted while the hamburger menu is open. */
async function ensureNewMenuVisible() {
  if (!isMobileNavOpen()) return;
  closeMobileNavIfOpen();
  await wait(350);
}

export function ProductTour({
  tourId,
  autoStart,
  forceStart = false,
  showDefaultLandingPrompt,
  workspaceOptions,
  preferredWorkspaceSlug,
}: ProductTourProps) {
  const startedRef = useRef(false);
  const messenger = useOptionalPlatformSupportMessenger();
  const messengerRef = useRef(messenger);
  messengerRef.current = messenger;

  const [landingOpen, setLandingOpen] = useState(
    () => !autoStart && !forceStart && showDefaultLandingPrompt,
  );
  const [selected, setSelected] = useState<string>(
    preferredWorkspaceSlug ? `workspace:${preferredWorkspaceSlug}` : 'personal',
  );
  const [pending, startTransition] = useTransition();

  // After the tour is marked complete, layout revalidation remounts this
  // component with autoStart=false — reopen the landing prompt so it isn't lost.
  useEffect(() => {
    if (autoStart || forceStart) return;
    if (!showDefaultLandingPrompt) return;
    setLandingOpen(true);
  }, [autoStart, forceStart, showDefaultLandingPrompt]);

  useEffect(() => {
    // Driver.js needs DOM access after mount — intentional client-only init.
    if (!autoStart && !forceStart) return;
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    let skipMarkOnDestroy = false;
    let driverObj: Driver | null = null;
    let activeChromeAction: TourChromeAction | null = null;

    const clearChrome = () => {
      setTourChromeOpen(false);
      if (activeChromeAction === 'open-support') {
        messengerRef.current?.setOpen(false);
      } else {
        closeChromeUi(activeChromeAction);
      }
      activeChromeAction = null;
    };

    const runChromeAction = (
      action: TourChromeAction | undefined,
      element: Element | undefined,
    ) => {
      clearChrome();
      if (!action) return;

      activeChromeAction = action;
      setTourChromeOpen(true);

      if (action === 'open-support') {
        messengerRef.current?.openMessenger({ view: 'home' });
        return;
      }

      // Wait a frame so driver.js can finish positioning before we open menus.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => clickTourTarget(element));
      });
    };

    const run = async () => {
      const { driver } = await import('driver.js');
      if (cancelled) return;

      // Open mobile menu / expand sidebar so nav targets exist for later steps.
      await ensureNavigationVisible();
      if (cancelled) return;

      const stepDefs = getProductTourStepDefs(tourId);
      if (stepDefs.length === 0) {
        await markProductTourCompletedAction({ tourId });
        if (showDefaultLandingPrompt) setLandingOpen(true);
        return;
      }

      let marked = false;
      const markDone = async () => {
        if (marked) return;
        marked = true;
        // Open landing before marking complete so a remount can still show it.
        if (showDefaultLandingPrompt) {
          setLandingOpen(true);
        }
        try {
          await markProductTourCompletedAction({ tourId });
        } catch {
          // Non-blocking — tour UX should still finish.
        }
      };

      const steps = stepDefs.map((def) => {
        if (!def.element) {
          return {
            popover: {
              title: def.title,
              description: def.description,
            },
          };
        }

        const needsNav =
          def.element === '[data-tour="sidebar"]' ||
          def.element.startsWith('[data-tour="nav-');
        const opensNewMenu = def.chromeAction === 'open-new-menu';
        // Closing the hamburger before Next so the New FAB exists when the
        // next step queries `[data-tour="new-menu"]` (skipMissingElement).
        const preparesNewMenu = def.chromeAction === 'open-workspace-switcher';

        return {
          element: def.element,
          popover: {
            title: def.title,
            description: def.description,
            side: def.side ?? ('right' as const),
            align: def.align ?? ('start' as const),
            ...(preparesNewMenu
              ? {
                  onNextClick: (
                    _element: Element | undefined,
                    _step: unknown,
                    { driver: activeDriver }: { driver: Driver },
                  ) => {
                    clearChrome();
                    void ensureNewMenuVisible().then(() => {
                      activeDriver.moveNext();
                    });
                  },
                }
              : {}),
            ...(opensNewMenu
              ? {
                  onPrevClick: (
                    _element: Element | undefined,
                    _step: unknown,
                    { driver: activeDriver }: { driver: Driver },
                  ) => {
                    clearChrome();
                    void ensureNavigationVisible().then(() => {
                      activeDriver.movePrevious();
                    });
                  },
                }
              : {}),
          },
          onHighlightStarted: (element?: Element) => {
            if (needsNav) {
              void ensureNavigationVisible();
            }
            if (opensNewMenu) {
              void ensureNewMenuVisible().then(() => {
                const target =
                  document.querySelector('[data-tour="new-menu"]') ??
                  element ??
                  undefined;
                runChromeAction(def.chromeAction, target);
              });
              return;
            }
            runChromeAction(def.chromeAction, element);
          },
          onDeselected: () => {
            clearChrome();
          },
        };
      });

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
          clearChrome();
          closeMobileNavIfOpen();
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
      clearChrome();
      setTourNavOpen(false);
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
      <DialogContent className="z-[10050] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
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
            // Also allow the default-landing prompt to show again after a replay.
            try {
              await resetProductTourAction({
                tourId: 'default_landing_prompt',
              });
            } catch {
              // ignore — prompt may already be unset
            }
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
