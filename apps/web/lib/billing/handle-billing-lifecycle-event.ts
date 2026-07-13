import 'server-only';

import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';

import {
  applyAccountBillingTransition,
  findAccountIdByStripeCustomerId,
  loadAccountBilling,
  mapStripeSubscriptionStatus,
} from './account-billing-lifecycle';
import type { AccountBillingStatus } from './account-billing-types';
import { isBillingRecoveryStatus } from './billing-recovery';

type AnyClient = SupabaseClient<any>;

function customerIdFrom(value: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if ('deleted' in value && value.deleted) return null;
  return value.id;
}

function subscriptionIdFrom(
  value: string | Stripe.Subscription | null | undefined,
): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.id;
}

function unixToIso(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

/**
 * Drive Ozer account_billing from Stripe SaaS webhook events.
 * Signature verification happens in the MakerKit Stripe handler before this runs.
 */
export async function handleBillingLifecycleStripeEvent(
  admin: AnyClient,
  event: Stripe.Event,
): Promise<{ emailJobIds: string[] }> {
  const logger = await getLogger();
  const emailJobIds: string[] = [];

  switch (event.type) {
    case 'customer.subscription.trial_will_end': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = customerIdFrom(subscription.customer);
      if (!customerId) break;

      const result = await applyAccountBillingTransition(admin, {
        stripeEventId: event.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        trialEndsAt: unixToIso(subscription.trial_end),
        toStatus: 'trialing',
        forceEvent: true,
        emailKind: 'trial_ending_3d',
      });
      emailJobIds.push(...result.emailJobIds);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = customerIdFrom(invoice.customer);
      const subscriptionId = subscriptionIdFrom(
        (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null })
          .subscription,
      );

      if (!customerId) break;

      const accountId = await findAccountIdByStripeCustomerId(admin, customerId);
      const current = accountId
        ? await loadAccountBilling(admin, accountId)
        : null;
      const currentStatus = current?.subscription_status ?? null;

      // Cron escalates grace → restricted → suspended; webhook only opens grace.
      let toStatus: AccountBillingStatus = 'past_due_grace';
      if (
        currentStatus === 'past_due_restricted' ||
        currentStatus === 'suspended' ||
        currentStatus === 'canceled'
      ) {
        toStatus = currentStatus;
      }

      const result = await applyAccountBillingTransition(admin, {
        stripeEventId: event.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        toStatus,
        forceEvent: true,
        emailKind:
          toStatus === 'past_due_grace' ? 'payment_failed' : null,
      });
      emailJobIds.push(...result.emailJobIds);
      break;
    }

    case 'invoice.paid':
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = customerIdFrom(invoice.customer);
      const subscriptionId = subscriptionIdFrom(
        (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null })
          .subscription,
      );

      if (!customerId || !subscriptionId) {
        // One-off invoices (AI credits) — ignore for workspace lifecycle
        break;
      }

      const accountId = await findAccountIdByStripeCustomerId(admin, customerId);
      const current = accountId
        ? await loadAccountBilling(admin, accountId)
        : null;
      const previous = current?.subscription_status ?? null;
      const recovering = isBillingRecoveryStatus(previous);

      // $0 subscription_create invoices fire for trial starts — do not mark active.
      const billingReason = invoice.billing_reason;
      const isTrialStartInvoice =
        billingReason === 'subscription_create' &&
        (invoice.amount_paid === 0 || invoice.total === 0);

      if (isTrialStartInvoice && !recovering) {
        const result = await applyAccountBillingTransition(admin, {
          stripeEventId: event.id,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          toStatus: 'trialing',
          forceEvent: previous !== 'trialing',
          emailKind: null,
        });
        emailJobIds.push(...result.emailJobIds);
        break;
      }

      // Keep an in-progress trial until Stripe subscription leaves "trialing".
      if (previous === 'trialing' && !recovering) {
        break;
      }

      const result = await applyAccountBillingTransition(admin, {
        stripeEventId: event.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        toStatus: 'active',
        forceEvent: recovering,
        emailKind: recovering ? 'payment_recovered' : null,
      });
      emailJobIds.push(...result.emailJobIds);
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = customerIdFrom(subscription.customer);
      if (!customerId) break;

      const accountId = await findAccountIdByStripeCustomerId(admin, customerId);
      const current = accountId
        ? await loadAccountBilling(admin, accountId)
        : null;
      const mapped = mapStripeSubscriptionStatus(
        subscription.status,
        current?.subscription_status ?? null,
      );

      if (!mapped) {
        logger.debug(
          { stripeStatus: subscription.status, eventId: event.id },
          '[account-billing] ignoring unmapped subscription status',
        );
        break;
      }

      const result = await applyAccountBillingTransition(admin, {
        stripeEventId: event.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        trialEndsAt: unixToIso(subscription.trial_end),
        toStatus: mapped,
        // Cancellation email is sent only from customer.subscription.deleted
        emailKind: null,
      });
      emailJobIds.push(...result.emailJobIds);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = customerIdFrom(subscription.customer);
      if (!customerId) break;

      const result = await applyAccountBillingTransition(admin, {
        stripeEventId: event.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        toStatus: 'canceled',
        forceEvent: true,
        emailKind: 'subscription_canceled',
      });
      emailJobIds.push(...result.emailJobIds);
      break;
    }

    default:
      break;
  }

  return { emailJobIds };
}

export function isBillingLifecycleStripeEvent(type: string): boolean {
  return (
    type === 'customer.subscription.trial_will_end' ||
    type === 'customer.subscription.created' ||
    type === 'customer.subscription.updated' ||
    type === 'customer.subscription.deleted' ||
    type === 'invoice.payment_failed' ||
    type === 'invoice.paid' ||
    type === 'invoice.payment_succeeded'
  );
}
