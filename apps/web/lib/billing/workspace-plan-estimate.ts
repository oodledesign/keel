import {
  BUSINESS_GRADUATED_PRODUCT_ID,
  estimateMonthlyGbp as estimateBusinessMonthlyGbp,
} from '~/lib/billing/business-graduated-pricing';
import {
  COMMERCIAL_GRADUATED_PRODUCT_ID,
  estimateMonthlyGbp as estimateCommercialMonthlyGbp,
} from '~/lib/billing/commercial-graduated-pricing';
import type { PlanBillingInterval } from '~/lib/billing/plan-templates-types';

/** Yearly workspace plans bill ten months of the monthly graduated total. */
export const WORKSPACE_YEARLY_BILLING_MONTHS = 10;

export type WorkspacePlanChargeEstimate = {
  amountMinor: number;
  currency: string;
  interval: PlanBillingInterval;
  /** True when derived from graduated pricing rather than stored line-item amounts. */
  isEstimate: boolean;
};

type SubscriptionItemLike = {
  price_amount: number | null;
  quantity: number | null;
  type: string;
  interval?: string | null;
};

export function estimateWorkspacePlanCharge(input: {
  productId: string;
  billableSeats: number;
  subscriptionItems: SubscriptionItemLike[];
  currency?: string | null;
  planInterval?: PlanBillingInterval;
}): WorkspacePlanChargeEstimate | null {
  const currency = (input.currency ?? 'gbp').toLowerCase();
  const perSeatItem =
    input.subscriptionItems.find((item) => item.type === 'per_seat') ??
    input.subscriptionItems[0];
  const interval: PlanBillingInterval =
    input.planInterval ??
    (perSeatItem?.interval === 'year' ? 'year' : 'month');

  if (input.productId === COMMERCIAL_GRADUATED_PRODUCT_ID) {
    const monthlyGbp = estimateCommercialMonthlyGbp(input.billableSeats);
    const amountMinor =
      interval === 'year'
        ? monthlyGbp * 100 * WORKSPACE_YEARLY_BILLING_MONTHS
        : monthlyGbp * 100;

    return { amountMinor, currency, interval, isEstimate: true };
  }

  if (input.productId === BUSINESS_GRADUATED_PRODUCT_ID) {
    const monthlyGbp = estimateBusinessMonthlyGbp(input.billableSeats);
    const amountMinor =
      interval === 'year'
        ? monthlyGbp * 100 * WORKSPACE_YEARLY_BILLING_MONTHS
        : monthlyGbp * 100;

    return { amountMinor, currency, interval, isEstimate: true };
  }

  if (perSeatItem?.price_amount != null) {
    const quantity =
      perSeatItem.type === 'per_seat'
        ? Math.max(1, perSeatItem.quantity ?? 1)
        : 1;

    return {
      amountMinor: perSeatItem.price_amount * quantity,
      currency,
      interval,
      isEstimate: false,
    };
  }

  const flatItem = input.subscriptionItems.find((item) => item.type === 'flat');

  if (flatItem?.price_amount != null) {
    return {
      amountMinor: flatItem.price_amount,
      currency,
      interval,
      isEstimate: false,
    };
  }

  return null;
}
