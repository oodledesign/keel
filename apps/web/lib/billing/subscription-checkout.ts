import 'server-only';

import Stripe from 'stripe';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { getSiteOrigin, getStripeClientSecret } from './stripe-connect';

type ClientSubscriptionRow = {
  id: string;
  business_id: string;
  client_org_id: string | null;
  plan_name: string | null;
  monthly_amount: number | null;
  status: string | null;
  stripe_subscription_id: string | null;
};

type AgencyStripeRow = {
  stripe_account_id: string | null;
  stripe_connect_enabled: boolean | null;
  application_fee_percent: number | null;
};

type BusinessRow = {
  account_id: string | null;
  name: string | null;
};

type QueryBuilder<T> = PromiseLike<{
  data: T | null;
  error: { message: string } | null;
}> & {
  select: (columns: string) => QueryBuilder<T>;
  eq: (column: string, value: string) => QueryBuilder<T>;
  maybeSingle: () => Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
};

type UpdateBuilder = PromiseLike<{ error: { message: string } | null }> & {
  eq: (column: string, value: string) => UpdateBuilder;
};

type DynamicAdmin = {
  from: (table: string) => {
    select: <T>(columns: string) => QueryBuilder<T>;
    update: (values: Record<string, unknown>) => UpdateBuilder;
  };
};

function getStripeClient() {
  return new Stripe(getStripeClientSecret());
}

/**
 * Create a Stripe Checkout Session for a client subscription (Connect destination charge).
 */
export async function createClientSubscriptionCheckout(
  subscriptionId: string,
): Promise<string> {
  const admin = getSupabaseServerAdminClient();
  const db = admin as unknown as DynamicAdmin;

  const { data: subscription, error: subError } = await db
    .from('client_subscriptions')
    .select<ClientSubscriptionRow>(
      'id, business_id, client_org_id, plan_name, monthly_amount, status, stripe_subscription_id',
    )
    .eq('id', subscriptionId)
    .maybeSingle();

  if (subError || !subscription) {
    throw new Error('Subscription not found');
  }

  if (subscription.stripe_subscription_id) {
    throw new Error('This subscription is already active');
  }

  if (subscription.status === 'cancelled') {
    throw new Error('This subscription has been cancelled');
  }

  const monthlyAmount = subscription.monthly_amount ?? 0;
  if (monthlyAmount <= 0) {
    throw new Error('Subscription amount must be greater than zero');
  }

  const { data: agencyStripe, error: agencyError } = await db
    .from('agency_stripe')
    .select<AgencyStripeRow>(
      'stripe_account_id, stripe_connect_enabled, application_fee_percent',
    )
    .eq('business_id', subscription.business_id)
    .maybeSingle();

  if (
    agencyError ||
    !agencyStripe?.stripe_connect_enabled ||
    !agencyStripe.stripe_account_id
  ) {
    throw new Error('Agency Stripe Connect is not configured');
  }

  const { data: business } = await db
    .from('businesses')
    .select<BusinessRow>('account_id, name')
    .eq('id', subscription.business_id)
    .maybeSingle();

  const origin = getSiteOrigin();
  const planLabel = subscription.plan_name?.trim() || 'Monthly subscription';
  const successUrl = `${origin}/api/client-subscriptions/checkout?subscriptionId=${encodeURIComponent(subscription.id)}&completed=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/api/client-subscriptions/checkout?subscriptionId=${encodeURIComponent(subscription.id)}&cancelled=1`;

  const applicationFeePercent = agencyStripe.application_fee_percent ?? 10;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [
      {
        price_data: {
          currency: 'gbp',
          unit_amount: monthlyAmount,
          recurring: { interval: 'month' },
          product_data: {
            name: planLabel,
            description: business?.name
              ? `${planLabel} — ${business.name}`
              : planLabel,
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: subscription.id,
    metadata: {
      client_subscription_id: subscription.id,
      business_id: subscription.business_id,
      client_org_id: subscription.client_org_id ?? '',
      account_id: business?.account_id ?? '',
    },
    subscription_data: {
      transfer_data: {
        destination: agencyStripe.stripe_account_id,
      },
      application_fee_percent: applicationFeePercent,
      metadata: {
        client_subscription_id: subscription.id,
        business_id: subscription.business_id,
        client_org_id: subscription.client_org_id ?? '',
        account_id: business?.account_id ?? '',
      },
    },
  };

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    throw new Error('Failed to create checkout session');
  }

  return session.url;
}

export async function reconcileClientSubscriptionCheckoutSession(
  checkoutSessionId: string,
  subscriptionId: string,
) {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
    expand: ['subscription'],
  });

  if (session.metadata?.client_subscription_id !== subscriptionId) {
    throw new Error('Checkout session does not match subscription');
  }

  if (session.mode !== 'subscription' || session.payment_status !== 'paid') {
    return { activated: false as const, reason: 'payment_not_complete' as const };
  }

  const stripeSubscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  if (!stripeSubscriptionId) {
    return { activated: false as const, reason: 'missing_subscription' as const };
  }

  const admin = getSupabaseServerAdminClient();
  const db = admin as unknown as DynamicAdmin;

  const { error } = await db
    .from('client_subscriptions')
    .update({
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id:
        typeof session.customer === 'string'
          ? session.customer
          : (session.customer?.id ?? null),
      status: 'active',
    })
    .eq('id', subscriptionId);

  if (error) {
    return { activated: false as const, reason: 'update_failed' as const };
  }

  return { activated: true as const, subscriptionId };
}
