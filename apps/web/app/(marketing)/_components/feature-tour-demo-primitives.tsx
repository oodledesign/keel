'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

import { type Transition, motion, useReducedMotion } from 'framer-motion';

import { cn } from '@kit/ui/utils';

import { marketingHeroEase } from '~/lib/marketing/marketing-ui';

export const FEATURE_DEMO_FRAME_CLASS =
  'relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_12px_40px_var(--ozer-plum-alpha-08)]';

export const FEATURE_DEMO_SHELL_CLASS = 'flex min-h-0 w-full overflow-hidden';

const LOOP_EASE = marketingHeroEase;

function useContainerSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const update = () => {
      setSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function percentToPx(value: string, axis: number) {
  return (parseFloat(value) / 100) * axis;
}

export function DemoFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(FEATURE_DEMO_FRAME_CLASS, className)}>
      <div className="flex shrink-0 items-center gap-1.5 border-b border-[color:var(--workspace-shell-border)] px-4 py-2.5">
        <span
          className="size-2 rounded-full bg-[var(--ozer-coral-500)]/70"
          aria-hidden
        />
        <span
          className="size-2 rounded-full bg-[var(--workspace-shell-text-muted)]/35"
          aria-hidden
        />
        <span
          className="size-2 rounded-full bg-[var(--workspace-shell-text-muted)]/35"
          aria-hidden
        />
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col p-4 md:p-5">
        {children}
      </div>
    </div>
  );
}

type DemoCursorProps = {
  x: string[];
  y: string[];
  duration?: number;
  times?: number[];
  clickAt?: number[];
  className?: string;
};

export function DemoCursor({
  x,
  y,
  duration = 5,
  times,
  clickAt = [],
  className,
}: DemoCursorProps) {
  const reduced = useReducedMotion();
  const areaRef = useRef<HTMLDivElement>(null);
  const { width, height } = useContainerSize(areaRef);

  if (reduced) {
    return null;
  }

  const scaleKeyframes = x.map((_, index) => {
    const t = times?.[index] ?? index / Math.max(x.length - 1, 1);

    return clickAt.some((click) => Math.abs(click - t) < 0.06) ? 0.82 : 1;
  });

  const transition: Transition = {
    duration,
    repeat: Infinity,
    ease: LOOP_EASE,
    ...(times ? { times } : {}),
  };

  const xPx = width > 0 ? x.map((value) => percentToPx(value, width)) : [0];
  const yPx = height > 0 ? y.map((value) => percentToPx(value, height)) : [0];

  return (
    <>
      <div
        ref={areaRef}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      />
      <motion.div
        className={cn(
          'pointer-events-none absolute top-0 left-0 z-30',
          className,
        )}
        aria-hidden
        animate={{ x: xPx, y: yPx }}
        transition={transition}
      >
        <motion.div
          animate={{ scale: scaleKeyframes }}
          transition={transition}
          className="relative -translate-x-0.5 -translate-y-0.5"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
          >
            <path
              d="M3 2.5L3 15.5L7.2 11.8L10.2 17.5L12.4 16.4L9.4 10.7L14.5 10.7L3 2.5Z"
              fill="var(--ozer-cream-50)"
              stroke="var(--ozer-plum-900)"
              strokeWidth="1.25"
              strokeLinejoin="round"
            />
          </svg>
          <motion.span
            className="absolute top-3 left-3 size-5 rounded-full border-2 border-[var(--ozer-accent)]"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.4, 0], opacity: [0, 0.55, 0] }}
            transition={{
              duration: 0.45,
              repeat: Infinity,
              repeatDelay: duration - 0.45,
              ease: 'easeOut',
            }}
          />
        </motion.div>
      </motion.div>
    </>
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
