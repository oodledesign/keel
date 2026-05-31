import { NextResponse } from 'next/server';

import Stripe from 'stripe';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { getStripeClientSecret } from '~/lib/billing/stripe-connect';
import { reconcileClientSubscriptionCheckoutSession } from '~/lib/billing/subscription-checkout';

type ClientSubscriptionRow = {
  id: string;
  business_id: string;
  client_org_id: string | null;
  plan_name: string | null;
  monthly_amount: number | null;
  status: string | null;
};

type BusinessRow = {
  account_id: string | null;
};

type ClientRow = {
  id: string;
};

type MaybeSingleQuery<T> = PromiseLike<{
  data: T | null;
  error: { message: string } | null;
}> & {
  select: (columns: string) => MaybeSingleQuery<T>;
  eq: (column: string, value: string) => MaybeSingleQuery<T>;
  maybeSingle: () => Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
};

type ListQuery<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}> & {
  select: (columns: string) => ListQuery<T>;
  eq: (column: string, value: string) => ListQuery<T>;
  limit: (count: number) => ListQuery<T>;
};

type UpdateQuery = PromiseLike<{ error: { message: string } | null }> & {
  eq: (column: string, value: string) => UpdateQuery;
};

type DynamicAdmin = {
  from: (table: string) => {
    select: <T>(columns: string) => MaybeSingleQuery<T> | ListQuery<T>;
    update: (values: Record<string, unknown>) => UpdateQuery;
    insert: (values: Record<string, unknown>) => PromiseLike<{
      error: { message: string } | null;
    }>;
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{
    data: string | null;
    error: { message: string } | null;
  }>;
};

type SubscriptionInvoice = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
  payment_intent?: string | Stripe.PaymentIntent | null;
  subscription_details?: {
    metadata?: Record<string, string>;
  } | null;
};

function getDb() {
  return getSupabaseServerAdminClient() as unknown as DynamicAdmin;
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status) {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'overdue';
    case 'canceled':
      return 'cancelled';
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return 'pending';
    default:
      return status;
  }
}

function getStripeSubscriptionId(invoice: SubscriptionInvoice) {
  const subscription = invoice.subscription;
  return typeof subscription === 'string'
    ? subscription
    : subscription?.id ?? null;
}

function getStripePaymentIntentId(invoice: SubscriptionInvoice) {
  const paymentIntent = invoice.payment_intent;
  return typeof paymentIntent === 'string'
    ? paymentIntent
    : paymentIntent?.id ?? null;
}

async function loadSubscriptionByStripeId(stripeSubscriptionId: string) {
  const db = getDb();
  const { data } = await (db
    .from('client_subscriptions')
    .select(
      'id, business_id, client_org_id, plan_name, monthly_amount, status',
    ) as MaybeSingleQuery<ClientSubscriptionRow>)
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .maybeSingle();

  return data;
}

async function syncClientSubscriptionFromStripe(
  subscription: Stripe.Subscription,
) {
  const db = getDb();
  const subscriptionId =
    subscription.metadata?.client_subscription_id ??
    (await loadSubscriptionByStripeId(subscription.id))?.id;

  if (!subscriptionId) {
    return;
  }

  await db
    .from('client_subscriptions')
    .update({
      status: mapStripeSubscriptionStatus(subscription.status),
      stripe_customer_id:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : (subscription.customer?.id ?? null),
      stripe_subscription_id: subscription.id,
    })
    .eq('id', subscriptionId);
}

async function activateClientSubscriptionFromCheckout(
  session: Stripe.Checkout.Session,
) {
  const subscriptionId = session.metadata?.client_subscription_id;
  if (!subscriptionId) {
    return;
  }

  await reconcileClientSubscriptionCheckoutSession(session.id, subscriptionId);
}

async function resolveClientIdForSubscription(
  subscription: ClientSubscriptionRow,
) {
  const db = getDb();

  const { data: business } = await (db
    .from('businesses')
    .select('account_id') as MaybeSingleQuery<BusinessRow>)
    .eq('id', subscription.business_id)
    .maybeSingle();

  if (!business?.account_id) {
    return null;
  }

  if (subscription.client_org_id) {
    const { data: orgClients } = await (db
      .from('clients')
      .select('id') as ListQuery<ClientRow>)
      .eq('account_id', business.account_id)
      .eq('client_org_id', subscription.client_org_id)
      .limit(1);

    if (orgClients?.[0]?.id) {
      return orgClients[0].id;
    }
  }

  const { data: fallbackClients } = await (db
    .from('clients')
    .select('id') as ListQuery<ClientRow>)
    .eq('account_id', business.account_id)
    .limit(1);

  return fallbackClients?.[0]?.id ?? null;
}

async function createPaidInvoiceFromStripeInvoice(
  stripeInvoice: SubscriptionInvoice,
) {
  const stripeSubscriptionId = getStripeSubscriptionId(stripeInvoice);
  if (!stripeSubscriptionId) {
    return;
  }

  const db = getDb();

  const { data: existing } = await (db
    .from('invoices')
    .select('id') as MaybeSingleQuery<{ id: string }>)
    .eq('stripe_checkout_session_id', stripeInvoice.id)
    .maybeSingle();

  if (existing?.id) {
    return;
  }

  const subscription =
    (await loadSubscriptionByStripeId(stripeSubscriptionId)) ??
    (stripeInvoice.subscription_details?.metadata?.client_subscription_id
      ? ({
          id: stripeInvoice.subscription_details.metadata
            .client_subscription_id,
          business_id:
            stripeInvoice.subscription_details.metadata.business_id ?? '',
          client_org_id:
            stripeInvoice.subscription_details.metadata.client_org_id ?? null,
          plan_name: null,
          monthly_amount: stripeInvoice.amount_paid ?? null,
          status: 'active',
        } satisfies ClientSubscriptionRow)
      : null);

  if (!subscription) {
    return;
  }

  const { data: business } = await (db
    .from('businesses')
    .select('account_id') as MaybeSingleQuery<BusinessRow>)
    .eq('id', subscription.business_id)
    .maybeSingle();

  if (!business?.account_id) {
    return;
  }

  const clientId = await resolveClientIdForSubscription(subscription);
  if (!clientId) {
    console.error('[stripe-connect webhook] no client_id for subscription invoice', {
      subscriptionId: subscription.id,
      stripeInvoiceId: stripeInvoice.id,
    });
    return;
  }

  const { data: invoiceNumber, error: numberError } = await db.rpc(
    'allocate_invoice_number',
    { p_account_id: business.account_id },
  );

  if (numberError || !invoiceNumber) {
    console.error('[stripe-connect webhook] allocate_invoice_number failed', numberError);
    return;
  }

  const totalPence = stripeInvoice.amount_paid ?? subscription.monthly_amount ?? 0;
  const paymentIntentId = getStripePaymentIntentId(stripeInvoice);

  const { error: insertError } = await db.from('invoices').insert({
    account_id: business.account_id,
    client_id: clientId,
    invoice_number: invoiceNumber,
    status: 'paid',
    subtotal_pence: totalPence,
    total_pence: totalPence,
    currency: (stripeInvoice.currency ?? 'gbp').toLowerCase(),
    notes: subscription.plan_name
      ? `Subscription payment — ${subscription.plan_name}`
      : 'Subscription payment',
    paid_at: stripeInvoice.status_transitions?.paid_at
      ? new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString()
      : new Date().toISOString(),
    stripe_checkout_session_id: stripeInvoice.id,
    stripe_payment_intent_id: paymentIntentId,
  });

  if (insertError) {
    console.error('[stripe-connect webhook] failed to insert invoice', insertError);
  }
}

async function markSubscriptionOverdueFromInvoice(
  stripeInvoice: SubscriptionInvoice,
) {
  const stripeSubscriptionId = getStripeSubscriptionId(stripeInvoice);
  if (!stripeSubscriptionId) {
    return;
  }

  const subscription = await loadSubscriptionByStripeId(stripeSubscriptionId);
  if (!subscription?.id) {
    return;
  }

  const db = getDb();
  await db
    .from('client_subscriptions')
    .update({ status: 'overdue' })
    .eq('id', subscription.id);
}

/**
 * POST /api/stripe-connect/webhook
 * Stripe Connect webhook for subscription billing and account sync.
 */
export async function POST(request: Request) {
  const stripeSecret = getStripeClientSecret();
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

  if (!webhookSecret?.startsWith('whsec_')) {
    return NextResponse.json(
      { error: 'Stripe Connect webhook not configured' },
      { status: 500 },
    );
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const stripe = new Stripe(stripeSecret);
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription') {
          await activateClientSubscriptionFromCheckout(session);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncClientSubscriptionFromStripe(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId =
          subscription.metadata?.client_subscription_id ??
          (await loadSubscriptionByStripeId(subscription.id))?.id;

        if (subscriptionId) {
          const db = getDb();
          await db
            .from('client_subscriptions')
            .update({ status: 'cancelled' })
            .eq('id', subscriptionId);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as SubscriptionInvoice;
        await createPaidInvoiceFromStripeInvoice(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as SubscriptionInvoice;
        await markSubscriptionOverdueFromInvoice(invoice);
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        if (account.id) {
          const db = getDb();
          await db
            .from('agency_stripe')
            .update({
              stripe_account_email: account.email ?? null,
            })
            .eq('stripe_account_id', account.id);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('[stripe-connect webhook] handler error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
