'use client';

import Link from 'next/link';

import { cn } from '@kit/ui/utils';

type Props = {
  dayHref: string;
  planHref: string;
  active: 'day' | 'plan';
  className?: string;
};

export function PlannerViewTabs({ dayHref, planHref, active, className }: Props) {
  return (
    <div
      className={cn(
        'inline-flex rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] p-1 text-xs',
        className,
      )}
    >
      <Link
        href={dayHref}
        className={cn(
          'rounded-lg px-3 py-1.5 font-medium transition-colors',
          active === 'day'
            ? 'bg-white/10 text-white'
            : 'text-zinc-400 hover:text-white',
        )}
      >
        Today
      </Link>
      <Link
        href={planHref}
        className={cn(
          'rounded-lg px-3 py-1.5 font-medium transition-colors',
          active === 'plan'
            ? 'bg-white/10 text-white'
            : 'text-zinc-400 hover:text-white',
        )}
      >
        Plan
      </Link>
    </div>
  );
}
