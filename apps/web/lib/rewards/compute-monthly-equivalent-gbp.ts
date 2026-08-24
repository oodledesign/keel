import 'server-only';

import billingConfig from '~/config/billing.config';
import { REWARDS_CONFIG } from '~/config/rewards.config';
import { estimateMonthlyGbp as estimateBusinessMonthlyGbp } from '~/lib/billing/business-graduated-pricing';
import { estimateMonthlyGbp as estimateCommercialMonthlyGbp } from '~/lib/billing/commercial-graduated-pricing';
import { findPlanByStripePriceId } from '~/lib/billing/ozer-plan-catalog';

function lineCost(plan: {
  lineItems: Array<{ cost: number; type: string }>;
}): number {
  const flat = plan.lineItems.find((item) => item.type === 'flat');
  if (flat) return flat.cost;
  const perSeat = plan.lineItems.find((item) => item.type === 'per_seat');
  return perSeat?.cost ?? plan.lineItems[0]?.cost ?? 0;
}

function findMonthlyPlanForProduct(productId: string) {
  const product = billingConfig.products.find((p) => p.id === productId);
  return product?.plans.find((p) => p.interval === 'month') ?? null;
}

/**
 * Monthly-equivalent list price in pence from catalog (not yearly/12).
 */
export function computeMonthlyEquivalentPence(params: {
  stripePriceId: string;
  quantity?: number;
}): { planId: string; amountPence: number } {
  const quantity = params.quantity ?? 1;
  const catalogPlan = findPlanByStripePriceId(params.stripePriceId);

  if (!catalogPlan) {
    const fallbackPence = Math.round(
      REWARDS_CONFIG.referrerFallbackMonthlyGbp * 100,
    );
    return { planId: 'unknown', amountPence: fallbackPence };
  }

  if (catalogPlan.family === 'business') {
    const gbp = estimateBusinessMonthlyGbp(quantity);
    return {
      planId: catalogPlan.planId,
      amountPence: Math.round(gbp * 100),
    };
  }

  if (catalogPlan.family === 'commercial_property') {
    const gbp = estimateCommercialMonthlyGbp(quantity);
    return {
      planId: catalogPlan.planId,
      amountPence: Math.round(gbp * 100),
    };
  }

  const monthlyPlan = findMonthlyPlanForProduct(catalogPlan.productId);
  const monthlyGbp = monthlyPlan
    ? lineCost(monthlyPlan)
    : REWARDS_CONFIG.referrerFallbackMonthlyGbp;

  return {
    planId: monthlyPlan?.id ?? catalogPlan.planId,
    amountPence: Math.round(monthlyGbp * 100),
  };
}

export function computeReferrerRewardPence(monthlyEquivalentPence: number) {
  return Math.round(
    monthlyEquivalentPence * REWARDS_CONFIG.referrerRewardPercent,
  );
}

export function computeReferredDiscountPence(monthlyEquivalentPence: number) {
  return Math.round(
    monthlyEquivalentPence * REWARDS_CONFIG.referredDiscountPercent,
  );
}
