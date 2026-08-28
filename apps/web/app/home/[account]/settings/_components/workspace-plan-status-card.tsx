'use client';

import { useState } from 'react';

import Link from 'next/link';

import { InfoIcon, MessageCircleWarning } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';
import type { AccountBillingStatus } from '~/lib/billing/account-billing-types';
import { isBillingRecoveryStatus } from '~/lib/billing/billing-recovery';
import { formatBillingDate } from '~/lib/billing/format-billing-date';
import { formatMinorUnits } from '~/lib/billing/plan-templates-types';
import type { PlatformSubscriptionDiscount } from '~/lib/billing/platform-subscription-discount-types';
import type { WorkspacePlanChargeEstimate } from '~/lib/billing/workspace-plan-estimate';

import {
  EditWorkspaceSeatsDialog,
  type EditWorkspaceSeatsDialogProps,
} from './edit-workspace-seats-dialog';

type WorkspacePlanSummary = {
  periodEndsAt: string | null;
  trialEndsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  subscriptionStatus?: string | null;
  chargeEstimate: WorkspacePlanChargeEstimate | null;
  discount?: PlatformSubscriptionDiscount | null;
  subscribedSeats?: number;
  assignedBillableSeats?: number;
  assignedSupportSeats?: number;
  lastPayment?: {
    amountMinor: number;
    currency: string;
    paidAt: string | null;
    receiptUrl: string | null;
  };
};

type SeatEditorConfig = Omit<
  EditWorkspaceSeatsDialogProps,
  'open' | 'onOpenChange'
>;

type WorkspacePlanStatusCardProps = {
  isBusinessLite: boolean;
  hasPaidSubscription: boolean;
  subscriptionProductPlan?: {
    product: { name: string };
    plan: { name: string };
  };
  planSummary?: WorkspacePlanSummary;
  seatEditor?: SeatEditorConfig | null;
  canManageBilling: boolean;
  accountSlug: string;
  billingStatus?: AccountBillingStatus | null;
  billingExempt?: boolean;
};

function formatDiscountLabel(discount: PlatformSubscriptionDiscount): string {
  const parts: string[] = [];

  if (discount.percentOff != null) {
    parts.push(`${discount.percentOff}% off`);
  } else if (discount.amountOffMinor != null && discount.currency) {
    parts.push(
      `${formatMinorUnits(discount.amountOffMinor, discount.currency)} off`,
    );
  }

  if (discount.name) {
    parts.push(discount.name);
  }

  if (parts.length === 0) {
    return 'Applied';
  }

  if (parts.length === 1) {
    return parts[0]!;
  }

  return `${parts[0]} · ${parts.slice(1).join(' · ')}`;
}

function formatDiscountDuration(discount: PlatformSubscriptionDiscount): string | null {
  if (discount.endsAt) {
    return `Ends ${formatBillingDate(discount.endsAt)}`;
  }

  if (discount.duration === 'forever') {
    return 'Ongoing';
  }

  if (discount.duration === 'once') {
    return 'Applies once';
  }

  if (discount.duration === 'repeating' && discount.durationInMonths != null) {
    return `For ${discount.durationInMonths} month${discount.durationInMonths === 1 ? '' : 's'}`;
  }

  return null;
}

function discountedAmountMinor(
  amountMinor: number,
  discount: PlatformSubscriptionDiscount | null | undefined,
): number | null {
  if (!discount) {
    return null;
  }

  if (discount.percentOff != null && discount.percentOff > 0) {
    return Math.max(
      0,
      Math.round(amountMinor * (1 - discount.percentOff / 100)),
    );
  }

  if (discount.amountOffMinor != null && discount.amountOffMinor > 0) {
    return Math.max(0, amountMinor - discount.amountOffMinor);
  }

  return null;
}

function PlanSummaryDetails({ summary }: { summary: WorkspacePlanSummary }) {
  const {
    periodEndsAt,
    chargeEstimate,
    discount,
    subscribedSeats,
    assignedBillableSeats,
    assignedSupportSeats,
    lastPayment,
  } = summary;

  const hasSeatSummary =
    subscribedSeats != null &&
    assignedBillableSeats != null &&
    assignedSupportSeats != null;

  const afterDiscount =
    chargeEstimate && discount
      ? discountedAmountMinor(chargeEstimate.amountMinor, discount)
      : null;

  const discountDuration = discount ? formatDiscountDuration(discount) : null;

  return (
    <dl className="text-muted-foreground grid gap-2 text-sm">
      <div className="flex items-baseline justify-between gap-4">
        <dt>Next renewal</dt>
        <dd className="text-foreground">{formatBillingDate(periodEndsAt)}</dd>
      </div>

      {chargeEstimate ? (
        <div className="flex items-baseline justify-between gap-4">
          <dt>
            {chargeEstimate.interval === 'year'
              ? 'Estimated annual charge'
              : 'Estimated monthly charge'}
          </dt>
          <dd className="text-foreground text-right">
            {afterDiscount != null ? (
              <>
                {chargeEstimate.isEstimate ? '~' : ''}
                {formatMinorUnits(
                  afterDiscount,
                  chargeEstimate.currency,
                  chargeEstimate.interval,
                )}
                <span className="text-muted-foreground ml-1.5 text-xs line-through">
                  {chargeEstimate.isEstimate ? '~' : ''}
                  {formatMinorUnits(
                    chargeEstimate.amountMinor,
                    chargeEstimate.currency,
                    chargeEstimate.interval,
                  )}
                </span>
              </>
            ) : (
              <>
                {chargeEstimate.isEstimate ? '~' : ''}
                {formatMinorUnits(
                  chargeEstimate.amountMinor,
                  chargeEstimate.currency,
                  chargeEstimate.interval,
                )}
              </>
            )}
          </dd>
        </div>
      ) : null}

      {discount ? (
        <div className="flex items-baseline justify-between gap-4">
          <dt>Discount</dt>
          <dd className="text-foreground text-right">
            {formatDiscountLabel(discount)}
            {discountDuration ? (
              <span className="text-muted-foreground">
                {' '}
                · {discountDuration}
              </span>
            ) : null}
          </dd>
        </div>
      ) : null}

      {hasSeatSummary ? (
        <div className="flex items-baseline justify-between gap-4">
          <dt>Seats</dt>
          <dd className="text-foreground">
            {assignedBillableSeats} billable assigned · {subscribedSeats}{' '}
            subscribed
            {(assignedSupportSeats ?? 0) > 0
              ? ` · ${assignedSupportSeats} support`
              : ''}
          </dd>
        </div>
      ) : subscribedSeats != null && assignedBillableSeats != null ? (
        <div className="flex items-baseline justify-between gap-4">
          <dt>Seats</dt>
          <dd className="text-foreground">
            {assignedBillableSeats} assigned · {subscribedSeats} subscribed
          </dd>
        </div>
      ) : null}

      {lastPayment ? (
        <div className="flex items-baseline justify-between gap-4">
          <dt>Last payment</dt>
          <dd className="text-foreground">
            {formatMinorUnits(lastPayment.amountMinor, lastPayment.currency)}
            {lastPayment.paidAt
              ? ` · ${formatBillingDate(lastPayment.paidAt)}`
              : ''}
            {lastPayment.receiptUrl ? (
              <>
                {' · '}
                <a
                  href={lastPayment.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--workspace-shell-text)] underline underline-offset-2"
                >
                  Receipt
                </a>
              </>
            ) : null}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function PlanStatusAlerts({ summary }: { summary: WorkspacePlanSummary }) {
  const { trialEndsAt, cancelAtPeriodEnd, periodEndsAt, subscriptionStatus } =
    summary;

  return (
    <div className="space-y-3">
      {subscriptionStatus === 'trialing' && trialEndsAt ? (
        <Alert variant="info">
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Trial in progress</AlertTitle>
          <AlertDescription>
            Your trial ends on {formatBillingDate(trialEndsAt)}. You will be
            charged after that date unless you cancel.
          </AlertDescription>
        </Alert>
      ) : null}

      {cancelAtPeriodEnd ? (
        <Alert variant="warning">
          <MessageCircleWarning className="h-4 w-4" />
          <AlertTitle>Cancellation scheduled</AlertTitle>
          <AlertDescription>
            Your plan stays active until {formatBillingDate(periodEndsAt)}.
            After that, access ends and you will not be charged again.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function statusBadge(
  billingStatus: AccountBillingStatus | null | undefined,
  subscriptionStatus?: string | null,
) {
  if (subscriptionStatus === 'trialing') {
    return <Badge variant="success">Trial</Badge>;
  }
  if (subscriptionStatus === 'past_due') {
    return <Badge variant="destructive">Past due</Badge>;
  }
  if (subscriptionStatus === 'canceled') {
    return <Badge variant="outline">Cancelled</Badge>;
  }
  if (!billingStatus) return null;
  if (billingStatus === 'active' || billingStatus === 'trialing') {
    return <Badge variant="success">Active</Badge>;
  }
  if (billingStatus === 'past_due_grace') {
    return <Badge variant="outline">Payment retrying</Badge>;
  }
  if (isBillingRecoveryStatus(billingStatus)) {
    return <Badge variant="destructive">Action needed</Badge>;
  }
  if (billingStatus === 'canceled') {
    return <Badge variant="outline">Cancelled</Badge>;
  }
  return <Badge variant="outline">{billingStatus}</Badge>;
}

export function WorkspacePlanStatusCard({
  isBusinessLite,
  hasPaidSubscription,
  subscriptionProductPlan,
  planSummary,
  seatEditor = null,
  canManageBilling,
  accountSlug,
  billingStatus,
  billingExempt = false,
}: WorkspacePlanStatusCardProps) {
  const [seatsOpen, setSeatsOpen] = useState(false);
  const billingPath = pathsConfig.app.accountBilling.replace(
    '[account]',
    accountSlug,
  );

  if (isBusinessLite && !hasPaidSubscription) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Workspace plan</CardTitle>
              <CardDescription>
                Business Lite is free — enough to run Signatures and team
                settings. Upgrade when you need clients, projects, and
                invoicing.
              </CardDescription>
            </div>
            <Badge variant="outline">Business Lite</Badge>
          </div>
        </CardHeader>
        {canManageBilling ? (
          <CardContent className="pt-0">
            <Button asChild variant="outline" size="sm">
              <Link href={`${billingPath}?upgrade=1#workspace-plan-checkout`}>
                Upgrade to full business
              </Link>
            </Button>
          </CardContent>
        ) : null}
      </Card>
    );
  }

  if (hasPaidSubscription && subscriptionProductPlan) {
    const showEditSeats = Boolean(canManageBilling && seatEditor);
    const showAlerts = Boolean(
      planSummary &&
        ((planSummary.subscriptionStatus === 'trialing' &&
          planSummary.trialEndsAt) ||
          planSummary.cancelAtPeriodEnd),
    );

    return (
      <>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Workspace plan</CardTitle>
                <CardDescription>
                  {subscriptionProductPlan.product.name} ·{' '}
                  {subscriptionProductPlan.plan.name}
                </CardDescription>
              </div>
              {statusBadge(
                billingStatus,
                planSummary?.subscriptionStatus,
              ) ?? <Badge variant="success">Active</Badge>}
            </div>
          </CardHeader>
          {showAlerts && planSummary ? (
            <CardContent className="border-t pt-4">
              <PlanStatusAlerts summary={planSummary} />
            </CardContent>
          ) : null}
          {planSummary ? (
            <CardContent className={showAlerts ? 'pt-0' : 'border-t pt-4'}>
              <PlanSummaryDetails summary={planSummary} />
            </CardContent>
          ) : null}
          {showEditSeats ? (
            <CardFooter className="border-t pt-4">
              <Button
                type="button"
                size="lg"
                className="ozer-gradient-btn w-full text-[var(--ozer-white)]"
                onClick={() => setSeatsOpen(true)}
              >
                Edit seats
              </Button>
            </CardFooter>
          ) : null}
        </Card>

        {seatEditor ? (
          <EditWorkspaceSeatsDialog
            {...seatEditor}
            open={seatsOpen}
            onOpenChange={setSeatsOpen}
          />
        ) : null}
      </>
    );
  }

  if (billingExempt && !hasPaidSubscription) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Workspace plan</CardTitle>
              <CardDescription>
                Complimentary access is active. Choose a paid plan below — enter
                your promo code at checkout if you have one.
              </CardDescription>
            </div>
            <Badge variant="outline">Complimentary</Badge>
          </div>
        </CardHeader>
        {canManageBilling ? (
          <CardContent className="pt-0">
            <Button asChild variant="outline" size="sm">
              <Link href={`${billingPath}?billing=1#workspace-plan-checkout`}>
                Start paid plan
              </Link>
            </Button>
          </CardContent>
        ) : null}
      </Card>
    );
  }

  return null;
}
