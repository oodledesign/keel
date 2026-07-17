'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import dynamic from 'next/dynamic';

import { Sparkles } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { cn } from '@kit/ui/utils';

import billingConfig from '~/config/billing.config';
import {
  type AiCreditPurchaseMode,
  OZER_AI_CREDIT_PACK_TIERS,
  type OzerAiCreditPackTier,
  tierDescription,
} from '~/lib/billing/ai-credit-packs';

const EmbeddedCheckout = dynamic(
  async () => {
    const { EmbeddedCheckout } = await import('@kit/billing-gateway/checkout');
    return { default: EmbeddedCheckout };
  },
  { ssr: false },
);

type CreditsSnapshot = {
  creditsRemaining: number;
  creditsMonthlyRemaining: number;
  creditsPurchasedRemaining: number;
  creditsMonthlyLimit: number;
  periodEnd: string;
};

type AiCreditsBillingCardProps = {
  accountId: string;
  /** personal = personal account checkout; workspace = team checkout needs slug */
  mode: 'personal' | 'workspace';
  accountSlug?: string;
  canManageBilling?: boolean;
  createCheckout: (input: {
    productId: string;
    planId: string;
  }) => Promise<{ checkoutToken: string }>;
};

function formatCredits(n: number) {
  return n.toLocaleString('en-GB');
}

export function AiCreditsBillingCard(props: AiCreditsBillingCardProps) {
  const [pending, startTransition] = useTransition();
  const [checkoutToken, setCheckoutToken] = useState<string | undefined>();
  const [purchaseMode, setPurchaseMode] =
    useState<AiCreditPurchaseMode>('one-time');
  const [selected, setSelected] = useState<OzerAiCreditPackTier>(
    OZER_AI_CREDIT_PACK_TIERS[0]!,
  );
  const [snapshot, setSnapshot] = useState<CreditsSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canBuy = props.canManageBilling !== false;
  const selectedOffer =
    purchaseMode === 'monthly' ? selected.monthly : selected.oneTime;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai/credits?accountId=${props.accountId}`);
      if (!res.ok) {
        setLoadError('Could not load credit balance.');
        return;
      }
      const data = (await res.json()) as CreditsSnapshot;
      setSnapshot(data);
      setLoadError(null);
    } catch {
      setLoadError('Could not load credit balance.');
    }
  }, [props.accountId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (checkoutToken) {
    return (
      <EmbeddedCheckout
        checkoutToken={checkoutToken}
        provider={billingConfig.provider}
        onClose={() => {
          setCheckoutToken(undefined);
          void refresh();
        }}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-[var(--ozer-accent)]" />
              AI credits
            </CardTitle>
            <CardDescription>
              Your plan includes a monthly pool that resets each billing period.
              Top-ups add to a separate purchased balance that rolls over.
            </CardDescription>
          </div>
          {snapshot ? (
            <Badge variant="outline">
              {formatCredits(snapshot.creditsRemaining)} left
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loadError ? (
          <p className="text-muted-foreground text-sm">{loadError}</p>
        ) : snapshot ? (
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs">Plan pool left</p>
              <p className="font-medium">
                {formatCredits(snapshot.creditsMonthlyRemaining)} /{' '}
                {formatCredits(snapshot.creditsMonthlyLimit)}
              </p>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs">Purchased left</p>
              <p className="font-medium">
                {formatCredits(snapshot.creditsPurchasedRemaining)}
              </p>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs">Pool resets</p>
              <p className="font-medium">
                {new Date(snapshot.periodEnd).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Loading balance…</p>
        )}

        {canBuy ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium">Buy more credits</p>
              <div className="inline-flex rounded-lg border p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPurchaseMode('one-time')}
                  className={cn(
                    'rounded-md px-3 py-1.5 font-medium transition-colors',
                    purchaseMode === 'one-time'
                      ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-text)]'
                      : 'text-muted-foreground',
                  )}
                >
                  One-time
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseMode('monthly')}
                  className={cn(
                    'rounded-md px-3 py-1.5 font-medium transition-colors',
                    purchaseMode === 'monthly'
                      ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-text)]'
                      : 'text-muted-foreground',
                  )}
                >
                  Every month
                </button>
              </div>
            </div>

            <ul className="grid gap-2">
              {OZER_AI_CREDIT_PACK_TIERS.map((tier) => {
                const offer =
                  purchaseMode === 'monthly' ? tier.monthly : tier.oneTime;
                const isSelected = selected.id === tier.id;
                return (
                  <li key={tier.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(tier)}
                      className={cn(
                        'flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                        isSelected
                          ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]/40'
                          : 'hover:border-[var(--ozer-accent)]/35',
                      )}
                    >
                      <span>
                        <span className="block text-sm font-semibold">
                          {tier.name} · {formatCredits(tier.credits)} credits
                          {purchaseMode === 'monthly' ? '/month' : ''}
                        </span>
                        <span className="text-muted-foreground mt-0.5 block text-xs">
                          {tierDescription(tier, purchaseMode)}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-[var(--ozer-coral-600)]">
                        £{offer.priceGbp}
                        {purchaseMode === 'monthly' ? '/mo' : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <Button
              type="button"
              className="w-full"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const { checkoutToken: token } = await props.createCheckout(
                      {
                        productId: selectedOffer.productId,
                        planId: selectedOffer.planId,
                      },
                    );
                    setCheckoutToken(token);
                  } catch {
                    setLoadError('Could not start checkout. Please try again.');
                  }
                });
              }}
            >
              {pending
                ? 'Starting checkout…'
                : purchaseMode === 'monthly'
                  ? `Subscribe to ${selected.name} for £${selectedOffer.priceGbp}/mo`
                  : `Buy ${selected.name} for £${selectedOffer.priceGbp}`}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Ask a workspace owner to buy more AI credits.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
