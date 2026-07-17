import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { isSuperAdmin } from '@kit/admin';

import {
  type AccountAccessCapability,
  type AccountAccessLevel,
  type AccountWriteCapability,
  accessLevelFromBillingStatus,
  accountAllowsCapability,
} from './account-access-matrix';
import { loadAccountBilling } from './account-billing-lifecycle';
import type {
  AccountBillingRow,
  AccountBillingStatus,
} from './account-billing-types';
import {
  hasActiveWorkspaceSubscription,
  isAccountBillingExempt,
} from './entitlements';

type AnyClient = SupabaseClient<any>;

export type AccountAccessResult = {
  level: AccountAccessLevel;
  status: AccountBillingStatus | null;
  billing: AccountBillingRow | null;
  exempt: boolean;
  reason: string;
};

export { accessLevelFromBillingStatus };

/**
 * Primary feature-gating helper for Ozer SaaS workspaces.
 *
 * Prefer this over reading MakerKit `subscriptions.status` directly for
 * past_due / restricted / suspended behaviour.
 */
export async function checkAccountAccess(
  client: AnyClient,
  accountId: string,
  options?: { userId?: string },
): Promise<AccountAccessResult> {
  const [superAdmin, exempt, billing] = await Promise.all([
    isSuperAdmin(client),
    isAccountBillingExempt(client, accountId),
    loadAccountBilling(client, accountId),
  ]);

  if (superAdmin) {
    return {
      level: 'full_access',
      status: billing?.subscription_status ?? null,
      billing,
      exempt: true,
      reason: 'super_admin',
    };
  }

  if (exempt) {
    return {
      level: 'full_access',
      status: billing?.subscription_status ?? null,
      billing,
      exempt: true,
      reason: 'billing_exempt',
    };
  }

  const fromLifecycle = accessLevelFromBillingStatus(
    billing?.subscription_status,
  );

  if (fromLifecycle) {
    return {
      level: fromLifecycle,
      status: billing!.subscription_status,
      billing,
      exempt: false,
      reason: `account_billing:${billing!.subscription_status}`,
    };
  }

  // No lifecycle row yet — fall back to MakerKit active/trialing subscription.
  const activeSub = await hasActiveWorkspaceSubscription(client, accountId);
  if (activeSub) {
    return {
      level: 'full_access',
      status: null,
      billing,
      exempt: false,
      reason: 'legacy_active_subscription',
    };
  }

  return {
    level: 'no_access',
    status: null,
    billing,
    exempt: false,
    reason: 'no_active_billing',
  };
}

export function accountAccessAllows(
  access: AccountAccessResult,
  capability: AccountAccessCapability,
): boolean {
  return accountAllowsCapability(access.level, capability);
}

export class AccountAccessDeniedError extends Error {
  readonly level: AccountAccessLevel;
  readonly capability: AccountAccessCapability;

  constructor(level: AccountAccessLevel, capability: AccountAccessCapability) {
    super(
      level === 'restricted_access'
        ? 'This workspace is restricted until billing is updated.'
        : 'This workspace does not have an active plan.',
    );
    this.name = 'AccountAccessDeniedError';
    this.level = level;
    this.capability = capability;
  }
}

/**
 * Throw if the account cannot perform a write capability.
 * Use inside server actions / route handlers.
 */
export async function requireAccountCapability(
  client: AnyClient,
  accountId: string,
  capability: AccountAccessCapability,
  options?: { userId?: string },
): Promise<AccountAccessResult> {
  const access = await checkAccountAccess(client, accountId, options);

  if (!accountAccessAllows(access, capability)) {
    throw new AccountAccessDeniedError(access.level, capability);
  }

  return access;
}

export async function requireAccountWriteAccess(
  client: AnyClient,
  accountId: string,
  capability: AccountWriteCapability,
  options?: { userId?: string },
): Promise<AccountAccessResult> {
  return requireAccountCapability(client, accountId, capability, options);
}

/** True when operators may enter the workspace shell (full or restricted). */
export function canEnterWorkspace(access: AccountAccessResult): boolean {
  return access.level === 'full_access' || access.level === 'restricted_access';
}
