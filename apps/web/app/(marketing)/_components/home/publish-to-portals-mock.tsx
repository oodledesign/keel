'use client';

import { useEffect, useState } from 'react';

import { useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { COMMERCIAL_HOME_PUBLISH_PORTALS } from '~/lib/marketing/commercial-home-content';

const STEP_MS = 1100;
const PORTAL_COUNT = COMMERCIAL_HOME_PUBLISH_PORTALS.length;
/** Idle, then one step per portal going live, then a hold before looping. */
const STEPS_PER_LOOP = PORTAL_COUNT + 3;

export function PublishToPortalsMock() {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      const timeout = window.setTimeout(() => setStep(PORTAL_COUNT + 1), 0);

      return () => window.clearTimeout(timeout);
    }

    const interval = window.setInterval(() => {
      setStep((current) => (current + 1) % STEPS_PER_LOOP);
    }, STEP_MS);

    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  const liveCount = Math.min(Math.max(step - 1, 0), PORTAL_COUNT);
  const publishing = step >= 1 && liveCount < PORTAL_COUNT;

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-[color:var(--ozer-border-on-dark-strong)] bg-[var(--ozer-plum-900)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] sm:p-6"
      data-test="publish-to-portals-mock"
    >
      <div className="rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-[0.08em] text-[var(--ozer-text-on-light-muted)] uppercase">
              New disposal
            </p>
            <p className="mt-1 truncate text-base font-semibold text-[var(--ozer-text-on-light)]">
              Unit 4, Riverside Park
            </p>
            <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
              2,450 sq ft · Industrial · To let
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-300',
              liveCount === PORTAL_COUNT
                ? 'bg-[var(--ozer-sage-100)] text-[var(--ozer-plum-700)]'
                : 'bg-[var(--ozer-accent)] text-[var(--ozer-plum-950)]',
            )}
          >
            {liveCount === PORTAL_COUNT
              ? 'Published'
              : publishing
                ? 'Publishing…'
                : 'Publish'}
          </span>
        </div>

        <ul className="mt-4 space-y-2" aria-label="Portal status">
          {COMMERCIAL_HOME_PUBLISH_PORTALS.map((portal, index) => {
            const isLive = index < liveCount;

            return (
              <li
                key={portal.name}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-300',
                  isLive
                    ? 'border-[color:var(--ozer-sage-300)] bg-[var(--ozer-white)]'
                    : 'border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-white)]/60',
                )}
              >
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full transition-colors duration-300',
                    isLive
                      ? 'bg-[var(--ozer-sage-500)]'
                      : 'bg-[var(--ozer-text-on-light-muted)]/40',
                  )}
                  aria-hidden
                />
                <span className="flex-1 text-sm font-medium text-[var(--ozer-text-on-light)]">
                  {portal.name}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-[0.03em] uppercase transition-colors duration-300',
                    isLive
                      ? 'bg-[var(--ozer-sage-100)] text-[var(--ozer-plum-700)]'
                      : 'bg-[var(--ozer-plum-alpha-08)] text-[var(--ozer-text-on-light-muted)]',
                  )}
                >
                  {isLive ? (
                    <>
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                      Live
                    </>
                  ) : (
                    'Queued'
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-4 text-center text-xs text-[var(--ozer-text-on-dark-muted)]">
        Typed in once. Live everywhere — included from seat 1.
      </p>
    </div>
  );
}
