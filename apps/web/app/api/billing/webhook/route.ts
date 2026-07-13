import { after } from 'next/server';

import { getBillingEventHandlerService } from '@kit/billing-gateway';
import { getPlanTypesMap } from '@kit/billing';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import billingConfig from '~/config/billing.config';
import {
  fulfillAiCreditPackOrder,
  fulfillAiCreditPackFromSubscription,
} from '~/lib/billing/fulfill-ai-credit-pack';
import {
  handleBillingLifecycleStripeEvent,
  isBillingLifecycleStripeEvent,
} from '~/lib/billing/handle-billing-lifecycle-event';
import {
  applyAccountBillingTransition,
  mapStripeSubscriptionStatus,
} from '~/lib/billing/account-billing-lifecycle';
import { flushBillingEmailJobs } from '~/lib/billing/billing-email-outbox';
import { syncKeelPlanFromSubscription } from '~/lib/billing/sync-subscription-plan';

import type {
  UpsertOrderParams,
  UpsertSubscriptionParams,
} from '@kit/billing/types';
import type Stripe from 'stripe';

/**
 * @description Handle the webhooks from Stripe related to checkouts + Ozer billing lifecycle
 */
export const POST = enhanceRouteHandler(
  async ({ request }) => {
    const provider = billingConfig.provider;
    const logger = await getLogger();

    const ctx = {
      name: 'billing.webhook',
      provider,
    };

    logger.info(ctx, `Received billing webhook. Processing...`);

    const supabaseClientProvider = () => getSupabaseServerAdminClient();

    const service = await getBillingEventHandlerService(
      supabaseClientProvider,
      provider,
      getPlanTypesMap(billingConfig),
    );

    const syncPlan = async (subscription: UpsertSubscriptionParams) => {
      const admin = getSupabaseServerAdminClient();
      await syncKeelPlanFromSubscription(admin, subscription);
    };

    /** Ensure account_billing mirrors MakerKit subscription upserts (trials included). */
    const syncLifecycleFromSubscription = async (
      subscription: UpsertSubscriptionParams,
      source: string,
    ) => {
      const mapped = mapStripeSubscriptionStatus(subscription.status, null);
      if (!mapped) return;

      const admin = getSupabaseServerAdminClient();
      const subscriptionId = subscription.target_subscription_id;
      const trialEndsAt =
        typeof subscription.trial_ends_at === 'string'
          ? subscription.trial_ends_at
          : subscription.trial_ends_at != null
            ? new Date(Number(subscription.trial_ends_at) * 1000).toISOString()
            : null;

      const { emailJobIds } = await applyAccountBillingTransition(admin, {
        stripeEventId: `mk-sub-sync:${source}:${subscriptionId}:${subscription.status}`,
        accountId: subscription.target_account_id,
        stripeCustomerId: subscription.target_customer_id,
        stripeSubscriptionId: subscriptionId,
        trialEndsAt,
        toStatus: mapped,
        forceEvent: true,
        emailKind: null,
      });
      pendingEmailJobIds.push(...emailJobIds);
    };

    const pendingEmailJobIds: string[] = [];

    try {
      await service.handleWebhookEvent(request, {
        onSubscriptionUpdated: async (payload) => {
          await syncPlan(payload);
          await syncLifecycleFromSubscription(payload, 'subscription.updated');
        },
        onCheckoutSessionCompleted: async (payload) => {
          if ('target_order_id' in payload) {
            const admin = getSupabaseServerAdminClient();
            await fulfillAiCreditPackOrder(
              admin,
              payload as UpsertOrderParams,
            );
            return;
          }
          const subscription = payload as UpsertSubscriptionParams;
          await syncPlan(subscription);
          await syncLifecycleFromSubscription(subscription, 'checkout.completed');
        },
        onPaymentSucceeded: async (sessionId) => {
          const admin = getSupabaseServerAdminClient();
          const { data: order } = await admin
            .from('orders')
            .select(
              'id, account_id, status, currency, total_amount, billing_customer:billing_customers(customer_id), items:order_items(id, product_id, variant_id, price_amount, quantity)',
            )
            .eq('id', sessionId)
            .maybeSingle();

          if (!order) return;

          const row = order as {
            id: string;
            account_id: string;
            status: string;
            currency: string;
            total_amount: number;
            billing_customer?: { customer_id?: string } | null;
            items?: Array<{
              id: string;
              product_id: string;
              variant_id: string;
              price_amount: number | null;
              quantity: number;
            }>;
          };

          await fulfillAiCreditPackOrder(admin, {
            target_account_id: row.account_id,
            target_customer_id: row.billing_customer?.customer_id ?? '',
            target_order_id: row.id,
            billing_provider: 'stripe',
            status: 'succeeded',
            currency: row.currency,
            total_amount: row.total_amount,
            line_items: (row.items ?? []).map((item) => ({
              id: item.id,
              product_id: item.product_id,
              variant_id: item.variant_id,
              price_amount: item.price_amount,
              quantity: item.quantity,
            })),
          });
        },
        onInvoicePaid: async (payload) => {
          await syncPlan(payload);
          await syncLifecycleFromSubscription(payload, 'invoice.paid');
          const admin = getSupabaseServerAdminClient();
          await fulfillAiCreditPackFromSubscription(admin, payload);
        },
        onEvent: async (rawEvent) => {
          const event = rawEvent as Stripe.Event;
          if (!isBillingLifecycleStripeEvent(event.type)) {
            return;
          }

          const admin = getSupabaseServerAdminClient();
          const { emailJobIds } = await handleBillingLifecycleStripeEvent(
            admin,
            event,
          );
          pendingEmailJobIds.push(...emailJobIds);
        },
      });

      if (pendingEmailJobIds.length > 0) {
        const jobIds = [...pendingEmailJobIds];
        after(() => {
          const admin = getSupabaseServerAdminClient();
          void flushBillingEmailJobs(admin, jobIds).catch(async (error) => {
            const log = await getLogger();
            log.error(
              { error, jobIds },
              '[billing.webhook] email outbox flush failed',
            );
          });
        });
      }

      logger.info(ctx, `Successfully processed billing webhook`);

      return new Response('OK', { status: 200 });
    } catch (error) {
      logger.error({ ...ctx, error }, `Failed to process billing webhook`);

      return new Response('Failed to process billing webhook', {
        status: 500,
      });
    }
  },
  {
    auth: false,
  },
);
