'use client';

import { useState } from 'react';

import Link from 'next/link';

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
import type { WorkspacePlanChargeEstimate } from '~/lib/billing/workspace-plan-estimate';

import {
  EditWorkspaceSeatsDialog,
  type EditWorkspaceSeatsDialogProps,
} from './edit-workspace-seats-dialog';

type WorkspacePlanSummary = {
  periodEndsAt: string | null;
  chargeEstimate: WorkspacePlanChargeEstimate | null;
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

function PlanSummaryDetails({ summary }: { summary: WorkspacePlanSummary }) {
  const {
    periodEndsAt,
    chargeEstimate,
    subscribedSeats,
    assignedBillableSeats,
    assignedSupportSeats,
    lastPayment,
  } = summary;

  const hasSeatSummary =
    subscribedSeats != null &&
    assignedBillableSeats != null &&
    assignedSupportSeats != null;

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
          <dd className="text-foreground">
            {chargeEstimate.isEstimate ? '~' : ''}
            {formatMinorUnits(
              chargeEstimate.amountMinor,
              chargeEstimate.currency,
              chargeEstimate.interval,
            )}
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

function statusBadge(status: AccountBillingStatus | null | undefined) {
  if (!status) return null;
  if (status === 'active' || status === 'trialing') {
    return <Badge variant="success">Active</Badge>;
  }
  if (status === 'past_due_grace') {
    return <Badge variant="outline">Payment retrying</Badge>;
  }
  if (isBillingRecoveryStatus(status)) {
    return <Badge variant="destructive">Action needed</Badge>;
  }
  if (status === 'canceled') {
    return <Badge variant="outline">Cancelled</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
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
              {statusBadge(billingStatus) ?? (
                <Badge variant="success">Active</Badge>
              )}
            </div>
          </CardHeader>
          {planSummary ? (
            <CardContent className="border-t pt-4">
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
