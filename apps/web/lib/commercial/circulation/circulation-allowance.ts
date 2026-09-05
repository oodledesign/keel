/**
 * Commercial circulation is NOT billed from campaign_credit_pools.
 * This stub is display-only until a dedicated Stripe product exists.
 */
export const CIRCULATION_COMMERCIAL_STUB = {
  maxContacts: 250,
  sendUnitsPerMonth: 1000,
  note: 'Separate from Campaigns send units. Do not merge pools.',
} as const;
