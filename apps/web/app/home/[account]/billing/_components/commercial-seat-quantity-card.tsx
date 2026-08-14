'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import {
  estimateMonthlyGbp,
  freeSupportSeats,
} from '~/lib/billing/commercial-graduated-pricing';

import { updateCommercialSeatQuantityAction } from '../_lib/server/commercial-seats.actions';

function formatMoney(gbp: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(gbp);
}

type CommercialSeatQuantityCardProps = {
  accountId: string;
  accountSlug: string;
  canManageBilling: boolean;
  subscribedBillable: number;
  billableAssigned: number;
  supportAssigned: number;
  pendingBillableSeats: number | null;
  pendingEffectiveAt: string | null;
};

export function CommercialSeatQuantityCard({
  accountId,
  accountSlug,
  canManageBilling,
  subscribedBillable,
  billableAssigned,
  supportAssigned,
  pendingBillableSeats,
  pendingEffectiveAt,
}: CommercialSeatQuantityCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState(String(subscribedBillable));

  const parsed = Math.max(1, Math.floor(Number(quantity) || 1));
  const supportIncluded = freeSupportSeats(parsed);
  const estimate = estimateMonthlyGbp(parsed);

  const pendingLabel =
    pendingBillableSeats != null && pendingEffectiveAt
      ? `Downgrade to ${pendingBillableSeats} billable seat${pendingBillableSeats === 1 ? '' : 's'} scheduled for ${new Date(pendingEffectiveAt).toLocaleDateString('en-GB')}`
      : pendingBillableSeats != null
        ? `Downgrade to ${pendingBillableSeats} billable seats scheduled at period end`
        : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Billable seats</CardTitle>
        <CardDescription>
          Upgrade applies immediately and restarts the billing cycle. Downgrade
          takes effect at the end of the current cycle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Assigned: {billableAssigned} billable · {supportAssigned} support
          (allowance follows seat band). Subscribed: {subscribedBillable}{' '}
          billable.
        </p>

        {pendingLabel ? (
          <p className="text-sm text-[var(--ozer-accent)]">{pendingLabel}</p>
        ) : null}

        {canManageBilling ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="billable-seats"
                className="text-muted-foreground text-xs font-medium"
              >
                Billable seats
              </label>
              <Input
                id="billable-seats"
                type="number"
                min={1}
                max={200}
                className="w-28"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                disabled={pending}
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={pending || parsed === subscribedBillable}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const result = await updateCommercialSeatQuantityAction({
                      accountId,
                      accountSlug,
                      quantity: parsed,
                    });

                    if (result.timing === 'immediate') {
                      toast.success(
                        `Upgraded to ${result.quantity} billable seats. Billing cycle restarted.`,
                      );
                    } else if (result.timing === 'period_end') {
                      toast.success(
                        `Downgrade to ${result.pendingQuantity} seats scheduled for period end.`,
                      );
                    } else if (result.timing === 'cancelled_pending') {
                      toast.success(
                        'Cancelled pending seat change. Current seats kept.',
                      );
                    } else {
                      toast.message('Seat quantity unchanged');
                    }

                    router.refresh();
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : 'Could not update seats',
                    );
                  }
                });
              }}
            >
              {pending ? 'Saving…' : 'Update seats'}
            </Button>
          </div>
        ) : null}

        <p className="text-muted-foreground text-xs">
          Estimate {formatMoney(estimate)}/mo · {supportIncluded} free support
          seat{supportIncluded === 1 ? '' : 's'} included at this size.
        </p>
      </CardContent>
    </Card>
  );
}
