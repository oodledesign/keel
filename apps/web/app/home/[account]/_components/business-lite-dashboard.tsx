import Link from 'next/link';

import { LayoutGrid } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import type { NavChild } from '~/config/work-account-navigation.config';

import { BusinessLiteUpgradeBanner } from './business-lite-upgrade-banner';

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
      <section className={`${panelClass} p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Hi {greeting}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              This workspace is set up for Ozer apps. Browse the marketplace to
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

      {canManageBilling ? (
        <BusinessLiteUpgradeBanner billingPath={billingPath} />
      ) : null}
    </div>
  );
}
