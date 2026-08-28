import Link from 'next/link';

import { BadgeCheck, LayoutGrid } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import type { NavChild } from '~/config/work-account-navigation.config';
import { workspacePanelCard } from '~/lib/workspace-ui';

import { BusinessLiteUpgradeBanner } from './business-lite-upgrade-banner';

const panelClass = `${workspacePanelCard} rounded-[24px]`;

const installedAppCardClass =
  'rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-4 shadow-[0_1px_2px_rgba(42,23,32,0.04)] transition-colors hover:border-[var(--ozer-accent)]/30 hover:bg-[var(--workspace-shell-panel-hover)]';

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
  const appsPath = pathsConfig.app.accountApps.replace(
    '[account]',
    accountSlug,
  );
  const greeting = userFirstName?.trim() || accountName;

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6 lg:py-8">
      <section className={`${panelClass} p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
              Hi {greeting}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              This workspace is set up for Ozer apps. Browse the marketplace to
              explore all available add-ons.
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
              <Link key={app.path} href={app.path} className={installedAppCardClass}>
                <div className="flex items-start gap-3">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] text-[var(--ozer-accent)]">
                    {app.Icon}
                    <BadgeCheck
                      className="absolute -right-1.5 -bottom-1.5 size-4 rounded-full bg-[var(--workspace-shell-panel)] fill-emerald-500 text-white dark:text-[var(--workspace-shell-panel)]"
                      aria-hidden
                    />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-[var(--workspace-shell-text)]">
                      {app.label}
                    </h3>
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
          <p className="text-muted-foreground mt-6 rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center text-sm">
            No apps installed yet.{' '}
            <Link
              href={appsPath}
              className="text-[var(--ozer-accent)] hover:underline"
            >
              Open the apps marketplace
            </Link>{' '}
            to get started.
          </p>
        )}
      </section>

      {canManageBilling ? (
        <BusinessLiteUpgradeBanner billingPath={billingPath} />
      ) : null}
    </div>
  );
}
