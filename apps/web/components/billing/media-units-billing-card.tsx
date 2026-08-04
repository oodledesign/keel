'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import Link from 'next/link';
import dynamic from 'next/dynamic';

import { ImageIcon } from 'lucide-react';

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
  MEDIA_SUBSCRIPTION_TIERS,
  MEDIA_TOPUP_PACKS,
} from '~/lib/billing/media-unit-pricing';

const EmbeddedCheckout = dynamic(
  async () => {
    const { EmbeddedCheckout } = await import('@kit/billing-gateway/checkout');
    return { default: EmbeddedCheckout };
  },
  { ssr: false },
);

type TxRow = {
  id: string;
  type: string;
  amount: number;
  reason: string | null;
  created_at: string;
};

type Snapshot = {
  balance: number;
  monthlyAllowance: number;
  planTier: string;
  cycleEnd: string | null;
  transactions: TxRow[];
  expiringTopups: Array<{ units: number; expiresAt: string }>;
};

type MediaUnitsBillingCardProps = {
  accountId: string;
  mode: 'personal' | 'workspace';
  accountSlug?: string;
  canManageBilling?: boolean;
  createCheckout: (input: {
    productId: string;
    planId: string;
  }) => Promise<{ checkoutToken: string }>;
};

const TX_LABELS: Record<string, string> = {
  monthly_grant: 'Monthly grant',
  topup_purchase: 'Top-up purchase',
  generation_debit: 'Generation',
  refund: 'Refund',
  expiry: 'Expired',
  admin_adjust: 'Adjustment',
};

export function MediaUnitsBillingCard(props: MediaUnitsBillingCardProps) {
  const [pending, startTransition] = useTransition();
  const [checkoutToken, setCheckoutToken] = useState<string | undefined>();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const canBuy = props.canManageBilling !== false;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/media/credits?accountId=${props.accountId}`,
      );
      if (!res.ok) {
        setLoadError('Could not load media unit balance.');
        return;
      }
      setSnapshot((await res.json()) as Snapshot);
      setLoadError(null);
    } catch {
      setLoadError('Could not load media unit balance.');
    }
  }, [props.accountId]);

  useEffect(() => {
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
        setLoadError('Checkout failed to start.');
      }
    });
  };

  const used =
    snapshot && snapshot.monthlyAllowance > 0
      ? Math.max(0, snapshot.monthlyAllowance - snapshot.balance)
      : 0;
  const pct =
    snapshot && snapshot.monthlyAllowance > 0
      ? Math.min(100, Math.round((used / snapshot.monthlyAllowance) * 100))
      : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-4 w-4" />
            Media units
          </CardTitle>
          <CardDescription>
            Image and video generation — separate from Ozer AI text credits.
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
          <>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Balance
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {snapshot.balance.toLocaleString('en-GB')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground text-xs">
                  Monthly allowance{' '}
                  {snapshot.monthlyAllowance.toLocaleString('en-GB')}
                </p>
                {snapshot.cycleEnd ? (
                  <p className="text-muted-foreground text-xs">
                    Cycle ends {snapshot.cycleEnd}
                  </p>
                ) : null}
              </div>
            </div>
            {snapshot.monthlyAllowance > 0 ? (
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
            ) : null}
            {snapshot.expiringTopups.length > 0 ? (
              <p className="text-amber-700 dark:text-amber-400 text-sm">
                {snapshot.expiringTopups[0]!.units.toLocaleString('en-GB')} units
                expiring on{' '}
                {new Date(
                  snapshot.expiringTopups[0]!.expiresAt,
                ).toLocaleDateString('en-GB')}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Loading…</p>
        )}

        {canBuy ? (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Monthly plans</p>
            <div className="flex flex-wrap gap-2">
              {MEDIA_SUBSCRIPTION_TIERS.map((tier) => (
                <Button
                  key={tier.id}
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startCheckout(
                      `ozer-addon-media-${tier.id}`,
                      `media-${tier.id}-monthly`,
                    )
                  }
                >
                  {tier.name} £{tier.priceGbp}/mo · {tier.units} units
                </Button>
              ))}
            </div>
            <p className="text-sm font-medium">Top-up packs</p>
            <p className="text-muted-foreground text-xs">
              Tokens expire 6 months from purchase and are non-refundable.
              Unused tokens are forfeited if you close your account.
            </p>
            <div className="flex flex-wrap gap-2">
              {MEDIA_TOPUP_PACKS.map((pack) => (
                <Button
                  key={pack.id}
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startCheckout(
                      `ozer-media-topup-${pack.id}`,
                      `media-topup-${pack.id}`,
                    )
                  }
                >
                  {pack.name} £{pack.priceGbp} · {pack.units} units
                </Button>
              ))}
            </div>
            {props.accountSlug ? (
              <p className="text-muted-foreground text-xs">
                <Link
                  href={`/home/${props.accountSlug}/media`}
                  className="underline"
                >
                  Open media gallery
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

        {snapshot?.transactions?.length ? (
          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">Recent media transactions</p>
            <ul className="space-y-1 text-sm">
              {snapshot.transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="text-muted-foreground flex justify-between gap-2"
                >
                  <span>{TX_LABELS[tx.type] ?? tx.type}</span>
                  <span className="tabular-nums">
                    {tx.amount > 0 ? '+' : ''}
                    {tx.amount}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
