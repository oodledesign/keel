import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { COMMERCIAL_PROPERTY_WORKSPACE_MODULE_ORDER } from '~/config/workspace-module-order';

import { markBusinessUpgradedFromLite } from './business-lite';
import {
  type OzerPlanDefinition,
  findPlanByProductAndPlanId,
} from './ozer-plan-catalog';
import { syncAddonModulesFromEntitlements } from './sync-addon-modules-from-entitlements';
import {
  syncBusinessLiteModules,
  syncFullBusinessModules,
} from './sync-workspace-modules-from-plan';

/**
 * Team workspaces should not send members back to /setup when an admin
 * grant updates entitlements or converts workspace type.
 */
export async function ensureEstablishedWorkspaceMembersOnboarded(
  admin: SupabaseClient,
  accountId: string,
): Promise<void> {
  const { data: account } = await admin
    .from('accounts')
    .select('id, is_personal_account')
    .eq('id', accountId)
    .maybeSingle();

  if (!account || account.is_personal_account) {
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

async function setModuleEnabled(
  admin: SupabaseClient,
  accountId: string,
  moduleKey: string,
  enabled: boolean,
) {
  await admin.from('account_module_settings').upsert(
    {
      account_id: accountId,
      module_key: moduleKey,
      enabled,
    },
    { onConflict: 'account_id,module_key' },
  );
}

/** Switch a team account to commercial-property space + seed agency modules. */
export async function convertAccountToCommercialProperty(
  admin: SupabaseClient,
  accountId: string,
): Promise<void> {
  const { data: account, error: accountError } = await admin
    .from('accounts')
    .select('id, is_personal_account')
    .eq('id', accountId)
    .maybeSingle();

  if (accountError) {
    throw new Error(accountError.message);
  }
  if (!account || account.is_personal_account) {
    throw new Error(
      'Commercial Property can only be granted to team workspaces',
    );
  }

  const { error: spaceError } = await admin
    .from('accounts')
    .update({ space_type: 'commercial-property' })
    .eq('id', accountId);

  if (spaceError) {
    throw new Error(spaceError.message);
  }

  for (const moduleKey of COMMERCIAL_PROPERTY_WORKSPACE_MODULE_ORDER) {
    await setModuleEnabled(admin, accountId, moduleKey, true);
  }
}

async function ensureCommercialPropertyPlanLimits(
  admin: SupabaseClient,
  accountId: string,
  plan?: OzerPlanDefinition,
): Promise<void> {
  const resolved =
    plan ??
    findPlanByProductAndPlanId(
      'ozer-commercial-property-team',
      'commercial-property-team-monthly',
    );

  if (!resolved) return;

  await admin.from('account_plan_limits').upsert(
    {
      account_id: accountId,
      plan_product_id: resolved.productId,
      plan_id: resolved.planId,
      plan_family: resolved.family,
      max_members: resolved.limits.maxMembers,
      max_properties: resolved.limits.maxProperties,
      max_videos: resolved.limits.maxVideos,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'account_id' },
  );
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
    case 'workspace_commercial_property':
      await convertAccountToCommercialProperty(admin, accountId);
      await ensureCommercialPropertyPlanLimits(admin, accountId);
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
  plan: OzerPlanDefinition,
): Promise<void> {
  if (plan.family === 'business') {
    await markBusinessUpgradedFromLite(admin, accountId);
    await syncFullBusinessModules(admin, accountId);
  } else if (plan.family === 'business_lite') {
    await syncBusinessLiteModules(admin, accountId);
  } else if (plan.family === 'commercial_property') {
    await convertAccountToCommercialProperty(admin, accountId);
    await ensureCommercialPropertyPlanLimits(admin, accountId, plan);
  } else {
    await syncAddonModulesFromEntitlements(admin, accountId);
  }

  await ensureEstablishedWorkspaceMembersOnboarded(admin, accountId);
}
