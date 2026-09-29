'use client';

import { type ReactNode } from 'react';

import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@kit/ui/utils';

import { marketingHeroEase } from '~/lib/marketing/marketing-ui';

export const FEATURE_DEMO_FRAME_CLASS =
  'relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[var(--ozer-radius-media)] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

export const FEATURE_DEMO_SHELL_CLASS = 'flex min-h-0 w-full overflow-hidden';

const LOOP_EASE = marketingHeroEase;

export function DemoFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(FEATURE_DEMO_FRAME_CLASS, className)}>
      <div className="relative flex min-h-0 flex-1 flex-col p-4 md:p-5">
        {children}
      </div>
    </div>
  );
}

export function DemoHighlight({
  className,
  delay = 0,
  duration = 5.5,
  times = [0, 0.3, 0.4, 0.75, 1],
}: {
  className?: string;
  delay?: number;
  duration?: number;
  times?: number[];
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <span
        className={cn(
          'pointer-events-none absolute inset-0 rounded-[inherit] bg-[var(--workspace-shell-canvas)]',
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    <motion.span
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit] bg-[var(--workspace-shell-canvas)]',
        className,
      )}
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0, 1, 1, 0] }}
      transition={{
        duration,
        repeat: Infinity,
        times,
        delay,
        ease: LOOP_EASE,
      }}
    />
  );
}

export function DemoPulse({
  className,
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <span
        className={cn(
          'pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-[var(--ozer-accent)]/40',
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    <motion.span
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-[var(--ozer-accent)]',
        className,
      )}
      aria-hidden
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: [0, 0.65, 0], scale: [0.98, 1, 1.01] }}
      transition={{
        duration: 1.2,
        repeat: Infinity,
        repeatDelay: 2.8,
        delay,
        ease: 'easeOut',
      }}
    />
  );
}
