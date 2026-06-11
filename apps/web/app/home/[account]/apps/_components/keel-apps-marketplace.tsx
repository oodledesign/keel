import Link from 'next/link';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import {
  KEEL_ADDON_CATALOG,
  type KeelAddonKey,
} from '~/lib/billing/keel-plan-catalog';

import type { NavChild } from '~/config/work-account-navigation.config';

type KeelAppsMarketplaceProps = {
  accountSlug: string;
  installedApps: NavChild[];
  workspacePaid: boolean;
  activeAddons: Record<KeelAddonKey, boolean>;
};

export function KeelAppsMarketplace({
  accountSlug,
  installedApps,
  workspacePaid,
  activeAddons,
}: KeelAppsMarketplaceProps) {
  const billingPath = pathsConfig.app.accountBilling.replace(
    '[account]',
    accountSlug,
  );

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Installed apps</h2>
          <p className="text-muted-foreground text-sm">
            Apps enabled for this workspace.
          </p>
        </div>
        {installedApps.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-white/10 bg-black/10 px-4 py-6 text-sm">
            No apps are enabled yet. Subscribe to an add-on below or turn on
            modules in workspace settings.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {installedApps.map((app) => (
              <Link
                key={app.path}
                href={app.path}
                className="rounded-lg border border-white/10 bg-black/10 px-4 py-5 transition-colors hover:border-white/20 hover:bg-black/20"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/20 text-[var(--keel-teal)]">
                    {app.Icon}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{app.label}</h3>
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
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Available add-ons</h2>
          <p className="text-muted-foreground text-sm">
            Subscribe per workspace. Add-ons unlock when your workspace is active
            (Business Lite is free).
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {KEEL_ADDON_CATALOG.map((addon) => {
            const active = activeAddons[addon.key];
            const addonSlug = addon.key.replace('addon_', '');

            return (
              <div
                key={addon.key}
                className="flex flex-col rounded-lg border border-white/10 bg-black/10 p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{addon.name}</h3>
                  {active ? (
                    <Badge variant="outline" className="text-emerald-400">
                      Active
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      £{addon.fromPriceGbp}/mo+
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mb-4 flex-1 text-sm">
                  {addon.description}
                </p>
                {active ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={billingPath}>Manage billing</Link>
                  </Button>
                ) : workspacePaid ? (
                  <Button asChild size="sm">
                    <Link href={`${billingPath}?addon=${addonSlug}#addons`}>
                      Subscribe
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={billingPath}>Choose workspace plan</Link>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
