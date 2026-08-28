export type PlatformSubscriptionDiscount = {
  /** Human-readable coupon or promo name. */
  name: string | null;
  percentOff: number | null;
  amountOffMinor: number | null;
  currency: string | null;
  duration: 'forever' | 'once' | 'repeating' | null;
  durationInMonths: number | null;
  /** ISO timestamp when the discount ends, if known. */
  endsAt: string | null;
};
