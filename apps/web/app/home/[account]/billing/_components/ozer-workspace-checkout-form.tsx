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
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Trans } from '@kit/ui/trans';

import billingConfig from '~/config/billing.config';
import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';
import {
  aiCreditsForBillableSeats,
  clampBillableSeats as clampBusinessBillableSeats,
  estimateMonthlyGbp as estimateBusinessMonthlyGbp,
  maxProjectGuestsForBillableSeats,
} from '~/lib/billing/business-graduated-pricing';
import { estimateStarterMonthlyGbp } from '~/lib/billing/business-starter-pricing';
import {
  clampBillableSeats as clampCommercialBillableSeats,
  estimateMonthlyGbp as estimateCommercialMonthlyGbp,
  freeSupportSeats,
} from '~/lib/billing/commercial-graduated-pricing';
import { productIdsForWorkspaceProfile } from '~/lib/billing/ozer-plan-catalog';
import { formatGbp } from '~/lib/billing/pricing-marketing';

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

export function OzerWorkspaceCheckoutForm(params: {
  accountId: string;
  customerId: string | null | undefined;
  workspaceProfile: WorkspaceProfile;
  upgradeFromLite?: boolean;
}) {
  const routeParams = useParams();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const appEvents = useAppEvents();

  const [checkoutToken, setCheckoutToken] = useState<string | undefined>(
    undefined,
  );

  const isCommercial = params.workspaceProfile === 'commercial_property';
  const isBusiness = params.workspaceProfile === 'work_design';
  const usesGraduatedSeats = isCommercial || isBusiness;

  const seatsFromQuery = Number(searchParams.get('seats'));
  const clampSeats = isCommercial
    ? clampCommercialBillableSeats
    : clampBusinessBillableSeats;
  const [billableSeats, setBillableSeats] = useState(() =>
    Number.isFinite(seatsFromQuery) && seatsFromQuery >= 1
      ? clampSeats(seatsFromQuery)
      : 1,
  );

  const productParam = searchParams.get('product');
  const selectedProductId = productParam ?? '';
  const isStarterSelected = selectedProductId === 'ozer-business-starter';
  const starterEstimate = estimateStarterMonthlyGbp(billableSeats);
  const proEstimate = estimateBusinessMonthlyGbp(billableSeats);
  const monthlyEstimate = isCommercial
    ? estimateCommercialMonthlyGbp(billableSeats)
    : isStarterSelected
      ? starterEstimate
      : proEstimate;
  const supportSeats = isCommercial ? freeSupportSeats(billableSeats) : 0;

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
          {params.upgradeFromLite ? (
            'Upgrade to Starter or Pro'
          ) : setupMode ? (
            'Choose your workspace plan'
          ) : (
            <Trans i18nKey={'billing:manageTeamPlan'} />
          )}
        </CardTitle>

        <CardDescription>
          {params.upgradeFromLite ? (
            'Starter or Pro lifts Free caps and uses graduated seats. Starter is recording-only; Pro adds planner, email assistant, and coaching. Your installed apps stay on this workspace.'
          ) : setupMode ? (
            isCommercial ? (
              'Graduated per-seat pricing in GBP. Seat 1 is £89, seats 2–7 are £55, seats 8+ are £39.'
            ) : isBusiness ? (
              'Choose Starter or Pro. Starter is £14 for seat 1 then £9 each extra. Pro is £29 for seat 1 then £22 each extra.'
            ) : (
              'Start a 14-day trial or subscribe to unlock this workspace. All prices in GBP.'
            )
          ) : (
            <Trans i18nKey={'billing:manageTeamPlanDescription'} />
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {usesGraduatedSeats ? (
          <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40 p-4">
            <div className="space-y-2">
              <Label htmlFor="billable-seats">Billable seats</Label>
              <Input
                id="billable-seats"
                type="number"
                min={1}
                max={200}
                value={billableSeats}
                onChange={(event) =>
                  setBillableSeats(clampSeats(Number(event.target.value) || 1))
                }
              />
            </div>
            <p className="text-sm text-[var(--workspace-shell-text)]">
              {isBusiness ? (
                <>
                  Starter{' '}
                  <span className="font-semibold">
                    {formatGbp(starterEstimate)}/mo
                  </span>
                  {' · '}
                  Pro{' '}
                  <span className="font-semibold">
                    {formatGbp(proEstimate)}/mo
                  </span>
                </>
              ) : (
                <>
                  Estimated total{' '}
                  <span className="font-semibold">
                    {formatGbp(monthlyEstimate)}/mo
                  </span>
                </>
              )}
            </p>
            <ul className="space-y-1 text-xs text-[var(--workspace-shell-text-muted)]">
              {isCommercial ? (
                <li>
                  {supportSeats > 0
                    ? `${supportSeats} free support seats included`
                    : 'No free support seats on a single billable seat'}
                </li>
              ) : (
                <>
                  <li>
                    Starter: 1 project guest per seat · Pro:{' '}
                    {maxProjectGuestsForBillableSeats(billableSeats)} guests and{' '}
                    {aiCreditsForBillableSeats(billableSeats).toLocaleString()}{' '}
                    shared AI credits
                  </li>
                  <li>Unlimited client portal access</li>
                </>
              )}
            </ul>
          </div>
        ) : null}

        <PlanPicker
          pending={pending}
          config={filteredConfig as typeof billingConfig}
          canStartTrial={canStartTrial}
          value={defaultPickerValue}
          displayCostOverride={
            isCommercial
              ? monthlyEstimate
              : isBusiness
                ? (productId) =>
                    productId === 'ozer-business-starter'
                      ? starterEstimate
                      : productId === 'ozer-business'
                        ? proEstimate
                        : undefined
                : undefined
          }
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

              try {
                const { checkoutToken: token } =
                  await createTeamAccountCheckoutSession({
                    planId,
                    productId,
                    slug,
                    accountId: params.accountId,
                    seats: usesGraduatedSeats ? billableSeats : undefined,
                  });

                setCheckoutToken(token);
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : 'Could not start checkout. Please try again.',
                );
              }
            });
          }}
        />
      </CardContent>
    </Card>
  );
}
