import 'server-only';

import type { AccountBillingStatus } from './account-billing-types';

/** Statuses that recover to `active` on successful invoice payment. */
export const BILLING_RECOVERY_STATUSES = [
  'past_due_grace',
  'past_due_restricted',
  'suspended',
  'trial_expired',
] as const satisfies readonly AccountBillingStatus[];

export type BillingRecoveryStatus = (typeof BILLING_RECOVERY_STATUSES)[number];

export function isBillingRecoveryStatus(
  status: AccountBillingStatus | null | undefined,
): status is BillingRecoveryStatus {
  return (
    status != null &&
    (BILLING_RECOVERY_STATUSES as readonly string[]).includes(status)
  );
}
