'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import {
  ArrowRight,
  BriefcaseBusiness,
  FileText,
  FolderKanban,
  Kanban,
  PenLine,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';

import { Button } from '@kit/ui/button';

import { dismissNotice, isNoticeDismissed } from '~/lib/dismissible-notice';

type BusinessLiteUpgradeBannerProps = {
  billingPath: string;
};

const FEATURES = [
  { label: 'Clients', Icon: BriefcaseBusiness },
  { label: 'Projects', Icon: FolderKanban },
  { label: 'Pipeline', Icon: Kanban },
  { label: 'Invoices', Icon: PenLine },
  { label: 'Finances', Icon: Wallet },
  { label: 'Docs', Icon: FileText },
] as const;

export function BusinessLiteUpgradeBanner({
  billingPath,
}: BusinessLiteUpgradeBannerProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(isNoticeDismissed('business-lite-upgrade'));
  }, []);

  if (dismissed) {
    return null;
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--ozer-accent)]/25 bg-[var(--workspace-shell-panel)] px-4 py-3.5 shadow-[0_1px_2px_rgba(42,23,32,0.05)] sm:px-5">
      <button
        type="button"
        aria-label="Dismiss upgrade notice"
        className="absolute top-2.5 right-2.5 rounded-full p-1 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
        onClick={() => {
          dismissNotice('business-lite-upgrade', 14);
          setDismissed(true);
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex flex-col gap-3 pr-7 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pr-8">
        <div className="min-w-0 space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--ozer-accent)]">
            <Sparkles className="h-3 w-3" aria-hidden />
            Get all business features
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-[var(--workspace-shell-text)] sm:text-base">
              Upgrade to full business
            </h2>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              CRM, billing, and docs — add-ons stay on either plan.
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-[var(--workspace-shell-text-muted)]">
            {FEATURES.map(({ label, Icon }) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <Icon
                  className="h-3.5 w-3.5 shrink-0 text-[var(--ozer-accent)]"
                  aria-hidden
                />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 flex-col gap-1 sm:items-end">
          <Button
            asChild
            size="sm"
            className="ozer-gradient-btn h-9 rounded-lg px-4"
          >
            <Link href={`${billingPath}?upgrade=1`}>
              Upgrade from £29/mo
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
          <p className="text-[11px] text-[var(--workspace-shell-text-muted)] sm:text-right">
            14-day trial on Business Solo
          </p>
        </div>
      </div>
    </section>
  );
}
