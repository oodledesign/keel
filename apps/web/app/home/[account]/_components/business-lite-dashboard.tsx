import Link from 'next/link';

import {
  ArrowRight,
  BriefcaseBusiness,
  LayoutGrid,
  PenLine,
  Sparkles,
} from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import type { NavChild } from '~/config/work-account-navigation.config';

const panelClass =
  'rounded-[24px] border border-white/6 bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]';

type BusinessLiteDashboardProps = {
  accountSlug: string;
  accountName: string;
  userFirstName: string | null;
  canManageBilling: boolean;
  installedApps: NavChild[];
};

export function BusinessLiteDashboard({
  accountSlug,
  accountName,
  userFirstName,
  canManageBilling,
  installedApps,
}: BusinessLiteDashboardProps) {
  const billingPath = pathsConfig.app.accountBilling.replace(
    '[account]',
    accountSlug,
  );
  const appsPath = pathsConfig.app.accountApps.replace('[account]', accountSlug);
  const greeting = userFirstName?.trim() || accountName;

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6 lg:py-8">
      {canManageBilling ? (
        <section
          className={`${panelClass} relative overflow-hidden border-[var(--keel-teal)]/25 p-6 md:p-8`}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            aria-hidden
            style={{
              background:
                'linear-gradient(135deg, rgba(42,157,143,0.12) 0%, transparent 55%)',
            }}
          />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--keel-teal)]/30 bg-[var(--keel-teal)]/10 px-3 py-1 text-xs font-medium text-[var(--keel-teal)]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Business Lite
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white md:text-2xl">
                Upgrade to full business
              </h2>
              <p className="text-sm leading-relaxed text-zinc-400 md:text-base">
                Unlock clients, projects, pipeline, invoicing, finances, and
                docs — everything you need to run your agency in one workspace.
                Add-ons like Signatures stay available on either plan.
              </p>
              <ul className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
                <li className="flex items-center gap-2">
                  <BriefcaseBusiness
                    className="h-4 w-4 shrink-0 text-[var(--keel-teal)]"
                    aria-hidden
                  />
                  Clients &amp; projects
                </li>
                <li className="flex items-center gap-2">
                  <PenLine
                    className="h-4 w-4 shrink-0 text-[var(--keel-teal)]"
                    aria-hidden
                  />
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
              <p className="text-center text-xs text-zinc-500 md:text-left">
                14-day trial on Business Solo
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className={`${panelClass} p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Hi {greeting}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              This workspace is set up for Keel apps. Browse the marketplace to
              add Signatures, Rankly, Feedflow, or Videos.
            </p>
          </div>
          <Button asChild variant="outline" className="shrink-0 rounded-xl">
            <Link href={appsPath}>
              <LayoutGrid className="mr-2 h-4 w-4" aria-hidden />
              Browse apps
            </Link>
          </Button>
        </div>

        {installedApps.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {installedApps.map((app) => (
              <Link
                key={app.path}
                href={app.path}
                className="rounded-xl border border-white/10 bg-black/10 px-4 py-4 transition-colors hover:border-white/20 hover:bg-black/20"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/20 text-[var(--keel-teal)]">
                    {app.Icon}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white">{app.label}</h3>
                    {app.description ? (
                      <p className="text-muted-foreground mt-1 text-sm">
                        {app.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground mt-6 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm">
            No apps installed yet.{' '}
            <Link href={appsPath} className="text-[var(--keel-teal)] hover:underline">
              Open the apps marketplace
            </Link>{' '}
            to get started.
          </p>
        )}
      </section>
    </div>
  );
}
