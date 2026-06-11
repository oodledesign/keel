'use client';

import { useMemo, useState, useTransition } from 'react';

import dynamic from 'next/dynamic';
import { useParams, useSearchParams } from 'next/navigation';

import { PlanPicker } from '@kit/billing-gateway/components';
import { useAppEvents } from '@kit/shared/events';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { Trans } from '@kit/ui/trans';

import billingConfig from '~/config/billing.config';
import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';
import { productIdsForWorkspaceProfile } from '~/lib/billing/keel-plan-catalog';

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

export function KeelWorkspaceCheckoutForm(params: {
  accountId: string;
  customerId: string | null | undefined;
  workspaceProfile: WorkspaceProfile;
}) {
  const routeParams = useParams();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const appEvents = useAppEvents();

  const [checkoutToken, setCheckoutToken] = useState<string | undefined>(
    undefined,
  );

  const filteredConfig = useMemo(() => {
    const allowedProductIds = new Set(
      productIdsForWorkspaceProfile(params.workspaceProfile),
    );

    return {
      ...billingConfig,
      products: billingConfig.products.filter((product) =>
        allowedProductIds.has(product.id),
      ),
    };
  }, [params.workspaceProfile]);

  const setupMode = searchParams.get('setup') === '1';
  const productParam = searchParams.get('product');
  const planParam = searchParams.get('plan');
  const intervalParam = searchParams.get('interval');

  const defaultPickerValue =
    productParam && planParam
      ? {
          productId: productParam,
          planId: planParam,
          interval: intervalParam === 'year' ? 'year' : 'month',
        }
      : undefined;

  if (checkoutToken) {
    return (
      <EmbeddedCheckout
        checkoutToken={checkoutToken}
        provider={billingConfig.provider}
        onClose={() => setCheckoutToken(undefined)}
      />
    );
  }

  const canStartTrial = !params.customerId;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {setupMode ? 'Choose your workspace plan' : (
            <Trans i18nKey={'billing:manageTeamPlan'} />
          )}
        </CardTitle>

        <CardDescription>
          {setupMode
            ? 'Start a 14-day trial or subscribe to unlock this workspace. All prices in GBP.'
            : (
              <Trans i18nKey={'billing:manageTeamPlanDescription'} />
            )}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <PlanPicker
          pending={pending}
          config={filteredConfig as typeof billingConfig}
          canStartTrial={canStartTrial}
          value={defaultPickerValue}
          onSubmit={({ planId, productId }) => {
            startTransition(async () => {
              const slug = routeParams.account as string;

              appEvents.emit({
                type: 'checkout.started',
                payload: {
                  planId,
                  account: slug,
                },
              });

              const { checkoutToken: token } =
                await createTeamAccountCheckoutSession({
                  planId,
                  productId,
                  slug,
                  accountId: params.accountId,
                });

              setCheckoutToken(token);
            });
          }}
        />
      </CardContent>
    </Card>
  );
}
