'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { ArrowRight, BriefcaseBusiness, PenLine, Sparkles, X } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { dismissNotice, isNoticeDismissed } from '~/lib/dismissible-notice';

type BusinessLiteUpgradeBannerProps = {
  billingPath: string;
};

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
    <section className="relative overflow-hidden rounded-[24px] border border-[var(--ozer-accent)]/25 bg-[var(--workspace-shell-panel)] p-6 shadow-[0_18px_50px_rgba(4,10,24,0.24)] md:p-8">
      <button
        type="button"
        aria-label="Dismiss upgrade notice"
        className="absolute top-4 right-4 rounded-full p-1.5 text-[var(--workspace-shell-text-muted)] hover:bg-white/8 hover:text-[var(--workspace-shell-text)]"
        onClick={() => {
          dismissNotice('business-lite-upgrade', 14);
          setDismissed(true);
        }}
      >
        <X className="h-4 w-4" />
      </button>

      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          background:
            'linear-gradient(135deg, rgba(42,157,143,0.12) 0%, transparent 55%)',
        }}
      />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl space-y-3 pr-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] px-3 py-1 text-xs font-medium text-[var(--ozer-accent)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Business Lite
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--workspace-shell-text)] md:text-2xl">
            Upgrade to full business
          </h2>
          <p className="text-sm leading-relaxed text-[var(--workspace-shell-text-muted)] md:text-base">
            Unlock clients, projects, pipeline, invoicing, finances, and docs.
            Add-ons like Signatures stay available on either plan.
          </p>
          <ul className="grid gap-2 text-sm text-[var(--workspace-shell-text-muted)] sm:grid-cols-2">
            <li className="flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
              Clients &amp; projects
            </li>
            <li className="flex items-center gap-2">
              <PenLine className="h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
              Invoices &amp; proposals
            </li>
          </ul>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col">
          <Button asChild className="keel-gradient-btn h-11 rounded-xl px-6">
            <Link href={`${billingPath}?upgrade=1`}>
              Upgrade from £29/mo
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <p className="text-center text-xs text-[var(--workspace-shell-text-muted)] md:text-left">
            14-day trial on Business Solo
          </p>
        </div>
      </div>
    </section>
  );
}
