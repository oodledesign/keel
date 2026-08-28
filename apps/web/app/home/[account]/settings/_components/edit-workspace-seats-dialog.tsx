'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  aiCreditsForBillableSeats,
  estimateMonthlyGbp as estimateBusinessMonthlyGbp,
  maxProjectGuestsForBillableSeats,
} from '~/lib/billing/business-graduated-pricing';
import {
  estimateMonthlyGbp as estimateCommercialMonthlyGbp,
  freeSupportSeats,
} from '~/lib/billing/commercial-graduated-pricing';

import { updateBusinessSeatQuantityAction } from '../../billing/_lib/server/business-seats.actions';
import { updateCommercialSeatQuantityAction } from '../../billing/_lib/server/commercial-seats.actions';

function formatMoney(gbp: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(gbp);
}

export type EditWorkspaceSeatsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'commercial' | 'business';
  accountId: string;
  accountSlug: string;
  subscribedBillable: number;
  assignedCount: number;
  supportAssigned?: number;
  pendingBillableSeats: number | null;
  pendingEffectiveAt: string | null;
};

export function EditWorkspaceSeatsDialog({
  open,
  onOpenChange,
  mode,
  accountId,
  accountSlug,
  subscribedBillable,
  assignedCount,
  supportAssigned = 0,
  pendingBillableSeats,
  pendingEffectiveAt,
}: EditWorkspaceSeatsDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState(String(subscribedBillable));

  useEffect(() => {
    if (open) {
      setQuantity(String(subscribedBillable));
    }
  }, [open, subscribedBillable]);

  const parsed = Math.max(1, Math.floor(Number(quantity) || 1));
  const estimate =
    mode === 'commercial'
      ? estimateCommercialMonthlyGbp(parsed)
      : estimateBusinessMonthlyGbp(parsed);
  const supportIncluded =
    mode === 'commercial' ? freeSupportSeats(parsed) : 0;
  const guests =
    mode === 'business' ? maxProjectGuestsForBillableSeats(parsed) : 0;
  const credits =
    mode === 'business' ? aiCreditsForBillableSeats(parsed) : 0;

  const pendingLabel =
    pendingBillableSeats != null && pendingEffectiveAt
      ? `Downgrade to ${pendingBillableSeats} seat${pendingBillableSeats === 1 ? '' : 's'} scheduled for ${new Date(pendingEffectiveAt).toLocaleDateString('en-GB')}`
      : pendingBillableSeats != null
        ? `Downgrade to ${pendingBillableSeats} seats scheduled at period end`
        : null;

  function save() {
    startTransition(async () => {
      try {
        if (mode === 'commercial') {
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
        } else {
          await updateBusinessSeatQuantityAction({
            accountId,
            accountSlug,
            quantity: parsed,
          });
          toast.success('Seat quantity updated');
        }

        onOpenChange(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update seats',
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit billable seats</DialogTitle>
          <DialogDescription>
            Upgrade applies immediately and restarts the billing cycle.
            Downgrade takes effect at the end of the current cycle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-muted-foreground text-sm">
            {mode === 'commercial'
              ? `Assigned: ${assignedCount} billable · ${supportAssigned} support. Subscribed: ${subscribedBillable} billable.`
              : `Assigned members: ${assignedCount} · Subscribed: ${subscribedBillable}`}
          </p>

          {pendingLabel ? (
            <p className="text-sm text-[var(--ozer-accent)]">{pendingLabel}</p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="edit-workspace-seats">Billable seats</Label>
            <Input
              id="edit-workspace-seats"
              type="number"
              min={1}
              max={200}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              disabled={pending}
              className="w-28"
            />
          </div>

          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Estimate {formatMoney(estimate)}
            <span className="text-muted-foreground font-normal">/mo</span>
          </p>

          {mode === 'commercial' ? (
            <p className="text-muted-foreground text-xs">
              {supportIncluded} free support seat
              {supportIncluded === 1 ? '' : 's'} included at this size.
            </p>
          ) : (
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>{credits.toLocaleString()} shared AI credits / month</li>
              <li>
                {guests} project guest{guests === 1 ? '' : 's'}
              </li>
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="ozer-gradient-btn text-[var(--ozer-white)]"
            disabled={pending || parsed === subscribedBillable}
            onClick={save}
          >
            {pending ? 'Saving…' : 'Update seats'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
