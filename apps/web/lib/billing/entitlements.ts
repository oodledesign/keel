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
  max_project_guests?: number | null;
  pending_billable_seats?: number | null;
  pending_seats_effective_at?: string | null;
  max_active_clients?: number | null;
  max_invoices_per_month?: number | null;
  max_open_tasks?: number | null;
  max_bookings_per_month?: number | null;
  max_portal_storage_bytes?: number | null;
  /**
   * Unused for platform pricing. Businesses manage their own client-request
   * library — not an Ozer-billed monthly pile. NULL = unset / not sold.
   */
  client_request_credit_allowance?: number | null;
  meeting_coaching_enabled?: boolean;
};

const ACTIVE_SUB_STATUSES = new Set(['active', 'trialing']);

export async function loadAccountPlanLimits(
  client: SupabaseClient,
  accountId: string,
): Promise<AccountPlanLimitsRow | null> {
  const { data, error } = await (
    client as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            maybeSingle: () => Promise<{
              data: AccountPlanLimitsRow | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from('account_plan_limits')
    .select(
      'account_id, plan_product_id, plan_id, plan_family, max_members, max_properties, max_videos, max_project_guests, pending_billable_seats, pending_seats_effective_at, max_active_clients, max_invoices_per_month, max_open_tasks, max_bookings_per_month, max_portal_storage_bytes, client_request_credit_allowance, meeting_coaching_enabled',
    )
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    console.error('[billing] loadAccountPlanLimits:', error.message);
    return null;
  }

  return data ?? null;
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
    businessStarterEntitlement,
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
    profile === 'work_design'
      ? client
          .from('account_entitlements')
          .select('id')
          .eq('account_id', accountId)
          .eq('entitlement_key', 'workspace_business_starter')
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

  if (profile === 'work_design' && businessStarterEntitlement.data) {
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
  if (process.env.DISABLE_EMAIL_ASSISTANT === 'true') {
    return false;
  }

  const [entitled, connection] = await Promise.all([
    canUseAddon(client, userId, userId, EMAIL_ASSISTANT_ENTITLEMENT),
    client
      .from('google_connections')
      .select('user_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (connection.error) {
    console.error(
      '[billing] canUseEmailAssistant connection check:',
      connection.error.message,
    );
  }

  // Existing connected users keep access even if the add-on entitlement was
  // removed or drifted. New users still need the add-on before connecting.
  return entitled || Boolean(connection.data);
}

export type MemberSeatUsage = {
  memberCount: number;
  pendingInviteCount: number;
  used: number;
  maxMembers: number | null;
  remaining: number | null;
  unlimited: boolean;
};

/**
 * Seat usage for workspace member limits.
 * Pending invitations count toward used seats so leftover invites stay accurate.
 */
export async function getMemberSeatUsage(
  client: SupabaseClient,
  accountId: string,
): Promise<MemberSeatUsage> {
  const exempt = await isAccountBillingExempt(client, accountId);

  const [membersResult, invitesResult, limits] = await Promise.all([
    client
      .from('accounts_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .neq('seat_kind', 'platform'),
    client
      .from('invitations')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .neq('seat_kind', 'platform'),
    exempt ? Promise.resolve(null) : loadAccountPlanLimits(client, accountId),
  ]);

  if (membersResult.error) {
    console.error(
      '[billing] getMemberSeatUsage members:',
      membersResult.error.message,
    );
  }

  if (invitesResult.error) {
    console.error(
      '[billing] getMemberSeatUsage invites:',
      invitesResult.error.message,
    );
  }

  const memberCount = membersResult.count ?? 0;
  const pendingInviteCount = invitesResult.count ?? 0;
  const used = memberCount + pendingInviteCount;
  const maxMembers = exempt ? null : (limits?.max_members ?? null);
  const unlimited = maxMembers == null;

  return {
    memberCount,
    pendingInviteCount,
    used,
    maxMembers,
    remaining:
      unlimited || maxMembers == null ? null : Math.max(0, maxMembers - used),
    unlimited,
  };
}

export async function assertMemberInviteAllowed(
  client: SupabaseClient,
  accountId: string,
  invitationsToSend: number,
  options?: {
    seatKinds?: Array<'billable' | 'support'>;
  },
): Promise<{ allowed: boolean; reason?: string }> {
  const { data: account } = await client
    .from('accounts')
    .select('space_type')
    .eq('id', accountId)
    .maybeSingle();

  const spaceType = (account as { space_type?: string | null } | null)
    ?.space_type;
  const isCommercial = spaceType === 'commercial-property';

  if (isCommercial) {
    const { getCommercialSeatBreakdown } =
      await import('~/lib/commercial/commercial-seat-access');
    const breakdown = await getCommercialSeatBreakdown(client, accountId);
    const kinds =
      options?.seatKinds ??
      Array.from({ length: invitationsToSend }, () => 'billable' as const);

    const newBillable = kinds.filter((k) => k !== 'support').length;
    const newSupport = kinds.filter((k) => k === 'support').length;

    if (newSupport > 0) {
      const supportRemaining = Math.max(
        0,
        breakdown.supportAllowance - breakdown.supportCount,
      );
      if (newSupport > supportRemaining) {
        return {
          allowed: false,
          reason: `Your plan includes ${breakdown.supportAllowance} free support seat${breakdown.supportAllowance === 1 ? '' : 's'}. ${supportRemaining} remaining.`,
        };
      }
    }

    if (newBillable > 0) {
      // Billable invites bump Stripe quantity on accept; soft-cap at 200.
      const projectedBillable = breakdown.billableCount + newBillable;
      if (projectedBillable > 200) {
        return {
          allowed: false,
          reason: 'Billable seat limit reached for this workspace.',
        };
      }
    }

    return { allowed: true };
  }

  const usage = await getMemberSeatUsage(client, accountId);

  if (usage.unlimited || usage.maxMembers == null) {
    return { allowed: true };
  }

  const remaining = Math.max(0, usage.maxMembers - usage.used);
  const exceedsLimit =
    invitationsToSend === 0 ? remaining === 0 : invitationsToSend > remaining;

  if (exceedsLimit) {
    return {
      allowed: false,
      reason: `Your plan allows up to ${usage.maxMembers} team members. Upgrade your plan to invite more people.`,
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

/**
 * Unused platform quota. NULL means unset / not sold — do not treat as unlimited
 * and do not invent a marketing allotment.
 */
export function clientRequestCreditAllowance(
  limits: AccountPlanLimitsRow | null | undefined,
): number {
  return limits?.client_request_credit_allowance ?? 0;
}

export type { OzerPlanDefinition };
