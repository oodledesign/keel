'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import dynamic from 'next/dynamic';
import Link from 'next/link';

import { Mail } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';

import billingConfig from '~/config/billing.config';
import {
  CAMPAIGN_CONTACT_BUMPS,
  CAMPAIGN_SEND_PACKS,
  CAMPAIGN_SUBSCRIPTION_TIERS,
} from '~/lib/billing/campaign-pricing';

const EmbeddedCheckout = dynamic(
  async () => {
    const { EmbeddedCheckout } = await import('@kit/billing-gateway/checkout');
    return { default: EmbeddedCheckout };
  },
  { ssr: false },
);

type Snapshot = {
  balance: number;
  monthlyAllowance: number;
  maxContacts: number;
  contactBonus: number;
  planTier: string;
  cycleEnd: string | null;
  packBalance: number;
  contactsUsed: number;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    created_at: string;
  }>;
};

type CampaignsBillingCardProps = {
  accountId: string;
  accountSlug?: string;
  canManageBilling?: boolean;
  createCheckout: (input: {
    productId: string;
    planId: string;
  }) => Promise<{ checkoutToken: string }>;
};

export function CampaignsBillingCard(props: CampaignsBillingCardProps) {
  const [pending, startTransition] = useTransition();
  const [checkoutToken, setCheckoutToken] = useState<string | undefined>();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const canBuy = props.canManageBilling !== false;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/campaigns/credits?accountId=${props.accountId}`,
      );
      if (!res.ok) {
        setLoadError('Could not load campaign usage.');
        return;
      }
      setSnapshot((await res.json()) as Snapshot);
      setLoadError(null);
    } catch {
      setLoadError('Could not load campaign usage.');
    }
  }, [props.accountId]);

  useEffect(() => {
    // Same mount-load pattern as MediaUnitsBillingCard / AiCreditsBillingCard.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch after mount
    void refresh();
  }, [refresh]);

  const startCheckout = (productId: string, planId: string) => {
    startTransition(async () => {
      try {
        const { checkoutToken: token } = await props.createCheckout({
          productId,
          planId,
        });
        setCheckoutToken(token);
      } catch {
        setLoadError(
          'Checkout failed to start. Confirm Stripe price IDs are set, then retry.',
        );
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Campaigns
          </CardTitle>
          <CardDescription>
            Monthly send allotment plus optional send packs and contact bumps.
            Unused monthly units expire at cycle end. Circulation is a separate
            meter.
          </CardDescription>
        </div>
        {snapshot ? (
          <Badge variant="secondary">{snapshot.planTier}</Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError ? (
          <p className="text-destructive text-sm">{loadError}</p>
        ) : null}
        {snapshot ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                Send units left
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {snapshot.balance.toLocaleString('en-GB')}
              </p>
              <p className="text-muted-foreground text-xs">
                {snapshot.monthlyAllowance.toLocaleString('en-GB')} monthly
                {snapshot.packBalance > 0
                  ? ` · ${snapshot.packBalance.toLocaleString('en-GB')} from packs`
                  : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs">
                Contacts {snapshot.contactsUsed.toLocaleString('en-GB')}
                {snapshot.maxContacts > 0
                  ? ` / ${snapshot.maxContacts.toLocaleString('en-GB')}`
                  : ''}
              </p>
              {snapshot.cycleEnd ? (
                <p className="text-muted-foreground text-xs">
                  Cycle ends {snapshot.cycleEnd}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Loading…</p>
        )}

        {canBuy ? (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Upgrade path</p>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_SUBSCRIPTION_TIERS.map((tier) => (
                <Button
                  key={tier.id}
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startCheckout(
                      'ozer-addon-campaigns',
                      `campaigns-${tier.id}-monthly`,
                    )
                  }
                >
                  {tier.name} £{tier.priceGbp}/mo ·{' '}
                  {tier.maxContacts.toLocaleString()} contacts
                </Button>
              ))}
            </div>
            <p className="text-sm font-medium">Send packs</p>
            <p className="text-muted-foreground text-xs">
              TODO for Dan: create these Stripe prices and set the matching
              STRIPE_PRICE_CAMPAIGNS_* env vars. Checkout uses catalog
              placeholders until then.
            </p>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_SEND_PACKS.map((pack) => (
                <Button
                  key={`${pack.id}-once`}
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startCheckout(pack.oneTime.productId, pack.oneTime.planId)
                  }
                >
                  {pack.name} £{pack.oneTime.priceGbp} once
                </Button>
              ))}
              {CAMPAIGN_SEND_PACKS.map((pack) => (
                <Button
                  key={`${pack.id}-mo`}
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startCheckout(pack.monthly.productId, pack.monthly.planId)
                  }
                >
                  {pack.name} £{pack.monthly.priceGbp}/mo
                </Button>
              ))}
            </div>
            <p className="text-sm font-medium">Contact bumps</p>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_CONTACT_BUMPS.map((bump) => (
                <Button
                  key={bump.id}
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startCheckout(bump.monthly.productId, bump.monthly.planId)
                  }
                >
                  {bump.name} £{bump.monthly.priceGbp}/mo
                </Button>
              ))}
            </div>
            {props.accountSlug ? (
              <p className="text-muted-foreground text-xs">
                <Link
                  href={`/home/${props.accountSlug}/email-campaigns`}
                  className="underline"
                >
                  Open campaigns
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        {checkoutToken ? (
          <EmbeddedCheckout
            checkoutToken={checkoutToken}
            provider={billingConfig.provider}
            onClose={() => {
              setCheckoutToken(undefined);
              void refresh();
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
