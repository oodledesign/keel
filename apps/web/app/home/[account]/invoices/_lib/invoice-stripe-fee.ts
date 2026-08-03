/**
 * Estimated Stripe card processing fee for invoice Checkout.
 * Used to set application_fee_amount so the platform covers Stripe’s cut.
 * Actual fees vary by card (UK/EEA/intl); this is an estimate only.
 */

export type StripeCardFeeMode = 'pass_to_client' | 'absorb_in_payout';

export const STRIPE_CARD_FEE_MODES = [
  'pass_to_client',
  'absorb_in_payout',
] as const;

export function normalizeStripeCardFeeMode(
  value: string | null | undefined,
): StripeCardFeeMode {
  if (value === 'pass_to_client') return 'pass_to_client';
  return 'absorb_in_payout';
}

/**
 * Estimate fee in minor units (pence/cents).
 * GBP: ~1.5% + 20p (UK consumer cards). Other currencies: ~2.9% + 30 minor units.
 */
export function estimateStripeCardFeePence(
  amountPence: number,
  currency: string,
): number {
  const amount = Math.max(0, Math.floor(amountPence));
  if (amount <= 0) return 0;

  const code = currency.trim().toLowerCase();
  if (code === 'gbp') {
    return Math.round(amount * 0.015) + 20;
  }

  return Math.round(amount * 0.029) + 30;
}

export const CARD_FEE_LINE_ITEM_NAME = 'Card processing fee';

export const PASS_TO_CLIENT_FEE_NOTE =
  'Paying online by card may incur a small processing fee.';

export const PASS_TO_CLIENT_FEE_NOTE_LONG =
  'Paying online by card (Stripe payment link) may incur a small processing fee.';
