'use client';

import { useState, useTransition } from 'react';

import dynamic from 'next/dynamic';

import { CheckCircle2 } from 'lucide-react';

import { PlanPicker } from '@kit/billing-gateway/components';
import { useAppEvents } from '@kit/shared/events';
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
import { OZER_PERSONAL_ADDON_CATALOG } from '~/lib/billing/ozer-plan-catalog';

import { createPersonalAccountCheckoutSession } from '../_lib/server/server-actions';

const EmbeddedCheckout = dynamic(
  async () => {
    const { EmbeddedCheckout } = await import('@kit/billing-gateway/checkout');
    return { default: EmbeddedCheckout };
  },
  { ssr: false },
);

const EMAIL_ASSISTANT = OZER_PERSONAL_ADDON_CATALOG[0]!;

export function PersonalEmailAssistantBillingCard(props: {
  active: boolean;
  highlighted?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [checkoutToken, setCheckoutToken] = useState<string | undefined>();
  const appEvents = useAppEvents();

  const productConfig = billingConfig.products.find(
    (product) => product.id === EMAIL_ASSISTANT.productId,
  );

  if (checkoutToken) {
    return (
      <EmbeddedCheckout
        checkoutToken={checkoutToken}
        provider={billingConfig.provider}
        onClose={() => setCheckoutToken(undefined)}
      />
    );
  }

  if (props.active) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">{EMAIL_ASSISTANT.name}</CardTitle>
              <CardDescription>{EMAIL_ASSISTANT.description}</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Active
            </Badge>
          </div>
        </CardHeader>
      </Card>
    );
  }

  if (!productConfig) {
    return null;
  }

  return (
    <Card className={props.highlighted ? 'ring-2 ring-[var(--ozer-accent)]' : undefined}>
      <CardHeader>
        <CardTitle className="text-base">{EMAIL_ASSISTANT.name}</CardTitle>
        <CardDescription>{EMAIL_ASSISTANT.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          From £{EMAIL_ASSISTANT.monthlyPriceGbp}/month on your personal account.
          Gmail sync, AI action items, and draft replies — not included in the free
          personal tier.
        </p>

        <PlanPicker
          pending={pending}
          config={{
            ...billingConfig,
            products: [productConfig],
          }}
          canStartTrial={false}
          onSubmit={({ planId, productId }) => {
            startTransition(async () => {
              appEvents.emit({
                type: 'checkout.started',
                payload: { planId },
              });

              const { checkoutToken } = await createPersonalAccountCheckoutSession({
                planId,
                productId,
              });

              setCheckoutToken(checkoutToken);
            });
          }}
        />
      </CardContent>
    </Card>
  );
}
