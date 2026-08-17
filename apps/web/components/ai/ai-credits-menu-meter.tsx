'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { cn } from '@kit/ui/utils';

type CreditsSnapshot = {
  creditsRemaining: number;
  creditsMonthlyLimit: number;
  percentUsed: number;
};

function formatAiCredits(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function AiCreditsMenuMeter({
  accountId,
  billingHref,
  active = true,
}: {
  accountId: string;
  billingHref: string;
  /** When false, skip fetching (e.g. closed dropdown). */
  active?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<CreditsSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active || !accountId) return;

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/ai/credits?accountId=${encodeURIComponent(accountId)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) {
          if (!cancelled) setFailed(true);
          return;
        }
        const json = (await res.json()) as CreditsSnapshot;
        if (!cancelled) {
          setSnapshot(json);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void load();

    const onExhausted = (event: Event) => {
      const detail = (event as CustomEvent<{ accountId?: string }>).detail;
      if (detail?.accountId && detail.accountId !== accountId) return;
      void load();
    };

    window.addEventListener('ozer:ai-credits-exhausted', onExhausted);
    return () => {
      cancelled = true;
      window.removeEventListener('ozer:ai-credits-exhausted', onExhausted);
    };
  }, [accountId, active]);

  if (failed && !snapshot) {
    return null;
  }

  const remaining = snapshot?.creditsRemaining ?? null;
  const limit = snapshot?.creditsMonthlyLimit ?? 0;
  const capacity = Math.max(limit, remaining ?? 0);
  const percentLeft =
    remaining === null
      ? 0
      : capacity > 0
        ? Math.max(0, Math.min(100, (remaining / capacity) * 100))
        : remaining === 0
          ? 0
          : 100;
  const low =
    remaining !== null &&
    (remaining === 0 || (capacity > 0 && remaining / capacity < 0.1));

  return (
    <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-2.5">
      <Link
        href={billingHref}
        className="block rounded-lg py-0.5 transition-colors outline-none hover:bg-[var(--workspace-shell-sidebar-accent)] focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)]/40"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="shrink-0 text-xs font-medium text-[var(--workspace-shell-text-muted)]">
            AI credits
          </span>
          <span
            className={cn(
              'min-w-0 truncate text-right text-xs tabular-nums',
              low
                ? 'font-semibold text-[var(--ozer-accent)]'
                : 'text-[var(--workspace-shell-text)]',
            )}
          >
            {remaining === null
              ? '…'
              : limit > 0
                ? `${formatAiCredits(remaining)} left / ${formatAiCredits(limit)}`
                : `${formatAiCredits(remaining)} left`}
          </span>
        </div>
        <div
          className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--workspace-shell-sidebar-accent)]"
          aria-hidden
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width]',
              low
                ? 'bg-[var(--ozer-accent)]'
                : 'bg-[var(--workspace-shell-text-muted)]',
            )}
            style={{ width: `${percentLeft}%` }}
          />
        </div>
      </Link>
    </div>
  );
}
