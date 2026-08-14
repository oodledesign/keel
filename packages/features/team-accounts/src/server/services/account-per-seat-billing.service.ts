import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { createBillingGatewayService } from '@kit/billing-gateway';
import { getLogger } from '@kit/shared/logger';
import { Database } from '@kit/supabase/database';

export function createAccountPerSeatBillingService(
  client: SupabaseClient<Database>,
) {
  return new AccountPerSeatBillingService(client);
}

type PerSeatSubscription = {
  provider: Database['public']['Enums']['billing_provider'];
  id: string;
  period_ends_at?: string | null;
  subscription_items: Array<{
    quantity: number;
    id: string;
    type: string;
    variant_id?: string | null;
  }>;
};

/**
 * @name AccountPerSeatBillingService
 * @description Service for managing per-seat billing for accounts.
 */
class AccountPerSeatBillingService {
  private readonly namespace = 'accounts.per-seat-billing';

  constructor(private readonly client: SupabaseClient<Database>) {}

  /**
   * @name getPerSeatSubscriptionItem
   * @description Retrieves the per-seat subscription item for an account.
   * @param accountId
   */
  async getPerSeatSubscriptionItem(
    accountId: string,
  ): Promise<PerSeatSubscription | undefined> {
    const logger = await getLogger();
    const ctx = { accountId, name: this.namespace };

    logger.info(
      ctx,
      `Retrieving per-seat subscription item for account ${accountId}...`,
    );

    const { data, error } = await this.client
      .from('subscriptions')
      .select(
        `
          provider: billing_provider,
          id,
          period_ends_at,
          subscription_items !inner (
            quantity,
            id,
            type,
            variant_id
          )
        `,
      )
      .eq('account_id', accountId)
      .eq('subscription_items.type', 'per_seat')
      .maybeSingle();

    if (error) {
      logger.error(
        {
          ...ctx,
          error,
        },
        `Failed to get per-seat subscription item for account ${accountId}`,
      );

      throw error;
    }

    if (!data?.subscription_items) {
      logger.info(
        ctx,
        `Account is not subscribed to a per-seat subscription. Exiting...`,
      );

      return;
    }

    logger.info(
      ctx,
      `Per-seat subscription item found for account ${accountId}. Will update...`,
    );

    return data as PerSeatSubscription;
  }

  /**
   * Cancel a scheduled period-end seat change and keep current quantity.
   */
  async cancelPendingSeatChange(accountId: string) {
    const subscription = await this.getPerSeatSubscriptionItem(accountId);

    if (!subscription) {
      throw new Error('No per-seat subscription found for this workspace');
    }

    const item = subscription.subscription_items.find(
      (entry) => entry.type === 'per_seat',
    );

    if (!item) {
      throw new Error('No per-seat subscription item found');
    }

    const billingGateway = createBillingGatewayService(subscription.provider);

    // Re-apply current quantity immediately — releases any period-end schedule.
    await billingGateway.updateSubscriptionItem({
      subscriptionId: subscription.id,
      subscriptionItemId: item.id,
      quantity: item.quantity,
      timing: 'immediate',
      restartBillingCycle: false,
    });

    return {
      quantity: item.quantity,
      timing: 'cancelled_pending' as const,
      periodEndsAt: subscription.period_ends_at ?? null,
    };
  }

  /**
   * Set absolute billable seat quantity.
   * Upgrade (higher qty): immediate + restart billing cycle.
   * Downgrade (lower qty): schedule at period end.
   */
  async setBillableSeatQuantity(accountId: string, quantity: number) {
    const logger = await getLogger();
    const subscription = await this.getPerSeatSubscriptionItem(accountId);

    if (!subscription) {
      throw new Error('No per-seat subscription found for this workspace');
    }

    const item = subscription.subscription_items.find(
      (entry) => entry.type === 'per_seat',
    );

    if (!item) {
      throw new Error('No per-seat subscription item found');
    }

    const current = item.quantity;
    const next = Math.max(1, Math.floor(quantity));

    if (next === current) {
      // Re-applying current qty clears any pending period-end downgrade.
      return this.cancelPendingSeatChange(accountId);
    }

    const isUpgrade = next > current;
    const billingGateway = createBillingGatewayService(subscription.provider);

    const ctx = {
      name: this.namespace,
      accountId,
      current,
      next,
      isUpgrade,
    };

    logger.info(ctx, `Setting billable seats for account ${accountId}...`);

    await billingGateway.updateSubscriptionItem({
      subscriptionId: subscription.id,
      subscriptionItemId: item.id,
      quantity: next,
      timing: isUpgrade ? 'immediate' : 'period_end',
      restartBillingCycle: isUpgrade,
    });

    if (isUpgrade) {
      return {
        quantity: next,
        timing: 'immediate' as const,
        periodEndsAt: subscription.period_ends_at ?? null,
      };
    }

    return {
      quantity: current,
      pendingQuantity: next,
      effectiveAt: subscription.period_ends_at ?? null,
      timing: 'period_end' as const,
      periodEndsAt: subscription.period_ends_at ?? null,
    };
  }

  /**
   * @name increaseSeats
   * @description Increases the number of seats for an account immediately
   * and restarts the billing cycle.
   * @param accountId
   */
  async increaseSeats(accountId: string) {
    const logger = await getLogger();
    const subscription = await this.getPerSeatSubscriptionItem(accountId);

    if (!subscription) {
      return;
    }

    const subscriptionItems = subscription.subscription_items.filter((item) => {
      return item.type === 'per_seat';
    });

    if (!subscriptionItems.length) {
      return;
    }

    const billingGateway = createBillingGatewayService(subscription.provider);

    const ctx = {
      name: this.namespace,
      accountId,
      subscriptionItems,
    };

    logger.info(ctx, `Increasing seats for account ${accountId}...`);

    const promises = subscriptionItems.map(async (item) => {
      try {
        const nextQty = item.quantity + 1;

        logger.info(
          {
            name: this.namespace,
            accountId,
            subscriptionItemId: item.id,
            quantity: nextQty,
          },
          `Updating subscription item...`,
        );

        await billingGateway.updateSubscriptionItem({
          subscriptionId: subscription.id,
          subscriptionItemId: item.id,
          quantity: nextQty,
          timing: 'immediate',
          restartBillingCycle: true,
        });

        logger.info(
          {
            name: this.namespace,
            accountId,
            subscriptionItemId: item.id,
            quantity: nextQty,
          },
          `Subscription item updated successfully`,
        );
      } catch (error) {
        logger.error(
          {
            ...ctx,
            error,
          },
          `Failed to increase seats for account ${accountId}`,
        );
      }
    });

    await Promise.all(promises);
  }

  /**
   * @name decreaseSeats
   * @description Schedules a seat decrease at the end of the billing cycle.
   * @param accountId
   */
  async decreaseSeats(accountId: string) {
    const logger = await getLogger();
    const subscription = await this.getPerSeatSubscriptionItem(accountId);

    if (!subscription) {
      return;
    }

    const subscriptionItems = subscription.subscription_items.filter((item) => {
      return item.type === 'per_seat';
    });

    if (!subscriptionItems.length) {
      return;
    }

    const ctx = {
      name: this.namespace,
      accountId,
      subscriptionItems,
    };

    logger.info(
      ctx,
      `Scheduling seat decrease at period end for account ${accountId}...`,
    );

    const billingGateway = createBillingGatewayService(subscription.provider);

    const promises = subscriptionItems.map(async (item) => {
      try {
        const nextQty = Math.max(1, item.quantity - 1);

        if (nextQty >= item.quantity) {
          return;
        }

        logger.info(
          {
            name: this.namespace,
            accountId,
            subscriptionItemId: item.id,
            quantity: nextQty,
          },
          `Scheduling subscription item decrease...`,
        );

        await billingGateway.updateSubscriptionItem({
          subscriptionId: subscription.id,
          subscriptionItemId: item.id,
          quantity: nextQty,
          timing: 'period_end',
          restartBillingCycle: false,
        });

        logger.info(
          {
            name: this.namespace,
            accountId,
            subscriptionItemId: item.id,
            quantity: nextQty,
          },
          `Seat decrease scheduled successfully`,
        );
      } catch (error) {
        logger.error(
          {
            ...ctx,
            error,
          },
          `Failed to decrease seats for account ${accountId}`,
        );
      }
    });

    await Promise.all(promises);
  }
}
