import type { AccountAccessLevel } from './account-access-matrix';

/**
 * Access when `account_billing` has no lifecycle row yet.
 *
 * Free (lite) workspaces are granted via entitlement, not Stripe. Treating
 * “no subscription” as no_access showed a Billing required banner on valid
 * Free workspaces and after a Starter handoff that never reached Checkout.
 */
export function resolveMissingLifecycleAccess(input: {
  hasActiveSubscription: boolean;
  hasWorkspacePlanEntitlement: boolean;
}): { level: AccountAccessLevel; reason: string } {
  if (input.hasActiveSubscription) {
    return { level: 'full_access', reason: 'legacy_active_subscription' };
  }

  if (input.hasWorkspacePlanEntitlement) {
    return { level: 'full_access', reason: 'workspace_plan_entitlement' };
  }

  return { level: 'no_access', reason: 'no_active_billing' };
}
