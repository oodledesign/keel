/**
 * Ozer SaaS access levels derived from `account_billing.subscription_status`.
 *
 * DRAFT FOR DAN — confirm restricted behaviour before enforcing every capability
 * in server actions. Public / client-facing surfaces are called out as decisions.
 */

import type {
  AccountBillingStatus,
} from './account-billing-types';

export const ACCOUNT_ACCESS_LEVELS = [
  'full_access',
  'restricted_access',
  'no_access',
] as const;

export type AccountAccessLevel = (typeof ACCOUNT_ACCESS_LEVELS)[number];

/**
 * Map Ozer lifecycle status → workspace access level.
 *
 * - trialing / active / past_due_grace → full_access
 * - past_due_restricted → restricted_access
 * - suspended / trial_expired / canceled → no_access
 */
export function accessLevelFromBillingStatus(
  status: AccountBillingStatus | null | undefined,
): AccountAccessLevel | null {
  if (!status) return null;

  switch (status) {
    case 'trialing':
    case 'active':
    case 'past_due_grace':
      return 'full_access';
    case 'past_due_restricted':
      return 'restricted_access';
    case 'suspended':
    case 'trial_expired':
    case 'canceled':
      return 'no_access';
    default:
      return null;
  }
}

/**
 * Capabilities we gate (or plan to gate) with checkAccountAccess.
 * Values: allowed | blocked | decision (default stays live until Dan confirms).
 */
export const ACCOUNT_ACCESS_CAPABILITIES = [
  'view_workspace',
  'view_existing_data',
  'create_clients',
  'edit_clients',
  'create_projects',
  'edit_projects',
  'create_tasks',
  'edit_tasks',
  'create_invoices',
  'edit_invoices',
  'create_proposals',
  'create_contracts',
  'create_bookings',
  'edit_schedule',
  'view_schedule',
  'ai_assistant_sync',
  'email_assistant_sync',
  'addon_mutations',
  'manage_billing',
  /** Client-facing public booking pages (`/book/...`). */
  'public_booking_pages',
  /** Authenticated client portal (`/portal/...`). */
  'client_portal',
] as const;

export type AccountAccessCapability =
  (typeof ACCOUNT_ACCESS_CAPABILITIES)[number];

export type CapabilityPolicy = 'allowed' | 'blocked' | 'decision';

/**
 * Restricted-mode draft (past_due_restricted).
 *
 * Intent: operators keep visibility; create/edit money + scheduling lock;
 * client-facing booking stays up by default so Aimee's clients are not
 * disrupted — flag as decision rather than assuming forever.
 */
export const RESTRICTED_ACCESS_POLICY: Record<
  AccountAccessCapability,
  CapabilityPolicy
> = {
  view_workspace: 'allowed',
  view_existing_data: 'allowed',
  view_schedule: 'allowed',

  create_clients: 'blocked',
  edit_clients: 'blocked',
  create_projects: 'blocked',
  edit_projects: 'blocked',
  create_tasks: 'blocked',
  edit_tasks: 'blocked',

  create_invoices: 'blocked',
  edit_invoices: 'blocked',
  create_proposals: 'blocked',
  create_contracts: 'blocked',

  create_bookings: 'blocked',
  edit_schedule: 'blocked',

  ai_assistant_sync: 'blocked',
  email_assistant_sync: 'blocked',
  addon_mutations: 'blocked',

  manage_billing: 'allowed',

  // DECISION: keep live during past_due_restricted so clients are unaffected.
  // Confirm with Dan before changing to blocked.
  public_booking_pages: 'decision',
  client_portal: 'decision',
};

/** Capabilities treated as "write" for requireAccountWriteAccess. */
export const ACCOUNT_WRITE_CAPABILITIES = [
  'create_clients',
  'edit_clients',
  'create_projects',
  'edit_projects',
  'create_tasks',
  'edit_tasks',
  'create_invoices',
  'edit_invoices',
  'create_proposals',
  'create_contracts',
  'create_bookings',
  'edit_schedule',
  'ai_assistant_sync',
  'email_assistant_sync',
  'addon_mutations',
] as const satisfies readonly AccountAccessCapability[];

export type AccountWriteCapability =
  (typeof ACCOUNT_WRITE_CAPABILITIES)[number];

export function policyForAccess(
  level: AccountAccessLevel,
  capability: AccountAccessCapability,
): CapabilityPolicy {
  if (level === 'full_access') {
    return 'allowed';
  }

  if (level === 'no_access') {
    if (capability === 'manage_billing') return 'allowed';
    // Same decision defaults as restricted for public surfaces.
    if (
      capability === 'public_booking_pages' ||
      capability === 'client_portal'
    ) {
      return RESTRICTED_ACCESS_POLICY[capability];
    }
    return 'blocked';
  }

  // restricted_access
  return RESTRICTED_ACCESS_POLICY[capability];
}

/**
 * Whether a capability is currently permitted.
 * `decision` policies default to allowed until Dan flips them.
 */
export function accountAllowsCapability(
  level: AccountAccessLevel,
  capability: AccountAccessCapability,
  options?: { treatDecisionAs?: 'allowed' | 'blocked' },
): boolean {
  const policy = policyForAccess(level, capability);
  if (policy === 'decision') {
    return (options?.treatDecisionAs ?? 'allowed') === 'allowed';
  }
  return policy === 'allowed';
}
