import Link from 'next/link';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import { OzerAddonCheckoutSection } from '~/home/[account]/billing/_components/ozer-addon-checkout-section';
import {
  type OzerAddonKey,
  inDevelopmentWorkspaceAddons,
  launchedWorkspaceAddons,
} from '~/lib/billing/ozer-plan-catalog';

type WorkspaceAddonsPanelProps = {
  accountId: string;
  accountSlug: string;
  canManageBilling: boolean;
  workspacePaid: boolean;
  activeAddons: Record<OzerAddonKey, boolean>;
  highlightAddon?: string | null;
};

/**
 * Catalog of purchasable + in-development add-ons.
 * Linked from billing / apps — not listed in settings nav.
 */
export function WorkspaceAddonsPanel({
  accountId,
  accountSlug,
  canManageBilling,
  workspacePaid,
  activeAddons,
  highlightAddon,
}: WorkspaceAddonsPanelProps) {
  const billingPath = pathsConfig.app.accountBilling.replace(
    '[account]',
    accountSlug,
  );
  const comingSoon = inDevelopmentWorkspaceAddons();
  const launched = launchedWorkspaceAddons();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-base font-semibold">Apps & add-ons</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Optional modules for this workspace. Each add-on is billed separately
          from your plan.
        </p>
      </div>

      <div className="flex max-w-2xl flex-col gap-6">
        {canManageBilling ? (
          <OzerAddonCheckoutSection
            accountId={accountId}
            workspacePaid={workspacePaid}
            activeAddons={activeAddons}
            highlightAddon={highlightAddon}
          />
        ) : (
          <div className="rounded-xl border border-[color:var(--workspace-shell-border)] px-4 py-5">
            <p className="text-sm font-medium">Available add-ons</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Ask a workspace owner or billing admin to subscribe.
            </p>
            <ul className="mt-4 space-y-3">
              {launched.map((addon) => (
                <li
                  key={addon.key}
                  className="rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{addon.name}</p>
                    {activeAddons[addon.key] ? (
                      <Badge variant="outline">Active</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        from £{addon.fromPriceGbp}/mo
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {addon.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {comingSoon.length > 0 ? (
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">In development</h3>
              <p className="text-muted-foreground text-xs">
                These apps are on the roadmap — not available to subscribe yet.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {comingSoon.map((addon) => (
                <div
                  key={addon.key}
                  className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] p-4 opacity-90"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="font-semibold">{addon.name}</p>
                    <Badge variant="secondary">Coming soon</Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {addon.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <p className="text-muted-foreground text-xs">
          Active subscriptions also appear on{' '}
          <Link
            href={billingPath}
            className="text-[var(--workspace-shell-text)] underline underline-offset-2"
          >
            Billing
          </Link>
          .
          {canManageBilling ? null : (
            <>
              {' '}
              <Button asChild variant="link" className="h-auto p-0 text-xs">
                <Link href={billingPath}>Open billing</Link>
              </Button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
