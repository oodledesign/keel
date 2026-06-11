'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { isSuperAdmin } from '@kit/admin';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { logAdminAction } from '~/lib/admin/log-admin-action';

import { findPlanByProductAndPlanId } from './keel-plan-catalog';
import { syncAddonModulesFromEntitlements } from './sync-addon-modules-from-entitlements';

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

    await syncAddonModulesFromEntitlements(admin, input.accountId);

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
    revalidatePath('/admin/audit');
    return { success: true };
  },
  { schema: grantEntitlementSchema },
);

export const adminRevokeEntitlementAction = enhanceAction(
  async (input: { accountId: string; entitlementKey: string }) => {
    const { user } = await requireSuperAdmin();
    const admin = getSupabaseServerAdminClient();

    const { error } = await admin
      .from('account_entitlements')
      .delete()
      .eq('account_id', input.accountId)
      .eq('entitlement_key', input.entitlementKey)
      .eq('source', 'admin_grant');

    if (error) {
      throw new Error(error.message);
    }

    await syncAddonModulesFromEntitlements(admin, input.accountId);

    await logAdminAction(admin, {
      actorUserId: user.id,
      action: 'revoke_entitlement',
      targetAccountId: input.accountId,
      metadata: { entitlementKey: input.entitlementKey },
    });

    revalidatePath(`/admin/accounts/${input.accountId}`);
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
        metadata: { productId: plan.productId, planId: plan.planId },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,entitlement_key' },
    );

    await admin.from('account_plan_limits').upsert(
      {
        account_id: input.accountId,
        plan_product_id: plan.productId,
        plan_id: plan.planId,
        plan_family: plan.family,
        max_members: plan.limits.maxMembers,
        max_properties: plan.limits.maxProperties,
        max_videos: plan.limits.maxVideos,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id' },
    );

    await syncAddonModulesFromEntitlements(admin, input.accountId);

    await logAdminAction(admin, {
      actorUserId: user.id,
      action: 'apply_plan_limits',
      targetAccountId: input.accountId,
      metadata: {
        productId: input.productId,
        planId: input.planId,
        entitlementKey: plan.entitlementKey,
      },
    });

    revalidatePath(`/admin/accounts/${input.accountId}`);
    revalidatePath('/admin/audit');
    return { success: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      productId: z.string().min(1),
      planId: z.string().min(1),
    }),
  },
);
