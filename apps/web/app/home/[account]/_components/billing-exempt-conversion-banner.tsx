'use client';

import { useCallback, useState } from 'react';

import Link from 'next/link';

import { CreditCard, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

function storageKey(accountId: string) {
  return `ozer:billing-exempt-banner-dismissed:${accountId}`;
}

function readDismissed(accountId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(storageKey(accountId)) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(accountId: string) {
  try {
    sessionStorage.setItem(storageKey(accountId), '1');
  } catch {
    // ignore
  }
}

export type BillingExemptConversionBannerProps = {
  accountId: string;
  billingPath: string;
};

/**
 * Soft prompt for billing-exempt workspaces without a paid subscription.
 * Does not block access — owners/admins can start a paid plan (promo codes at checkout).
 */
export function BillingExemptConversionBanner({
  accountId,
  billingPath,
}: BillingExemptConversionBannerProps) {
  const [dismissed, setDismissed] = useState(() => readDismissed(accountId));

  const onDismiss = useCallback(() => {
    writeDismissed(accountId);
    setDismissed(true);
  }, [accountId]);

  if (dismissed) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Start a paid plan"
      className={cn('mx-auto w-full max-w-[1600px] px-4 pt-3 sm:px-6')}
    >
      <div className="flex flex-col gap-3 rounded-xl border border-[color-mix(in_srgb,var(--ozer-coral-500)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-coral-500)_10%,var(--workspace-shell-panel))] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Complimentary access — start your plan when ready
          </p>
          <p className="text-sm leading-relaxed text-[var(--workspace-shell-text-muted)]">
            This workspace is on temporary complimentary access. Choose a paid
            plan on billing — enter your promo code at checkout if you have one.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pl-4">
          <Button asChild size="sm" className="ozer-gradient-btn rounded-lg">
            <Link href={`${billingPath}?billing=1`}>
              <CreditCard className="mr-2 h-4 w-4" aria-hidden />
              View billing
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-[var(--workspace-shell-text-muted)]"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
