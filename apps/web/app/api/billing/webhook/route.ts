import { getBillingEventHandlerService } from '@kit/billing-gateway';
import { getPlanTypesMap } from '@kit/billing';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import billingConfig from '~/config/billing.config';
import {
  syncKeelPlanFromSubscription,
} from '~/lib/billing/sync-subscription-plan';
import { sendPaymentFailedEmail } from '~/lib/billing/trial-notifications';

import type { UpsertSubscriptionParams } from '@kit/billing/types';

/**
 * @description Handle the webhooks from Stripe related to checkouts
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

      if (
        subscription.status === 'past_due' ||
        subscription.status === 'unpaid'
      ) {
        const accountId = subscription.target_account_id;
        const subscriptionId = subscription.target_subscription_id;

        if (accountId && subscriptionId) {
          const { data: account } = await admin
            .from('accounts')
            .select('name, slug')
            .eq('id', accountId)
            .maybeSingle();

          const slug = (account as { slug?: string | null } | null)?.slug;
          if (slug) {
            await sendPaymentFailedEmail(admin, {
              subscriptionId,
              accountId,
              accountSlug: slug,
              accountName:
                (account as { name?: string | null } | null)?.name ?? slug,
            }).catch(() => undefined);
          }
        }
      }
    };

    try {
      await service.handleWebhookEvent(request, {
        onSubscriptionUpdated: syncPlan,
        onCheckoutSessionCompleted: async (payload) => {
          if ('target_order_id' in payload) {
            return;
          }
          await syncPlan(payload as UpsertSubscriptionParams);
        },
        onInvoicePaid: syncPlan,
      });

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
