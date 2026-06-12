import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { markBusinessUpgradedFromLite } from './business-lite';
import type { KeelPlanDefinition } from './keel-plan-catalog';
import { syncAddonModulesFromEntitlements } from './sync-addon-modules-from-entitlements';
import {
  syncBusinessLiteModules,
  syncFullBusinessModules,
} from './sync-workspace-modules-from-plan';

/**
 * Established workspaces (business row exists) should not send members back to /setup
 * when an admin grant updates entitlements.
 */
export async function ensureEstablishedWorkspaceMembersOnboarded(
  admin: SupabaseClient,
  accountId: string,
): Promise<void> {
  const { data: business } = await admin
    .from('businesses')
    .select('id')
    .eq('account_id', accountId)
    .limit(1)
    .maybeSingle();

  if (!business) {
    return;
  }

  const { error } = await admin
    .from('accounts_memberships')
    .update({ onboarding_completed: true })
    .eq('account_id', accountId)
    .eq('onboarding_completed', false);

  if (error) {
    console.error(
      '[admin-grant] ensureEstablishedWorkspaceMembersOnboarded:',
      error.message,
    );
  }
}

/** Mirror Stripe webhook module sync when a super admin grants workspace/add-on access. */
export async function syncWorkspaceStateAfterAdminGrant(
  admin: SupabaseClient,
  accountId: string,
  entitlementKey: string,
): Promise<void> {
  switch (entitlementKey) {
    case 'workspace_business':
      await markBusinessUpgradedFromLite(admin, accountId);
      await syncFullBusinessModules(admin, accountId);
      break;
    case 'workspace_business_lite':
      await syncBusinessLiteModules(admin, accountId);
      break;
    default:
      await syncAddonModulesFromEntitlements(admin, accountId);
      break;
  }

  await ensureEstablishedWorkspaceMembersOnboarded(admin, accountId);
}

export async function syncWorkspaceStateAfterAdminPlan(
  admin: SupabaseClient,
  accountId: string,
  plan: KeelPlanDefinition,
): Promise<void> {
  if (plan.family === 'business') {
    await markBusinessUpgradedFromLite(admin, accountId);
    await syncFullBusinessModules(admin, accountId);
  } else if (plan.family === 'business_lite') {
    await syncBusinessLiteModules(admin, accountId);
  } else {
    await syncAddonModulesFromEntitlements(admin, accountId);
  }

  await ensureEstablishedWorkspaceMembersOnboarded(admin, accountId);
}
