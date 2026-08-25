'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { isSuperAdmin } from '@kit/admin';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { logAdminAction } from '~/lib/admin/log-admin-action';

import { applyAdminPlanUsageGrants } from './apply-admin-plan-usage-grants';
import { findPlanByProductAndPlanId } from './ozer-plan-catalog';
import { syncAddonModulesFromEntitlements } from './sync-addon-modules-from-entitlements';
import {
  ensureEstablishedWorkspaceMembersOnboarded,
  syncWorkspaceStateAfterAdminGrant,
  syncWorkspaceStateAfterAdminPlan,
} from './sync-workspace-from-admin-grant';

const grantEntitlementSchema = z.object({
  accountId: z.string().uuid(),
  entitlementKey: z.string().min(1),
  expiresAt: z.string().datetime().optional().nullable(),
});

const billingExemptSchema = z.object({
  accountId: z.string().uuid(),
  exempt: z.boolean(),
  reason: z.string().max(500).optional(),
});

async function requireSuperAdmin() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error('Authentication required');
  }

  if (!(await isSuperAdmin(client))) {
    throw new Error('Super admin access required');
  }

  return { client, user };
}

export const adminGrantEntitlementAction = enhanceAction(
  async (input) => {
    const { user } = await requireSuperAdmin();
    const admin = getSupabaseServerAdminClient();

    const { error } = await admin.from('account_entitlements').upsert(
      {
        account_id: input.accountId,
        entitlement_key: input.entitlementKey,
        source: 'admin_grant',
        granted_by: user.id,
        expires_at: input.expiresAt ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,entitlement_key' },
    );

    if (error) {
      throw new Error(error.message);
    }

    await syncWorkspaceStateAfterAdminGrant(
      admin,
      input.accountId,
      input.entitlementKey,
    );

    await logAdminAction(admin, {
      actorUserId: user.id,
      action: 'grant_entitlement',
      targetAccountId: input.accountId,
      metadata: {
        entitlementKey: input.entitlementKey,
        expiresAt: input.expiresAt ?? null,
      },
    });

    revalidatePath(`/admin/accounts/${input.accountId}`);
    revalidatePath(`/admin/workspaces/${input.accountId}`);
    revalidatePath('/admin/workspaces');
    revalidatePath('/admin/audit');
    return { success: true };
  },
  { schema: grantEntitlementSchema },
);

export const adminRevokeEntitlementAction = enhanceAction(
  async (input: { accountId: string; entitlementKey: string }) => {
    const { user } = await requireSuperAdmin();
    const admin = getSupabaseServerAdminClient();

    // Allow revoking admin/onboard grants. Stripe-managed rows stay until
    // the subscription webhook clears them.
    const { data: existing, error: lookupError } = await admin
      .from('account_entitlements')
      .select('source')
      .eq('account_id', input.accountId)
      .eq('entitlement_key', input.entitlementKey)
      .maybeSingle();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (!existing) {
      throw new Error('Entitlement not found');
    }

    if (existing.source === 'stripe') {
      throw new Error(
        'This entitlement is managed by Stripe. Cancel or change the subscription instead.',
      );
    }

    const { error } = await admin
      .from('account_entitlements')
      .delete()
      .eq('account_id', input.accountId)
      .eq('entitlement_key', input.entitlementKey)
      .neq('source', 'stripe');

    if (error) {
      throw new Error(error.message);
    }

    if (input.entitlementKey === 'workspace_business_lite') {
      await admin
        .from('businesses')
        .update({ type: 'other' })
        .eq('account_id', input.accountId)
        .eq('type', 'lite');

      await admin.from('account_module_settings').upsert(
        {
          account_id: input.accountId,
          module_key: 'apps',
          enabled: false,
        },
        { onConflict: 'account_id,module_key' },
      );
    }

    await syncAddonModulesFromEntitlements(admin, input.accountId);

    await logAdminAction(admin, {
      actorUserId: user.id,
      action: 'revoke_entitlement',
      targetAccountId: input.accountId,
      metadata: {
        entitlementKey: input.entitlementKey,
        previousSource: existing.source,
      },
    });

    revalidatePath(`/admin/accounts/${input.accountId}`);
    revalidatePath(`/admin/workspaces/${input.accountId}`);
    revalidatePath('/admin/workspaces');
    revalidatePath('/admin/audit');
    return { success: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      entitlementKey: z.string().min(1),
    }),
  },
);

export const adminSetBillingExemptAction = enhanceAction(
  async (input) => {
    const { user } = await requireSuperAdmin();
    const admin = getSupabaseServerAdminClient();

    if (input.exempt) {
      const { error } = await admin.from('account_billing_exempt').upsert(
        {
          account_id: input.accountId,
          reason: input.reason ?? 'Admin grant',
          granted_by: user.id,
        },
        { onConflict: 'account_id' },
      );
      if (error) throw new Error(error.message);
      await ensureEstablishedWorkspaceMembersOnboarded(admin, input.accountId);
    } else {
      const { error } = await admin
        .from('account_billing_exempt')
        .delete()
        .eq('account_id', input.accountId);
      if (error) throw new Error(error.message);
    }

    await logAdminAction(admin, {
      actorUserId: user.id,
      action: input.exempt ? 'set_billing_exempt' : 'clear_billing_exempt',
      targetAccountId: input.accountId,
      metadata: { reason: input.reason ?? null },
    });

    revalidatePath(`/admin/accounts/${input.accountId}`);
    revalidatePath(`/admin/workspaces/${input.accountId}`);
    revalidatePath('/admin/workspaces');
    revalidatePath('/admin/audit');
    return { success: true };
  },
  { schema: billingExemptSchema },
);

export const adminApplyPlanLimitsAction = enhanceAction(
  async (input: {
    accountId: string;
    productId: string;
    planId: string;
    billableSeats?: number;
  }) => {
    const { user } = await requireSuperAdmin();
    const admin = getSupabaseServerAdminClient();

    const plan = findPlanByProductAndPlanId(input.productId, input.planId);
    if (!plan) {
      throw new Error('Unknown plan');
    }

    await admin.from('account_entitlements').upsert(
      {
        account_id: input.accountId,
        entitlement_key: plan.entitlementKey,
        source: 'admin_grant',
        metadata: {
          productId: plan.productId,
          planId: plan.planId,
          billableSeats: input.billableSeats ?? null,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,entitlement_key' },
    );

    let maxMembers = plan.limits.maxMembers;
    let maxProjectGuests: number | null = null;

    if (plan.family === 'business') {
      const { maxMembersForBillableSeats, maxProjectGuestsForBillableSeats } =
        await import('~/lib/billing/business-graduated-pricing');
      const seats = Math.max(1, input.billableSeats ?? 1);
      maxMembers = maxMembersForBillableSeats(seats);
      maxProjectGuests = maxProjectGuestsForBillableSeats(seats);
    } else if (plan.family === 'business_lite') {
      maxProjectGuests = 1;
    } else if (plan.family === 'commercial_property') {
      const { maxMembersForBillableSeats } =
        await import('~/lib/billing/commercial-graduated-pricing');
      maxMembers =
        plan.limits.maxMembers ??
        maxMembersForBillableSeats(Math.max(1, input.billableSeats ?? 4));
    }

    await admin.from('account_plan_limits').upsert(
      {
        account_id: input.accountId,
        plan_product_id: plan.productId,
        plan_id: plan.planId,
        plan_family: plan.family,
        max_members: maxMembers,
        max_properties: plan.limits.maxProperties,
        max_videos: plan.limits.maxVideos,
        max_project_guests: maxProjectGuests,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'account_id' },
    );

    await syncWorkspaceStateAfterAdminPlan(admin, input.accountId, plan);

    const usage = await applyAdminPlanUsageGrants(admin, input.accountId, plan);

    await logAdminAction(admin, {
      actorUserId: user.id,
      action: 'apply_plan_limits',
      targetAccountId: input.accountId,
      metadata: {
        productId: input.productId,
        planId: input.planId,
        billableSeats: input.billableSeats ?? null,
        entitlementKey: plan.entitlementKey,
        aiCreditsGranted: usage.aiCredits,
        mediaUnitsGranted: usage.mediaUnits,
      },
    });

    revalidatePath(`/admin/accounts/${input.accountId}`);
    revalidatePath(`/admin/workspaces/${input.accountId}`);
    revalidatePath('/admin/workspaces');
    revalidatePath('/admin/audit');
    return {
      success: true,
      aiCreditsGranted: usage.aiCredits,
      mediaUnitsGranted: usage.mediaUnits,
    };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      productId: z.string().min(1),
      planId: z.string().min(1),
      billableSeats: z.number().int().min(1).max(200).optional(),
    }),
  },
);
