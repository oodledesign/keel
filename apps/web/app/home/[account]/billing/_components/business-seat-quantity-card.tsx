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
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  aiCreditsForBillableSeats,
  estimateMonthlyGbp,
  maxProjectGuestsForBillableSeats,
} from '~/lib/billing/business-graduated-pricing';

import { updateBusinessSeatQuantityAction } from '../_lib/server/business-seats.actions';

function formatMoney(gbp: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(gbp);
}

type BusinessSeatQuantityCardProps = {
  accountId: string;
  accountSlug: string;
  canManageBilling: boolean;
  subscribedBillable: number;
  membersAssigned: number;
  pendingBillableSeats: number | null;
  pendingEffectiveAt: string | null;
};

export function BusinessSeatQuantityCard({
  accountId,
  accountSlug,
  canManageBilling,
  subscribedBillable,
  membersAssigned,
  pendingBillableSeats,
  pendingEffectiveAt,
}: BusinessSeatQuantityCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState(String(subscribedBillable));

  const parsed = Math.max(1, Math.floor(Number(quantity) || 1));
  const estimate = estimateMonthlyGbp(parsed);
  const guests = maxProjectGuestsForBillableSeats(parsed);
  const credits = aiCreditsForBillableSeats(parsed);

  const pendingLabel =
    pendingBillableSeats != null && pendingEffectiveAt
      ? `Downgrade to ${pendingBillableSeats} seat${pendingBillableSeats === 1 ? '' : 's'} scheduled for ${new Date(pendingEffectiveAt).toLocaleDateString('en-GB')}`
      : pendingBillableSeats != null
        ? `Downgrade to ${pendingBillableSeats} seats scheduled at period end`
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
          Assigned members: {membersAssigned} · Subscribed: {subscribedBillable}
        </p>
        {pendingLabel ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {pendingLabel}
          </p>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="business-seat-qty">Seats</Label>
            <Input
              id="business-seat-qty"
              type="number"
              min={1}
              max={200}
              value={quantity}
              disabled={!canManageBilling || pending}
              onChange={(event) => setQuantity(event.target.value)}
              className="w-24"
            />
          </div>
          <p className="text-sm font-medium">
            {formatMoney(estimate)}
            <span className="text-muted-foreground font-normal">/mo</span>
          </p>
        </div>

        <ul className="text-muted-foreground space-y-1 text-sm">
          <li>
            {credits.toLocaleString()} shared AI credits / month — drafts,
            summaries, and coaching
          </li>
          <li>
            {guests} project guest{guests === 1 ? '' : 's'}
          </li>
        </ul>

        {canManageBilling ? (
          <Button
            disabled={pending || parsed === subscribedBillable}
            onClick={() => {
              startTransition(async () => {
                try {
                  await updateBusinessSeatQuantityAction({
                    accountId,
                    accountSlug,
                    quantity: parsed,
                  });
                  toast.success('Seat quantity updated');
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
            {pending ? 'Updating…' : 'Update seats'}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
