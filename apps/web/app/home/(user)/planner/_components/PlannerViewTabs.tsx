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
        'inline-flex rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-1 text-xs',
        className,
      )}
    >
      <Link
        href={dayHref}
        className={cn(
          'rounded-lg px-3 py-1.5 font-medium transition-colors',
          active === 'day'
            ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
            : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
        )}
      >
        Today
      </Link>
      <Link
        href={planHref}
        className={cn(
          'rounded-lg px-3 py-1.5 font-medium transition-colors',
          active === 'plan'
            ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
            : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
        )}
      >
        Plan
      </Link>
    </div>
  );
}
