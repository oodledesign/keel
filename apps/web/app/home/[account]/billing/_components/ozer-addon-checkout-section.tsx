'use client';

import { useMemo, useState, useTransition } from 'react';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

import { PlanPicker } from '@kit/billing-gateway/components';
import { useAppEvents } from '@kit/shared/events';
import { Badge } from '@kit/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';

import billingConfig from '~/config/billing.config';
import {
  launchedAddonProductIds,
  launchedWorkspaceAddons,
  type OzerAddonKey,
} from '~/lib/billing/ozer-plan-catalog';

import { createTeamAccountCheckoutSession } from '../_lib/server/server-actions';

const EmbeddedCheckout = dynamic(
  async () => {
    const { EmbeddedCheckout } = await import('@kit/billing-gateway/checkout');

    return {
      default: EmbeddedCheckout,
    };
  },
  {
    ssr: false,
  },
);

type OzerAddonCheckoutSectionProps = {
  accountId: string;
  workspacePaid: boolean;
  activeAddons: Record<OzerAddonKey, boolean>;
  highlightAddon?: string | null;
};

function defaultProductForAddon(key: OzerAddonKey): string {
  const addon = launchedWorkspaceAddons().find((entry) => entry.key === key);
  return addon?.productId ?? 'ozer-addon-signatures';
}

function addonKeyFromHighlight(value: string | null | undefined): OzerAddonKey | null {
  if (value === 'signatures') return 'addon_signatures';
  if (value === 'rankly') return 'addon_rankly';
  if (value === 'feedflow') return 'addon_feedflow';
  if (value === 'videos') return 'addon_videos';
  return null;
}

export function OzerAddonCheckoutSection({
  accountId,
  workspacePaid,
  activeAddons,
  highlightAddon,
}: OzerAddonCheckoutSectionProps) {
  const routeParams = useParams();
  const [pending, startTransition] = useTransition();
  const appEvents = useAppEvents();

  const availableAddons = launchedWorkspaceAddons();

  const initialKey =
    addonKeyFromHighlight(highlightAddon) ??
    availableAddons.find((addon) => !activeAddons[addon.key])?.key ??
    availableAddons[0]?.key ??
    'addon_signatures';

  const [selectedKey, setSelectedKey] = useState<OzerAddonKey>(initialKey);
  const [checkoutToken, setCheckoutToken] = useState<string | undefined>();

  const filteredConfig = useMemo(() => {
    const allowed = new Set(launchedAddonProductIds());
    return {
      ...billingConfig,
      products: billingConfig.products.filter((product) =>
        allowed.has(product.id),
      ),
    };
  }, []);

  const pickerProducts = useMemo(() => {
    const productId = defaultProductForAddon(selectedKey);
    return filteredConfig.products.filter((p) => p.id === productId);
  }, [filteredConfig.products, selectedKey]);

  if (checkoutToken) {
    return (
      <EmbeddedCheckout
        checkoutToken={checkoutToken}
        provider={billingConfig.provider}
        onClose={() => setCheckoutToken(undefined)}
      />
    );
  }

  if (!workspacePaid) {
    return (
      <Card id="addons">
        <CardHeader>
          <CardTitle>Signatures</CardTitle>
          <CardDescription>
            Activate this workspace (Business Lite is free) before subscribing to
            Signatures.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const selectedAddon =
    availableAddons.find((addon) => addon.key === selectedKey) ??
    availableAddons[0];
  const selectedActive = selectedAddon
    ? activeAddons[selectedAddon.key]
    : false;
  const showAddonPicker = availableAddons.length > 1;

  return (
    <Card id="addons">
      <CardHeader>
        <CardTitle>
          {availableAddons.length === 1
            ? availableAddons[0]?.name ?? 'Add-ons'
            : 'Add-ons'}
        </CardTitle>
        <CardDescription>
          {availableAddons.length === 1
            ? 'Separate subscription from your workspace plan — choose monthly or annual billing independently.'
            : 'Optional modules for this workspace. Each add-on is its own subscription.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {showAddonPicker ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {availableAddons.map((addon) => {
              const active = activeAddons[addon.key];
              const selected = selectedKey === addon.key;

              return (
                <button
                  key={addon.key}
                  type="button"
                  onClick={() => setSelectedKey(addon.key)}
                  className={`rounded-xl border p-4 text-left transition ${
                    selected
                      ? 'border-[var(--ozer-accent)]/40 bg-[var(--ozer-accent)]/5'
                      : 'border-[color:var(--workspace-shell-border)] bg-black/10 hover:border-[color:var(--workspace-shell-border)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{addon.name}</p>
                    {active ? (
                      <Badge variant="outline" className="text-emerald-400">
                        Active
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        from £{addon.fromPriceGbp}/mo
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {addon.description}
                  </p>
                </button>
              );
            })}
          </div>
        ) : selectedAddon ? (
          <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-black/10 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{selectedAddon.name}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {selectedAddon.description}
                </p>
              </div>
              {selectedActive ? (
                <Badge variant="outline" className="text-emerald-400">
                  Active
                </Badge>
              ) : (
                <span className="text-muted-foreground shrink-0 text-xs">
                  from £{selectedAddon.fromPriceGbp}/mo
                </span>
              )}
            </div>
          </div>
        ) : null}

        {selectedActive ? (
          <p className="text-muted-foreground text-sm">
            {selectedAddon?.name} is already active on this workspace. Use the
            billing portal below to change plan interval or cancel.
          </p>
        ) : selectedAddon ? (
          <div className="rounded-xl border border-[color:var(--workspace-shell-border)] p-4">
            <p className="mb-4 text-sm font-medium">
              Choose a {selectedAddon.name} plan
            </p>
            <PlanPicker
              pending={pending}
              config={{
                ...filteredConfig,
                products: pickerProducts,
              }}
              canStartTrial={false}
              onSubmit={({ planId, productId }) => {
                startTransition(async () => {
                  const slug = routeParams.account as string;

                  appEvents.emit({
                    type: 'checkout.started',
                    payload: { planId, account: slug },
                  });

                  const { checkoutToken: token } =
                    await createTeamAccountCheckoutSession({
                      planId,
                      productId,
                      slug,
                      accountId,
                    });

                  setCheckoutToken(token);
                });
              }}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
