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
  clampBillableSeats,
  estimateMonthlyGbp,
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

  const seatsFromQuery = Number(searchParams.get('seats'));
  const [billableSeats, setBillableSeats] = useState(() =>
    Number.isFinite(seatsFromQuery) && seatsFromQuery >= 1
      ? clampBillableSeats(seatsFromQuery)
      : 1,
  );

  const isCommercial = params.workspaceProfile === 'commercial_property';
  const monthlyEstimate = estimateMonthlyGbp(billableSeats);
  const supportSeats = freeSupportSeats(billableSeats);

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
          {params.upgradeFromLite ? (
            'Upgrade to full business'
          ) : setupMode ? (
            'Choose your workspace plan'
          ) : (
            <Trans i18nKey={'billing:manageTeamPlan'} />
          )}
        </CardTitle>

        <CardDescription>
          {params.upgradeFromLite ? (
            'Business Solo includes clients, projects, invoicing, and finances. Your installed apps stay on this workspace.'
          ) : setupMode ? (
            isCommercial ? (
              'Graduated per-seat pricing in GBP. Seat 1 is £89, seats 2–7 are £55, seats 8+ are £39.'
            ) : (
              'Start a 14-day trial or subscribe to unlock this workspace. All prices in GBP.'
            )
          ) : (
            <Trans i18nKey={'billing:manageTeamPlanDescription'} />
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {isCommercial ? (
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
                  setBillableSeats(
                    clampBillableSeats(Number(event.target.value) || 1),
                  )
                }
              />
            </div>
            <p className="text-sm text-[var(--workspace-shell-text)]">
              Estimated total{' '}
              <span className="font-semibold">
                {formatGbp(monthlyEstimate)}/mo
              </span>
            </p>
            <ul className="space-y-1 text-xs text-[var(--workspace-shell-text-muted)]">
              <li>
                {supportSeats > 0
                  ? `${supportSeats} free support seats included`
                  : 'No free support seats on a single billable seat'}
              </li>
              <li>
                Portal publishing included (Rightmove, EACH, Property Hive)
              </li>
            </ul>
          </div>
        ) : null}

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

              try {
                const { checkoutToken: token } =
                  await createTeamAccountCheckoutSession({
                    planId,
                    productId,
                    slug,
                    accountId: params.accountId,
                    seats: isCommercial ? billableSeats : undefined,
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
