'use client';

import Link from 'next/link';

import { Badge } from '@kit/ui/badge';
import { cn } from '@kit/ui/utils';

export type SeatUsageSummaryProps = {
  mode: 'standard' | 'commercial' | 'unlimited';
  /** Members + pending invites (standard) or billable assigned (commercial). */
  used: number;
  max: number | null;
  remaining: number | null;
  /** Commercial extras */
  billableUsed?: number;
  billableMax?: number;
  supportUsed?: number;
  supportMax?: number;
  billingHref?: string | null;
  className?: string;
};

/**
 * Compact seat usage readout for members / invite / admin surfaces.
 */
export function SeatUsageSummary({
  mode,
  used,
  max,
  remaining,
  billableUsed,
  billableMax,
  supportUsed,
  supportMax,
  billingHref,
  className,
}: SeatUsageSummaryProps) {
  const atLimit =
    mode === 'standard'
      ? remaining != null && remaining <= 0
      : mode === 'commercial'
        ? (billableMax != null &&
            billableUsed != null &&
            billableUsed >= billableMax &&
            supportMax != null &&
            supportUsed != null &&
            supportUsed >= supportMax) ||
          (billableMax != null &&
            billableUsed != null &&
            billableUsed >= billableMax &&
            (supportMax ?? 0) === 0)
        : false;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm',
        atLimit
          ? 'border-[color-mix(in_srgb,var(--ozer-coral-500)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-coral-500)_8%,transparent)]'
          : 'border-border bg-muted/30',
        className,
      )}
    >
      {mode === 'unlimited' ? (
        <>
          <Badge variant="outline">Unlimited seats</Badge>
          <span className="text-muted-foreground">
            {used} member{used === 1 ? '' : 's'} (incl. pending invites)
          </span>
        </>
      ) : null}

      {mode === 'standard' && max != null ? (
        <span>
          <span className="font-medium">
            {used} of {max} seats used
          </span>
          <span className="text-muted-foreground">
            {' '}
            · {remaining ?? 0} remaining
          </span>
        </span>
      ) : null}

      {mode === 'commercial' ? (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            <span className="font-medium">Billable</span>{' '}
            <span className="text-muted-foreground">
              {billableUsed ?? 0} of {billableMax ?? '—'}
            </span>
          </span>
          <span>
            <span className="font-medium">Support</span>{' '}
            <span className="text-muted-foreground">
              {supportUsed ?? 0} of {supportMax ?? 0} free
            </span>
          </span>
        </span>
      ) : null}

      {atLimit && billingHref ? (
        <Link
          href={billingHref}
          className="text-[var(--ozer-accent)] underline-offset-2 hover:underline"
        >
          Add seats on billing
        </Link>
      ) : null}
    </div>
  );
}
