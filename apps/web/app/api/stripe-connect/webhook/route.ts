import { NextResponse } from 'next/server';

import Stripe from 'stripe';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createPlanTemplatesService } from '~/home/[account]/settings/services/_lib/server/plan-templates.service';
import { mapStripeSubscriptionStatus } from '~/lib/billing/client-subscription-status';
import { notifyConnectPaymentFailed } from '~/lib/billing/connect-payment-notifications';
import { getStripeClientSecret } from '~/lib/billing/stripe-connect';
import { reconcileClientSubscriptionCheckoutSession } from '~/lib/billing/subscription-checkout';

type ClientSubscriptionRow = {
  id: string;
  business_id: string;
  client_org_id: string | null;
  client_id?: string | null;
  account_id?: string | null;
  website_id?: string | null;
  plan_name: string | null;
  monthly_amount: number | null;
  status: string | null;
};

type BusinessRow = {
  account_id: string | null;
};

type ClientRow = {
  id: string;
  display_name?: string | null;
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

type DeleteQuery = PromiseLike<{ error: { message: string } | null }> & {
  eq: (column: string, value: string) => DeleteQuery;
};

type DynamicAdmin = {
  from: (table: string) => {
    select: <T>(columns: string) => MaybeSingleQuery<T> | ListQuery<T>;
    update: (values: Record<string, unknown>) => UpdateQuery;
    delete: () => DeleteQuery;
    insert: (values: Record<string, unknown>) => PromiseLike<{
      data: unknown;
      error: { message: string; code?: string } | null;
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

function getStripeSubscriptionId(invoice: SubscriptionInvoice) {
  const subscription = invoice.subscription;
  return typeof subscription === 'string'
    ? subscription
    : (subscription?.id ?? null);
}

function getStripePaymentIntentId(invoice: SubscriptionInvoice) {
  const paymentIntent = invoice.payment_intent;
  return typeof paymentIntent === 'string'
    ? paymentIntent
    : (paymentIntent?.id ?? null);
}

function periodEndIso(subscription: Stripe.Subscription): string | null {
  const periodEndUnix = (subscription as { current_period_end?: number })
    .current_period_end;
  return periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;
}

/**
 * Claim Stripe event id for idempotency. Returns false if already processed.
 */
async function claimWebhookEvent(event: Stripe.Event): Promise<boolean> {
  const db = getDb();
  const stripeAccountId =
    typeof event.account === 'string' ? event.account : null;

  const { error } = await db.from('connect_webhook_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    stripe_account_id: stripeAccountId,
  });

  if (!error) return true;

  // Unique violation → already processed
  if (error.code === '23505' || /duplicate|unique/i.test(error.message)) {
    return false;
  }

  // Table missing during rollout — proceed without dedupe rather than drop events
  console.warn('[stripe-connect webhook] event claim failed', error);
  return true;
}

async function loadSubscriptionByStripeId(stripeSubscriptionId: string) {
  const db = getDb();
  const { data } = await (
    db
      .from('client_subscriptions')
      .select(
        'id, business_id, client_org_id, client_id, account_id, website_id, plan_name, monthly_amount, status',
      ) as MaybeSingleQuery<ClientSubscriptionRow>
  )
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

  const periodEnd = periodEndIso(subscription);
  const status = mapStripeSubscriptionStatus(subscription.status);

  await db
    .from('client_subscriptions')
    .update({
      status,
      stripe_customer_id:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : (subscription.customer?.id ?? null),
      stripe_customer_id_connect:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : (subscription.customer?.id ?? null),
      stripe_subscription_id: subscription.id,
      ...(periodEnd
        ? {
            current_period_end: periodEnd,
            next_billing_date: periodEnd,
          }
        : {}),
      ...(status === 'cancelled'
        ? { cancelled_at: new Date().toISOString() }
        : {}),
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

  if (session.metadata?.ozer_account_id) {
    const admin = getSupabaseServerAdminClient();
    await createPlanTemplatesService(admin as never).reconcileCheckoutSession(
      subscriptionId,
      session.id,
    );
    return;
  }

  await reconcileClientSubscriptionCheckoutSession(session.id, subscriptionId);
}

async function resolveAccountIdForSubscription(
  subscription: ClientSubscriptionRow,
  stripeInvoice?: SubscriptionInvoice,
): Promise<string | null> {
  const metaAccountId =
    stripeInvoice?.subscription_details?.metadata?.ozer_account_id ??
    stripeInvoice?.metadata?.ozer_account_id ??
    null;

  if (metaAccountId) return String(metaAccountId);
  if (subscription.account_id) return String(subscription.account_id);

  const db = getDb();
  if (subscription.business_id) {
    const { data: business } = await (
      db
        .from('businesses')
        .select('account_id') as MaybeSingleQuery<BusinessRow>
    )
      .eq('id', subscription.business_id)
      .maybeSingle();
    if (business?.account_id) return String(business.account_id);
  }

  return null;
}

async function resolveClientIdForSubscription(
  subscription: ClientSubscriptionRow,
) {
  if (subscription.client_id) {
    return subscription.client_id;
  }

  const db = getDb();
  const accountId = await resolveAccountIdForSubscription(subscription);
  if (!accountId) return null;

  if (subscription.client_org_id) {
    const { data: orgClients } = await (
      db.from('clients').select('id') as ListQuery<ClientRow>
    )
      .eq('account_id', accountId)
      .eq('client_org_id', subscription.client_org_id)
      .limit(1);

    if (orgClients?.[0]?.id) {
      return orgClients[0].id;
    }
  }

  // Do not guess a workspace client — wrong attribution is worse than skipping.
  return null;
}

async function resolveAccountSlug(accountId: string): Promise<string | null> {
  const db = getDb();
  const { data } = await (
    db.from('accounts').select('slug') as MaybeSingleQuery<{
      slug: string | null;
    }>
  )
    .eq('id', accountId)
    .maybeSingle();
  return data?.slug ? String(data.slug) : null;
}

async function createPaidInvoiceFromStripeInvoice(
  stripeInvoice: SubscriptionInvoice,
) {
  const stripeSubscriptionId = getStripeSubscriptionId(stripeInvoice);
  if (!stripeSubscriptionId) {
    return;
  }

  const db = getDb();

  const { data: existing } = await (
    db.from('invoices').select('id') as MaybeSingleQuery<{ id: string }>
  )
    .eq('stripe_checkout_session_id', stripeInvoice.id)
    .maybeSingle();

  if (existing?.id) {
    // Still sync subscription recovery even if invoice already mirrored
    await markSubscriptionActiveFromInvoice(stripeInvoice);
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

  const accountId = await resolveAccountIdForSubscription(
    subscription,
    stripeInvoice,
  );
  if (!accountId) {
    return;
  }

  const clientId = await resolveClientIdForSubscription(subscription);
  if (!clientId) {
    console.error(
      '[stripe-connect webhook] no client_id for subscription invoice',
      {
        subscriptionId: subscription.id,
        stripeInvoiceId: stripeInvoice.id,
      },
    );
    await markSubscriptionActiveFromInvoice(stripeInvoice);
    return;
  }

  const { data: invoiceNumber, error: numberError } = await db.rpc(
    'allocate_invoice_number',
    { p_account_id: accountId },
  );

  if (numberError || !invoiceNumber) {
    console.error(
      '[stripe-connect webhook] allocate_invoice_number failed',
      numberError,
    );
    await markSubscriptionActiveFromInvoice(stripeInvoice);
    return;
  }

  const totalPence =
    stripeInvoice.amount_paid ?? subscription.monthly_amount ?? 0;
  const paymentIntentId = getStripePaymentIntentId(stripeInvoice);

  const { error: insertError } = await db.from('invoices').insert({
    account_id: accountId,
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
    throw new Error(
      `[stripe-connect webhook] invoice insert failed: ${insertError.message}`,
    );
  }

  try {
    const { invalidatePortalBillingInvoiceCache } =
      await import('~/portal/[slug]/_lib/server/portal-billing.service');
    await invalidatePortalBillingInvoiceCache({
      stripeCustomerId:
        typeof stripeInvoice.customer === 'string'
          ? stripeInvoice.customer
          : (stripeInvoice.customer?.id ?? null),
    });
  } catch (cacheError) {
    console.error(
      '[stripe-connect webhook] invoice cache invalidate',
      cacheError,
    );
  }

  await markSubscriptionActiveFromInvoice(stripeInvoice);
}

async function markSubscriptionActiveFromInvoice(
  stripeInvoice: SubscriptionInvoice,
) {
  const stripeSubscriptionId = getStripeSubscriptionId(stripeInvoice);
  if (!stripeSubscriptionId) return;

  const subscription = await loadSubscriptionByStripeId(stripeSubscriptionId);
  if (!subscription?.id) return;

  const periodEndUnix = stripeInvoice.lines?.data?.[0]?.period?.end;
  const periodEnd = periodEndUnix
    ? new Date(periodEndUnix * 1000).toISOString()
    : null;

  const db = getDb();
  await db
    .from('client_subscriptions')
    .update({
      status: 'active',
      ...(periodEnd
        ? {
            current_period_end: periodEnd,
            next_billing_date: periodEnd,
          }
        : {}),
    })
    .eq('id', subscription.id);
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

  // Smart Retries re-fire payment_failed — notify once on transition to overdue.
  const wasAlreadyOverdue = subscription.status === 'overdue';

  const db = getDb();
  await db
    .from('client_subscriptions')
    .update({ status: 'overdue' })
    .eq('id', subscription.id);

  if (wasAlreadyOverdue) return;

  const accountId = await resolveAccountIdForSubscription(
    subscription,
    stripeInvoice,
  );
  if (!accountId) return;

  const clientId = await resolveClientIdForSubscription(subscription);
  let clientName = 'Client';
  if (clientId) {
    const { data: client } = await (
      db
        .from('clients')
        .select('id, display_name') as MaybeSingleQuery<ClientRow>
    )
      .eq('id', clientId)
      .maybeSingle();
    if (client?.display_name?.trim()) {
      clientName = client.display_name.trim();
    }
  }

  const accountSlug = await resolveAccountSlug(accountId);
  const planName = subscription.plan_name?.trim() || 'Subscription';

  await notifyConnectPaymentFailed({
    accountId,
    accountSlug,
    clientId,
    websiteId: subscription.website_id ?? null,
    clientName,
    planName,
  });
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

  const claimed = await claimWebhookEvent(event);
  if (!claimed) {
    return NextResponse.json({ received: true, duplicate: true });
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

      case 'customer.subscription.created':
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
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
            })
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
    // Release claim so Stripe can retry a failed handler.
    try {
      await getDb()
        .from('connect_webhook_events')
        .delete()
        .eq('stripe_event_id', event.id);
    } catch (releaseError) {
      console.error(
        '[stripe-connect webhook] failed to release claim',
        releaseError,
      );
    }
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
