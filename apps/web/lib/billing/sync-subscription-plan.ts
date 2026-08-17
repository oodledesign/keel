import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { UpsertSubscriptionParams } from '@kit/billing/types';

import { syncAccountCreditLimit } from '~/lib/ai/tiers';

import {
  maxMembersForBillableSeats as businessMaxMembersForBillableSeats,
  maxProjectGuestsForBillableSeats,
  clampBillableSeats as clampBusinessBillableSeats,
} from './business-graduated-pricing';
import { markBusinessUpgradedFromLite } from './business-lite';
import {
  maxMembersForBillableSeats as commercialMaxMembersForBillableSeats,
  clampBillableSeats as clampCommercialBillableSeats,
} from './commercial-graduated-pricing';
import { findPlanByStripePriceId } from './ozer-plan-catalog';
import { syncAddonModulesFromEntitlements } from './sync-addon-modules-from-entitlements';
import { syncFullBusinessModules } from './sync-workspace-modules-from-plan';

/**
 * After Stripe webhook upserts a subscription, sync Ozer entitlements and plan limits.
 */
export async function syncKeelPlanFromSubscription(
  admin: SupabaseClient,
  subscription: UpsertSubscriptionParams,
): Promise<void> {
  const accountId = subscription.target_account_id;
  const subscriptionId = subscription.target_subscription_id;

  if (!accountId || !subscriptionId) {
    return;
  }

  const active =
    subscription.status === 'active' || subscription.status === 'trialing';

  if (!active) {
    await admin
      .from('account_entitlements')
      .delete()
      .eq('account_id', accountId)
      .eq('stripe_subscription_id', subscriptionId);

    const items = subscription.line_items ?? [];
    const hadWorkspacePlan = items.some((item) => {
      const plan = findPlanByStripePriceId(item.variant_id);
      return Boolean(plan?.workspaceProfiles?.length);
    });

    if (hadWorkspacePlan) {
      await admin
        .from('account_plan_limits')
        .delete()
        .eq('account_id', accountId);
    } else {
      const hadVideosAddon = items.some((item) => {
        const plan = findPlanByStripePriceId(item.variant_id);
        return plan?.family === 'addon_videos';
      });

      if (hadVideosAddon) {
        const { data: remainingVideos } = await admin
          .from('account_entitlements')
          .select('metadata')
          .eq('account_id', accountId)
          .eq('entitlement_key', 'addon_videos');

        if (!remainingVideos?.length) {
          await admin
            .from('account_plan_limits')
            .update({
              max_videos: null,
              updated_at: new Date().toISOString(),
            })
            .eq('account_id', accountId);
        }
      }
    }

    await syncAddonModulesFromEntitlements(admin, accountId);
    return;
  }

  const items = subscription.line_items ?? [];
  let workspacePlanSynced = false;

  for (const item of items) {
    const variantId = item.variant_id;
    if (!variantId) continue;

    const plan = findPlanByStripePriceId(variantId);
    if (!plan) continue;

    await admin.from('account_entitlements').upsert(
      {
        account_id: accountId,
        entitlement_key: plan.entitlementKey,
        source: 'stripe',
        stripe_subscription_id: subscriptionId,
        stripe_variant_id: variantId,
        metadata: {
          productId: plan.productId,
          planId: plan.planId,
          family: plan.family,
          limits: {
            maxMailboxes: plan.limits.maxMailboxes ?? null,
          },
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,entitlement_key' },
    );

    if (plan.workspaceProfiles?.length) {
      const isGraduatedBusiness = plan.family === 'business';
      const isCommercial = plan.family === 'commercial_property';
      const billableQuantity =
        isGraduatedBusiness || isCommercial
          ? (isCommercial
              ? clampCommercialBillableSeats
              : clampBusinessBillableSeats)(item.quantity ?? 1)
          : null;

      let maxMembers = plan.limits.maxMembers;
      let maxProjectGuests: number | null = null;

      if (billableQuantity != null && isCommercial) {
        maxMembers = commercialMaxMembersForBillableSeats(billableQuantity);
      } else if (billableQuantity != null && isGraduatedBusiness) {
        maxMembers = businessMaxMembersForBillableSeats(billableQuantity);
        maxProjectGuests = maxProjectGuestsForBillableSeats(billableQuantity);
      } else if (plan.family === 'business_lite') {
        maxProjectGuests = 1;
      }

      await admin.from('account_plan_limits').upsert(
        {
          account_id: accountId,
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
      workspacePlanSynced = true;

      if (plan.family === 'business') {
        await markBusinessUpgradedFromLite(admin, accountId);
        await syncFullBusinessModules(admin, accountId);
      }

      if (
        plan.family === 'business' ||
        plan.family === 'business_lite' ||
        plan.family === 'commercial_property'
      ) {
        const previousLimitRow = await admin
          .from('ai_credit_balances')
          .select('credits_monthly_limit')
          .eq('account_id', accountId)
          .maybeSingle();
        const previousLimit =
          (
            previousLimitRow.data as {
              credits_monthly_limit?: number;
            } | null
          )?.credits_monthly_limit ?? null;

        // Business seat bumps: raise limit + grant delta (refillRemaining false).
        // Lite / Commercial / first grant: refill the period pool.
        const refillRemaining =
          plan.family !== 'business' ||
          previousLimit == null ||
          previousLimit <= 200;

        await syncAccountCreditLimit(accountId, admin, {
          refillRemaining,
        }).catch((error) => {
          console.error(
            '[billing] syncAccountCreditLimit after subscription:',
            error instanceof Error ? error.message : error,
          );
        });
      }

      // Clear pending seat downgrade once Stripe quantity matches (or is lower).
      if (
        (isCommercial || isGraduatedBusiness) &&
        billableQuantity != null
      ) {
        const { data: limits } = await admin
          .from('account_plan_limits')
          .select('pending_billable_seats')
          .eq('account_id', accountId)
          .maybeSingle();

        const pending =
          (limits as { pending_billable_seats?: number | null } | null)
            ?.pending_billable_seats ?? null;

        if (pending != null && billableQuantity <= pending) {
          await admin
            .from('account_plan_limits')
            .update({
              pending_billable_seats: null,
              pending_seats_effective_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('account_id', accountId);
        }
      }
    } else if (plan.family === 'addon_videos') {
      const { data: existing } = await admin
        .from('account_plan_limits')
        .select('max_videos')
        .eq('account_id', accountId)
        .maybeSingle();

      const currentMax =
        (existing as { max_videos?: number | null } | null)?.max_videos ?? 0;
      const nextMax = plan.limits.maxVideos ?? 0;

      if (nextMax > currentMax) {
        await admin.from('account_plan_limits').upsert(
          {
            account_id: accountId,
            plan_product_id: plan.productId,
            plan_id: plan.planId,
            plan_family: plan.family,
            max_videos: nextMax,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'account_id' },
        );
      }
    }
  }

  if (!workspacePlanSynced && items.length > 0) {
    const firstWorkspacePlan = items
      .map((item) => findPlanByStripePriceId(item.variant_id))
      .find((plan) => plan?.workspaceProfiles?.length);

    if (firstWorkspacePlan) {
      await admin.from('account_plan_limits').upsert(
        {
          account_id: accountId,
          plan_product_id: firstWorkspacePlan.productId,
          plan_id: firstWorkspacePlan.planId,
          plan_family: firstWorkspacePlan.family,
          max_members: firstWorkspacePlan.limits.maxMembers,
          max_properties: firstWorkspacePlan.limits.maxProperties,
          max_videos: firstWorkspacePlan.limits.maxVideos,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id' },
      );
    }
  }

  await syncAddonModulesFromEntitlements(admin, accountId);
}

export async function clearKeelPlanForAccount(
  admin: SupabaseClient,
  accountId: string,
): Promise<void> {
  await admin.from('account_entitlements').delete().eq('account_id', accountId);
  await admin.from('account_plan_limits').delete().eq('account_id', accountId);
}
