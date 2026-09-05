'use client';

import { useState, useTransition } from 'react';

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
import pathsConfig from '~/config/paths.config';
import {
  CAMPAIGN_CONTACT_BUMP_PACKS,
  CAMPAIGN_SEND_TOPUP_PACKS,
  CAMPAIGN_SUBSCRIPTION_TIERS,
  campaignUsageMeter,
  effectiveCampaignContactCap,
  nextCampaignUpgradeTier,
  normalizeCampaignPlanTier,
} from '~/lib/billing/campaign-pricing';
import type { CampaignCreditPool } from '~/lib/campaigns/campaign.types';

const EmbeddedCheckout = dynamic(
  async () => {
    const { EmbeddedCheckout } = await import('@kit/billing-gateway/checkout');
    return { default: EmbeddedCheckout };
  },
  { ssr: false },
);

type CampaignsBillingCardProps = {
  accountId: string;
  accountSlug: string;
  canManageBilling?: boolean;
  subscriberCount: number;
  usage: CampaignCreditPool;
  createCheckout: (input: {
    productId: string;
    planId: string;
  }) => Promise<{ checkoutToken: string }>;
};

export function CampaignsBillingCard(props: CampaignsBillingCardProps) {
  const [pending, startTransition] = useTransition();
  const [checkoutToken, setCheckoutToken] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<string | null>(null);
  const canBuy = props.canManageBilling !== false;
  const tier = normalizeCampaignPlanTier(props.usage.plan_tier);
  const upgrade = nextCampaignUpgradeTier(tier);
  const contactCap = effectiveCampaignContactCap({
    maxContacts: props.usage.max_contacts,
    bonusContacts: props.usage.bonus_contacts,
  });
  const contacts = campaignUsageMeter({
    used: props.subscriberCount,
    cap: contactCap,
  });
  const sendsUsed = Math.max(
    0,
    props.usage.monthly_allowance - props.usage.balance,
  );

  const startCheckout = (productId: string, planId: string) => {
    startTransition(async () => {
      try {
        const { checkoutToken: token } = await props.createCheckout({
          productId,
          planId,
        });
        setCheckoutToken(token);
        setLoadError(null);
      } catch {
        setLoadError(
          'Checkout failed to start. Confirm Stripe prices exist, or use the billing portal.',
        );
      }
    });
  };

  const campaignsPath = pathsConfig.app.accountEmailCampaigns.replace(
    '[account]',
    props.accountSlug,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Campaigns
          </CardTitle>
          <CardDescription>
            Starter £9 · Growth £19 · Pro £49. Contact cap and monthly send
            units reset on the billing cycle; packs persist separately.
          </CardDescription>
        </div>
        <Badge variant="secondary">{tier}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError ? (
          <p className="text-destructive text-sm">{loadError}</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Contacts
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {props.subscriberCount.toLocaleString('en-GB')}
              {contacts.unlimited
                ? ''
                : ` / ${contactCap.toLocaleString('en-GB')}`}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Sends remaining
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {props.usage.balance.toLocaleString('en-GB')}
            </p>
            <p className="text-muted-foreground text-xs">
              {sendsUsed.toLocaleString('en-GB')} used of{' '}
              {props.usage.monthly_allowance.toLocaleString('en-GB')} this cycle
            </p>
          </div>
        </div>

        {canBuy ? (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Change plan</p>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_SUBSCRIPTION_TIERS.map((plan) => (
                <Button
                  key={plan.id}
                  size="sm"
                  variant={plan.id === tier ? 'secondary' : 'outline'}
                  disabled={pending || plan.id === tier}
                  onClick={() =>
                    startCheckout(
                      'ozer-addon-campaigns',
                      `campaigns-${plan.id}-monthly`,
                    )
                  }
                >
                  {plan.name} £{plan.priceGbp}/mo
                </Button>
              ))}
            </div>
            {upgrade ? (
              <p className="text-muted-foreground text-xs">
                Next step: {upgrade.name} ·{' '}
                {upgrade.maxContacts.toLocaleString()} contacts ·{' '}
                {upgrade.sendUnits.toLocaleString()} sends / month.
              </p>
            ) : null}

            <p className="text-sm font-medium">Send packs</p>
            <p className="text-muted-foreground text-xs">
              One-off top-ups. Units expire 6 months from purchase.
            </p>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_SEND_TOPUP_PACKS.map((pack) => (
                <Button
                  key={pack.id}
                  size="sm"
                  disabled={pending}
                  onClick={() => startCheckout(pack.productId, pack.planId)}
                >
                  {pack.name} £{pack.priceGbp}
                </Button>
              ))}
            </div>

            <p className="text-sm font-medium">Contact bumps</p>
            <p className="text-muted-foreground text-xs">
              One-off cap increases. They persist across billing cycles.
            </p>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_CONTACT_BUMP_PACKS.map((pack) => (
                <Button
                  key={pack.id}
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => startCheckout(pack.productId, pack.planId)}
                >
                  {pack.name} £{pack.priceGbp}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {checkoutToken ? (
          <EmbeddedCheckout
            checkoutToken={checkoutToken}
            provider={billingConfig.provider}
            onClose={() => setCheckoutToken(undefined)}
          />
        ) : null}

        <p className="text-muted-foreground text-xs">
          <Link href={campaignsPath} className="underline">
            Open Campaigns
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
