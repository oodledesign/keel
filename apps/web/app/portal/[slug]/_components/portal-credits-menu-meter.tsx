'use client';

import Link from 'next/link';

import { cn } from '@kit/ui/utils';

export function PortalCreditsMenuMeter({
  balance,
  creditsPerCycle,
  creditsHref,
}: {
  balance: number;
  creditsPerCycle: number | null;
  creditsHref: string;
}) {
  const capacity = Math.max(creditsPerCycle ?? 0, balance, 0);
  const percentLeft =
    capacity > 0
      ? Math.max(0, Math.min(100, (balance / capacity) * 100))
      : balance === 0
        ? 0
        : 100;
  const low = balance === 0 || (capacity > 0 && balance / capacity < 0.1);

  return (
    <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-2.5">
      <Link
        href={creditsHref}
        className="block rounded-lg py-0.5 transition-colors outline-none hover:bg-[var(--workspace-shell-sidebar-accent)] focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)]/40"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="shrink-0 text-xs font-medium text-[var(--workspace-shell-text-muted)]">
            Credits
          </span>
          <span
            className={cn(
              'min-w-0 truncate text-right text-xs tabular-nums',
              low
                ? 'font-semibold text-[var(--ozer-accent)]'
                : 'text-[var(--workspace-shell-text)]',
            )}
          >
            {balance}
            {creditsPerCycle != null ? (
              <span className="text-[var(--workspace-shell-text-muted)]">
                {' '}
                / {creditsPerCycle}
              </span>
            ) : null}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--workspace-shell-sidebar-accent)]">
          <div
            className={cn(
              'h-full rounded-full transition-[width]',
              low ? 'bg-[var(--ozer-accent)]' : 'bg-[var(--ozer-info)]',
            )}
            style={{ width: `${percentLeft}%` }}
          />
        </div>
      </Link>
    </div>
  );
}
