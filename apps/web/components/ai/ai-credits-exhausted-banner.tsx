'use client';

import Link from 'next/link';

import { AlertTriangle, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

export function AiCreditsExhaustedBanner({
  billingHref,
  creditsRemaining,
  creditsRequired,
  onDismiss,
}: {
  billingHref: string;
  creditsRemaining?: number;
  creditsRequired?: number;
  onDismiss: () => void;
}) {
  const detail =
    typeof creditsRequired === 'number' && typeof creditsRemaining === 'number'
      ? ` Need ${creditsRequired}, have ${creditsRemaining}.`
      : '';

  return (
    <div
      role="status"
      aria-label="Out of AI credits"
      className="mx-auto w-full max-w-[1600px] px-4 pt-3 sm:px-6"
    >
      <div
        className={cn(
          'flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
          'border-[color-mix(in_srgb,var(--ozer-coral-500)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-coral-500)_10%,var(--workspace-shell-panel))]',
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ozer-accent)]"
            aria-hidden
          />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              You&apos;re out of AI credits
            </p>
            <p className="text-sm leading-relaxed text-[var(--workspace-shell-text-muted)]">
              AI features are paused until you top up.{detail}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pl-4">
          <Button asChild size="sm" className="ozer-gradient-btn rounded-lg">
            <Link href={billingHref}>Top up AI credits</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-[var(--workspace-shell-text-muted)]"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
