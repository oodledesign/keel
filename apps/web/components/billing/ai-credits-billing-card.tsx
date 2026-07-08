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
  OZER_AI_CREDIT_PACKS,
  type OzerAiCreditPack,
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
  const [selected, setSelected] = useState<OzerAiCreditPack>(
    OZER_AI_CREDIT_PACKS[0]!,
  );
  const [snapshot, setSnapshot] = useState<CreditsSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canBuy = props.canManageBilling !== false;

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
              Monthly pool resets each month. Purchased packs stay until you use
              them.
            </CardDescription>
          </div>
          {snapshot ? (
            <Badge variant="outline">{formatCredits(snapshot.creditsRemaining)} left</Badge>
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
              <p className="text-muted-foreground text-xs">Resets</p>
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
            <p className="text-sm font-medium">Buy more credits</p>
            <ul className="grid gap-2">
              {OZER_AI_CREDIT_PACKS.map((pack) => {
                const isSelected = selected.planId === pack.planId;
                return (
                  <li key={pack.planId}>
                    <button
                      type="button"
                      onClick={() => setSelected(pack)}
                      className={cn(
                        'flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                        isSelected
                          ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]/40'
                          : 'hover:border-[var(--ozer-accent)]/35',
                      )}
                    >
                      <span>
                        <span className="block text-sm font-semibold">
                          {pack.name} · {formatCredits(pack.credits)} credits
                        </span>
                        <span className="text-muted-foreground mt-0.5 block text-xs">
                          {pack.description}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-[var(--ozer-coral-600)]">
                        £{pack.priceGbp}
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
                    const { checkoutToken: token } = await props.createCheckout({
                      productId: selected.productId,
                      planId: selected.planId,
                    });
                    setCheckoutToken(token);
                  } catch {
                    setLoadError('Could not start checkout. Please try again.');
                  }
                });
              }}
            >
              {pending
                ? 'Starting checkout…'
                : `Buy ${selected.name} for £${selected.priceGbp}`}
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
