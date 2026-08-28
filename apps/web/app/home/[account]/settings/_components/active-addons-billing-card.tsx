import Link from 'next/link';

import { BadgeCheck } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';
import {
  OZER_ADDON_CATALOG,
  type OzerAddonKey,
} from '~/lib/billing/ozer-plan-catalog';

type ActiveAddonsBillingCardProps = {
  accountSlug: string;
  activeAddons: Record<OzerAddonKey, boolean>;
  /** Media Generate has its own billing cards — omit from this list. */
  excludeKeys?: OzerAddonKey[];
};

/**
 * Billing-only summary of add-ons already on the workspace.
 * Purchase / browse lives on the hidden settings add-ons page.
 */
export function ActiveAddonsBillingCard({
  accountSlug,
  activeAddons,
  excludeKeys = ['addon_media_generate'],
}: ActiveAddonsBillingCardProps) {
  const excluded = new Set(excludeKeys);
  const active = OZER_ADDON_CATALOG.filter(
    (addon) => activeAddons[addon.key] && !excluded.has(addon.key),
  );

  if (active.length === 0) {
    return null;
  }

  const addonsPath = pathsConfig.app.accountAddonsSettings.replace(
    '[account]',
    accountSlug,
  );

  return (
    <Card id="addons">
      <CardHeader>
        <CardTitle>Your apps</CardTitle>
        <CardDescription>
          Add-ons active on this workspace. Change plan interval or cancel in
          the billing portal below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {active.map((addon) => (
            <li
              key={addon.key}
              className="flex items-start justify-between gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--workspace-shell-text)]">
                  <BadgeCheck className="h-5 w-5 shrink-0 fill-green-500 text-white dark:text-stone-900" />
                  {addon.name}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs pl-7">
                  {addon.description}
                </p>
              </div>
              <Badge variant="success" className="shrink-0">
                Active
              </Badge>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs">
          Looking for more?{' '}
          <Link
            href={addonsPath}
            className="text-[var(--workspace-shell-text)] underline underline-offset-2"
          >
            Browse available apps
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
