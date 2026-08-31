import 'server-only';

import type { Stripe } from 'stripe';
import { z } from 'zod';

import { BillingStrategyProviderService } from '@kit/billing';
import type {
  CancelSubscriptionParamsSchema,
  CreateBillingCheckoutSchema,
  CreateBillingPortalSessionSchema,
  QueryBillingUsageSchema,
  ReportBillingUsageSchema,
  RetrieveCheckoutSessionSchema,
  UpdateSubscriptionParamsSchema,
} from '@kit/billing/schema';
import { getLogger } from '@kit/shared/logger';

import { createStripeBillingPortalSession } from './create-stripe-billing-portal-session';
import { createStripeCheckout } from './create-stripe-checkout';
import { createStripeClient } from './stripe-sdk';
import { createStripeSubscriptionPayloadBuilderService } from './stripe-subscription-payload-builder.service';

/**
 * @name StripeBillingStrategyService
 * @description The Stripe billing strategy service
 * @class StripeBillingStrategyService
 * @implements {BillingStrategyProviderService}
 */
export class StripeBillingStrategyService implements BillingStrategyProviderService {
  private readonly namespace = 'billing.stripe';

  /**
   * @name createCheckoutSession
   * @description Creates a checkout session for a customer
   * @param params
   */
  async createCheckoutSession(
    params: z.infer<typeof CreateBillingCheckoutSchema>,
  ) {
    const stripe = await this.stripeProvider();
    const logger = await getLogger();

    const ctx = {
      name: this.namespace,
      customerId: params.customerId,
      accountId: params.accountId,
    };

    logger.info(ctx, 'Creating checkout session...');

    const { client_secret } = await createStripeCheckout(stripe, params);

    if (!client_secret) {
      logger.error(ctx, 'Failed to create checkout session');

      throw new Error('Failed to create checkout session');
    }

    logger.info(ctx, 'Checkout session created successfully');

    return { checkoutToken: client_secret };
  }

  /**
   * @name createBillingPortalSession
   * @description Creates a billing portal session for a customer
   * @param params
   */
  async createBillingPortalSession(
    params: z.infer<typeof CreateBillingPortalSessionSchema>,
  ) {
    const stripe = await this.stripeProvider();
    const logger = await getLogger();

    const ctx = {
      name: this.namespace,
      customerId: params.customerId,
    };

    logger.info(ctx, 'Creating billing portal session...');

    const session = await createStripeBillingPortalSession(stripe, params);

    if (!session?.url) {
      logger.error(ctx, 'Failed to create billing portal session');
    } else {
      logger.info(ctx, 'Billing portal session created successfully');
    }

    return session;
  }

  /**
   * @name cancelSubscription
   * @description Cancels a subscription
   * @param params
   */
  async cancelSubscription(
    params: z.infer<typeof CancelSubscriptionParamsSchema>,
  ) {
    const stripe = await this.stripeProvider();
    const logger = await getLogger();

    const ctx = {
      name: this.namespace,
      subscriptionId: params.subscriptionId,
    };

    logger.info(ctx, 'Cancelling subscription...');

    try {
      await stripe.subscriptions.cancel(params.subscriptionId, {
        invoice_now: params.invoiceNow ?? true,
      });

      logger.info(ctx, 'Subscription cancelled successfully');

      return {
        success: true,
      };
    } catch (error) {
      logger.info(
        {
          ...ctx,
          error,
        },
        `Failed to cancel subscription. It may have already been cancelled on the user's end.`,
      );

      return {
        success: false,
      };
    }
  }

  /**
   * @name retrieveCheckoutSession
   * @description Retrieves a checkout session
   * @param params
   */
  async retrieveCheckoutSession(
    params: z.infer<typeof RetrieveCheckoutSessionSchema>,
  ) {
    const stripe = await this.stripeProvider();
    const logger = await getLogger();

    const ctx = {
      name: this.namespace,
      sessionId: params.sessionId,
    };

    logger.info(ctx, 'Retrieving checkout session...');

    try {
      const session = await stripe.checkout.sessions.retrieve(params.sessionId);
      const isSessionOpen = session.status === 'open';

      logger.info(ctx, 'Checkout session retrieved successfully');

      return {
        checkoutToken: session.client_secret,
        isSessionOpen,
        status: session.status ?? 'complete',
        customer: {
          email: session.customer_details?.email ?? null,
        },
      };
    } catch (error) {
      logger.error(
        {
          ...ctx,
          error,
        },
        'Failed to retrieve checkout session',
      );

      throw new Error('Failed to retrieve checkout session');
    }
  }

  /**
   * @name reportUsage
   * @description Reports usage for a subscription with the Metrics API
   * @param params
   */
  async reportUsage(params: z.infer<typeof ReportBillingUsageSchema>) {
    const stripe = await this.stripeProvider();
    const logger = await getLogger();

    const ctx = {
      name: this.namespace,
      subscriptionItemId: params.id,
      usage: params.usage,
    };

    logger.info(ctx, 'Reporting usage...');

    if (!params.eventName) {
      logger.error(ctx, 'Event name is required');

      throw new Error('Event name is required when reporting Metrics');
    }

    try {
      await stripe.billing.meterEvents.create({
        event_name: params.eventName,
        payload: {
          value: params.usage.quantity.toString(),
          stripe_customer_id: params.id,
        },
      });
    } catch (error) {
      logger.error(
        {
          ...ctx,
          error,
        },
        'Failed to report usage',
      );

      throw new Error('Failed to report usage');
    }

    return {
      success: true,
    };
  }

  /**
   * @name queryUsage
   * @description Reports the total usage for a subscription with the Metrics API
   */
  async queryUsage(params: z.infer<typeof QueryBillingUsageSchema>) {
    const stripe = await this.stripeProvider();
    const logger = await getLogger();

    const ctx = {
      name: this.namespace,
      id: params.id,
      customerId: params.customerId,
    };

    // validate shape of filters for Stripe
    if (!('startTime' in params.filter)) {
      logger.error(ctx, 'Start and end time are required for Stripe');

      throw new Error('Start and end time are required when querying usage');
    }

    logger.info(ctx, 'Querying billing usage...');

    try {
      const summaries = await stripe.billing.meters.listEventSummaries(
        params.id,
        {
          customer: params.customerId,
          start_time: params.filter.startTime,
          end_time: params.filter.endTime,
        },
      );

      logger.info(ctx, 'Billing usage queried successfully');

      const value = summaries.data.reduce((acc, summary) => {
        return acc + Number(summary.aggregated_value);
      }, 0);

      return {
        value,
      };
    } catch (error) {
      logger.error(
        {
          ...ctx,
          error,
        },
        'Failed to report usage',
      );

      throw new Error('Failed to report usage');
    }
  }

  /**
   * @name updateSubscriptionItem
   * @description Updates a subscription
   * @param params
   */
  async updateSubscriptionItem(
    params: z.infer<typeof UpdateSubscriptionParamsSchema>,
  ) {
    const stripe = await this.stripeProvider();
    const logger = await getLogger();

    const ctx = {
      name: this.namespace,
      subscriptionId: params.subscriptionId,
      subscriptionItemId: params.subscriptionItemId,
      quantity: params.quantity,
      timing: params.timing,
      restartBillingCycle: params.restartBillingCycle,
    };

    logger.info(ctx, 'Updating subscription...');

    try {
      if (params.timing === 'period_end') {
        await this.scheduleQuantityAtPeriodEnd(stripe, params);
      } else {
        // Drop any pending period-end schedule so a prior downgrade cannot stick.
        await this.releaseSubscriptionScheduleIfPresent(
          stripe,
          params.subscriptionId,
        );

        const updateParams: Stripe.SubscriptionUpdateParams = {
          items: [
            {
              id: params.subscriptionItemId,
              quantity: params.quantity,
            },
          ],
          proration_behavior: 'create_prorations',
        };

        if (params.restartBillingCycle) {
          updateParams.billing_cycle_anchor = 'now';
          updateParams.proration_behavior = 'always_invoice';
        }

        await stripe.subscriptions.update(params.subscriptionId, updateParams);
      }

      logger.info(ctx, 'Subscription updated successfully');

      return { success: true };
    } catch (error) {
      logger.error({ ...ctx, error }, 'Failed to update subscription');

      throw new Error('Failed to update subscription');
    }
  }

  private async releaseSubscriptionScheduleIfPresent(
    stripe: Stripe,
    subscriptionId: string,
  ) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const scheduleId =
      typeof subscription.schedule === 'string'
        ? subscription.schedule
        : subscription.schedule?.id;

    if (!scheduleId) {
      return;
    }

    try {
      await stripe.subscriptionSchedules.release(scheduleId);
    } catch {
      // Schedule may already be released or completed.
    }
  }

  /**
   * Schedule a seat quantity change for the current period end using
   * Stripe Subscription Schedules (upgrade uses immediate path instead).
   */
  private async scheduleQuantityAtPeriodEnd(
    stripe: Stripe,
    params: z.infer<typeof UpdateSubscriptionParamsSchema>,
  ) {
    const subscription = await stripe.subscriptions.retrieve(
      params.subscriptionId,
      { expand: ['items.data.price'] },
    );

    const item = subscription.items.data.find(
      (entry) => entry.id === params.subscriptionItemId,
    );

    if (!item?.price?.id) {
      throw new Error('Subscription item or price not found');
    }

    const priceId = item.price.id;
    const currentQuantity = item.quantity ?? 1;
    const periodEnd =
      createStripeSubscriptionPayloadBuilderService().getPeriodEndsAt(
        subscription,
      );

    let scheduleId =
      typeof subscription.schedule === 'string'
        ? subscription.schedule
        : subscription.schedule?.id;

    if (!scheduleId) {
      const created = await stripe.subscriptionSchedules.create({
        from_subscription: params.subscriptionId,
      });
      scheduleId = created.id;
    }

    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
    const currentPhase = schedule.phases[0];

    if (!currentPhase) {
      throw new Error('Subscription schedule has no current phase');
    }

    await stripe.subscriptionSchedules.update(scheduleId, {
      end_behavior: 'release',
      phases: [
        {
          start_date: currentPhase.start_date,
          end_date: periodEnd,
          items: [{ price: priceId, quantity: currentQuantity }],
          proration_behavior: 'none',
        },
        {
          items: [{ price: priceId, quantity: params.quantity }],
          proration_behavior: 'none',
        },
      ],
    });
  }

  /**
   * @name getPlanById
   * @description Retrieves a plan by id
   * @param planId
   */
  async getPlanById(planId: string) {
    const logger = await getLogger();

    const ctx = {
      name: this.namespace,
      planId,
    };

    logger.info(ctx, 'Retrieving plan by id...');

    const stripe = await this.stripeProvider();

    try {
      const price = await stripe.prices.retrieve(planId, {
        expand: ['product'],
      });

      logger.info(ctx, 'Plan retrieved successfully');

      return {
        id: price.id,
        name: (price.product as Stripe.Product).name,
        description: (price.product as Stripe.Product).description || '',
        amount: price.unit_amount ? price.unit_amount / 100 : 0,
        type: price.type,
        interval: price.recurring?.interval ?? 'month',
        intervalCount: price.recurring?.interval_count,
      };
    } catch (error) {
      logger.error({ ...ctx, error }, 'Failed to retrieve plan');

      throw new Error('Failed to retrieve plan');
    }
  }

  async getSubscription(subscriptionId: string) {
    const stripe = await this.stripeProvider();
    const logger = await getLogger();

    const ctx = {
      name: this.namespace,
      subscriptionId,
    };

    logger.info(ctx, 'Retrieving subscription...');

    const subscriptionPayloadBuilder =
      createStripeSubscriptionPayloadBuilderService();

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      logger.info(ctx, 'Subscription retrieved successfully');

      const customer = subscription.customer as string;
      const accountId = subscription.metadata?.accountId as string;

      const periodStartsAt =
        subscriptionPayloadBuilder.getPeriodStartsAt(subscription);

      const periodEndsAt =
        subscriptionPayloadBuilder.getPeriodEndsAt(subscription);

      const lineItems = subscription.items.data.map((item) => {
        return {
          ...item,
          // we cannot retrieve this from the API, user should retrieve from the billing configuration if needed
          type: '' as never,
        };
      });

      return subscriptionPayloadBuilder.build({
        customerId: customer,
        accountId,
        id: subscription.id,
        lineItems,
        status: subscription.status,
        currency: subscription.currency,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        periodStartsAt,
        periodEndsAt,
        trialStartsAt: subscription.trial_start,
        trialEndsAt: subscription.trial_end,
      });
    } catch (error) {
      logger.error({ ...ctx, error }, 'Failed to retrieve subscription');

      throw new Error('Failed to retrieve subscription');
    }
  }

  private async stripeProvider(): Promise<Stripe> {
    return createStripeClient();
  }
}
