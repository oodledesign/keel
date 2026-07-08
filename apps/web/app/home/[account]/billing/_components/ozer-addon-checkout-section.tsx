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
  OZER_ADDON_CATALOG,
  addonProductIds,
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
  if (key === 'addon_signatures') return 'ozer-addon-signatures';
  if (key === 'addon_videos') return 'ozer-addon-videos-starter';
  if (key === 'addon_feedflow') return 'ozer-addon-feedflow';
  return 'ozer-addon-rankly';
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

  const initialKey =
    addonKeyFromHighlight(highlightAddon) ??
    OZER_ADDON_CATALOG.find((a) => !activeAddons[a.key])?.key ??
    'addon_rankly';

  const [selectedKey, setSelectedKey] = useState<OzerAddonKey>(initialKey);
  const [checkoutToken, setCheckoutToken] = useState<string | undefined>();

  const filteredConfig = useMemo(() => {
    const allowed = new Set(addonProductIds());
    return {
      ...billingConfig,
      products: billingConfig.products.filter((product) =>
        allowed.has(product.id),
      ),
    };
  }, []);

  const pickerProducts = useMemo(() => {
    const productId = defaultProductForAddon(selectedKey);
    if (selectedKey === 'addon_videos') {
      return filteredConfig.products.filter((p) =>
        p.id.startsWith('ozer-addon-videos'),
      );
    }
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
          <CardTitle>Add-ons</CardTitle>
          <CardDescription>
            Subscribe to a workspace plan first, then add Signatures, Rankly,
            Feedflow, or Videos.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const selectedActive = activeAddons[selectedKey];

  return (
    <Card id="addons">
      <CardHeader>
        <CardTitle>Add-ons</CardTitle>
        <CardDescription>
          Optional modules for this workspace. Each add-on is a separate
          subscription on your Stripe account.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {OZER_ADDON_CATALOG.map((addon) => {
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

        {selectedActive ? (
          <p className="text-muted-foreground text-sm">
            {OZER_ADDON_CATALOG.find((a) => a.key === selectedKey)?.name} is
            already active on this workspace. Use the billing portal below to
            change or cancel.
          </p>
        ) : (
          <div className="rounded-xl border border-[color:var(--workspace-shell-border)] p-4">
            <p className="mb-4 text-sm font-medium">
              Choose a plan for{' '}
              {OZER_ADDON_CATALOG.find((a) => a.key === selectedKey)?.name}
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
        )}
      </CardContent>
    </Card>
  );
}
