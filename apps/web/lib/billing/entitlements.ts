import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { isSuperAdmin } from '@kit/admin';

import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';

import { accessLevelFromBillingStatus } from './account-access-matrix';
import { loadAccountBilling } from './account-billing-lifecycle';
import {
  EMAIL_ASSISTANT_ENTITLEMENT,
  type OzerAddonKey,
  type OzerPersonalAddonKey,
  type OzerPlanDefinition,
  findPlanByStripePriceId,
  requiredEntitlementForProfile,
} from './ozer-plan-catalog';

export type AccountPlanLimitsRow = {
  account_id: string;
  plan_product_id: string | null;
  plan_id: string | null;
  plan_family: string | null;
  max_members: number | null;
  max_properties: number | null;
  max_videos: number | null;
};

const ACTIVE_SUB_STATUSES = new Set(['active', 'trialing']);

export async function loadAccountPlanLimits(
  client: SupabaseClient,
  accountId: string,
): Promise<AccountPlanLimitsRow | null> {
  const { data, error } = await client
    .from('account_plan_limits')
    .select(
      'account_id, plan_product_id, plan_id, plan_family, max_members, max_properties, max_videos',
    )
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    console.error('[billing] loadAccountPlanLimits:', error.message);
    return null;
  }

  return (data as AccountPlanLimitsRow | null) ?? null;
}

export async function isAccountBillingExempt(
  client: SupabaseClient,
  accountId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('account_billing_exempt')
    .select('account_id')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    console.error('[billing] isAccountBillingExempt:', error.message);
    return false;
  }

  return Boolean(data);
}

export async function hasEntitlement(
  client: SupabaseClient,
  accountId: string,
  entitlementKey: string,
): Promise<boolean> {
  const now = new Date().toISOString();

  const { data, error } = await client
    .from('account_entitlements')
    .select('id')
    .eq('account_id', accountId)
    .eq('entitlement_key', entitlementKey)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .maybeSingle();

  if (error) {
    console.error('[billing] hasEntitlement:', error.message);
    return false;
  }

  return Boolean(data);
}

export async function hasActiveWorkspaceSubscription(
  client: SupabaseClient,
  accountId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('subscriptions')
    .select('status')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return ACTIVE_SUB_STATUSES.has(
    String((data as { status?: string }).status ?? ''),
  );
}

export async function canAccessPaidWorkspace(
  client: SupabaseClient,
  userId: string,
  accountId: string,
  profile: WorkspaceProfile,
): Promise<boolean> {
  const required = requiredEntitlementForProfile(profile);
  if (!required) {
    return true;
  }

  const now = new Date().toISOString();

  const [
    superAdmin,
    billingExempt,
    entitlement,
    businessLiteEntitlement,
    billing,
    subscription,
  ] = await Promise.all([
    isSuperAdmin(client),
    isAccountBillingExempt(client, accountId),
    client
      .from('account_entitlements')
      .select('id')
      .eq('account_id', accountId)
      .eq('entitlement_key', required)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .maybeSingle(),
    profile === 'work_design'
      ? client
          .from('account_entitlements')
          .select('id')
          .eq('account_id', accountId)
          .eq('entitlement_key', 'workspace_business_lite')
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    loadAccountBilling(client, accountId),
    client
      .from('subscriptions')
      .select('status')
      .eq('account_id', accountId)
      .maybeSingle(),
  ]);

  if (superAdmin || billingExempt) {
    return true;
  }

  // Lifecycle row wins when present (grace = full, restricted = enter, suspended = block).
  const lifecycleLevel = accessLevelFromBillingStatus(
    billing?.subscription_status,
  );
  if (
    lifecycleLevel === 'full_access' ||
    lifecycleLevel === 'restricted_access'
  ) {
    return true;
  }
  if (lifecycleLevel === 'no_access') {
    return false;
  }

  if (entitlement.data) {
    return true;
  }

  if (profile === 'work_design' && businessLiteEntitlement.data) {
    return true;
  }

  if (subscription.error || !subscription.data) {
    return false;
  }

  return ACTIVE_SUB_STATUSES.has(
    String((subscription.data as { status?: string }).status ?? ''),
  );
}

export async function canUseAddon(
  client: SupabaseClient,
  userId: string,
  accountId: string,
  addonKey: OzerAddonKey | OzerPersonalAddonKey,
): Promise<boolean> {
  if (await isSuperAdmin(client)) {
    return true;
  }

  if (await isAccountBillingExempt(client, accountId)) {
    return true;
  }

  if (await hasEntitlement(client, accountId, addonKey)) {
    return true;
  }

  const { data: subs } = await client
    .from('subscriptions')
    .select('id, status, items: subscription_items(variant_id)')
    .eq('account_id', accountId);

  for (const sub of subs ?? []) {
    if (
      !ACTIVE_SUB_STATUSES.has(
        String((sub as { status?: string }).status ?? ''),
      )
    ) {
      continue;
    }

    const items =
      (sub as { items?: Array<{ variant_id?: string }> }).items ?? [];

    for (const row of items) {
      const variantId = row.variant_id;
      if (!variantId) continue;
      const plan = findPlanByStripePriceId(variantId);
      if (plan?.entitlementKey === addonKey) {
        return true;
      }
    }
  }

  return false;
}

/** Personal Gmail assistant — entitlement lives on the personal account (same id as user). */
export async function canUseEmailAssistant(
  client: SupabaseClient,
  userId: string,
): Promise<boolean> {
  return canUseAddon(client, userId, userId, EMAIL_ASSISTANT_ENTITLEMENT);
}

export async function assertMemberInviteAllowed(
  client: SupabaseClient,
  accountId: string,
  currentMemberCount: number,
  invitationsToSend: number,
): Promise<{ allowed: boolean; reason?: string }> {
  if (await isAccountBillingExempt(client, accountId)) {
    return { allowed: true };
  }

  const limits = await loadAccountPlanLimits(client, accountId);
  const maxMembers = limits?.max_members;

  if (maxMembers == null) {
    return { allowed: true };
  }

  const projected = currentMemberCount + invitationsToSend;
  if (projected > maxMembers) {
    return {
      allowed: false,
      reason: `Your plan allows up to ${maxMembers} team members. Upgrade your plan to invite more people.`,
    };
  }

  return { allowed: true };
}

export async function assertPropertyCreateAllowed(
  client: SupabaseClient,
  accountId: string,
  currentPropertyCount: number,
): Promise<{ allowed: boolean; reason?: string }> {
  if (await isAccountBillingExempt(client, accountId)) {
    return { allowed: true };
  }

  const limits = await loadAccountPlanLimits(client, accountId);
  const maxProperties = limits?.max_properties;

  if (maxProperties == null) {
    return { allowed: true };
  }

  if (currentPropertyCount >= maxProperties) {
    return {
      allowed: false,
      reason: `Your plan includes up to ${maxProperties} properties. Upgrade to add more.`,
    };
  }

  return { allowed: true };
}

export async function assertVideoCreateAllowed(
  client: SupabaseClient,
  accountId: string,
  currentVideoCount: number,
): Promise<{ allowed: boolean; reason?: string }> {
  if (await isAccountBillingExempt(client, accountId)) {
    return { allowed: true };
  }

  const limits = await loadAccountPlanLimits(client, accountId);
  const maxVideos = limits?.max_videos;

  if (maxVideos == null) {
    return { allowed: true };
  }

  if (currentVideoCount >= maxVideos) {
    return {
      allowed: false,
      reason: `Your Videos plan includes up to ${maxVideos} videos. Upgrade to add more.`,
    };
  }

  return { allowed: true };
}

export type { OzerPlanDefinition };
