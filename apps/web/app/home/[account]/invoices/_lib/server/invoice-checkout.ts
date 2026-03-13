import 'server-only';

import Stripe from 'stripe';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { sendInvoicePaidNotifications } from './invoice-notifications';

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

function getStripeClient() {
  if (!STRIPE_SECRET?.startsWith('sk_')) {
    throw new Error('Stripe is not configured');
  }

  return new Stripe(STRIPE_SECRET);
}

function getPaymentIntentId(session: Stripe.Checkout.Session) {
  return typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
}

async function applyPaidCheckoutSession(
  session: Stripe.Checkout.Session,
  token?: string,
) {
  const invoiceId = session.metadata?.invoice_id;

  if (!invoiceId) {
    return { paid: false, reason: 'missing_invoice_id' as const };
  }

  if (session.payment_status !== 'paid') {
    return { paid: false, reason: 'payment_not_complete' as const };
  }

  const admin = getSupabaseServerAdminClient();
  const { data: invoice, error: invoiceError } = await admin
    .from('invoices')
    .select('id, account_id, status, public_token')
    .eq('id', invoiceId)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return { paid: false, reason: 'invoice_not_found' as const };
  }

  if (token && invoice.public_token !== token) {
    return { paid: false, reason: 'token_mismatch' as const };
  }

  if (invoice.status !== 'paid') {
    const paymentIntentId = getPaymentIntentId(session);

    const { error: updateError } = await admin
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
        stripe_checkout_session_id: session.id,
      })
      .eq('id', invoice.id);

    if (updateError) {
      return { paid: false, reason: 'update_failed' as const };
    }

    await admin.from('invoice_events').insert({
      account_id: invoice.account_id,
      invoice_id: invoice.id,
      event_type: 'paid',
      payload: {
        checkout_session_id: session.id,
        payment_intent_id: paymentIntentId,
        source: 'stripe_checkout',
      },
      actor_id: null,
    });

    await sendInvoicePaidNotifications({
      accountId: invoice.account_id,
      invoiceId: invoice.id,
      paymentMethod: 'stripe',
    });
  }

  return { paid: true, reason: 'paid' as const, invoiceId: invoice.id };
}

/**
 * Create a Stripe Checkout Session for an invoice (portal: by token).
 * Callable without auth; invoice is looked up by public_token.
 * Returns the session URL to redirect the client.
 */
export async function createInvoiceCheckoutSessionByToken(token: string): Promise<string> {
  const stripe = getStripeClient();
  const admin = getSupabaseServerAdminClient();

  const { data: invoice, error: invError } = await admin
    .from('invoices')
    .select('id, account_id, client_id, total_pence, currency, status')
    .eq('public_token', token)
    .single();

  if (invError || !invoice) {
    throw new Error('Invoice not found');
  }
  if (invoice.status === 'cancelled') {
    throw new Error('This invoice has been cancelled');
  }
  if (invoice.status !== 'sent') {
    throw new Error('This invoice is not available for payment');
  }
  if (invoice.total_pence <= 0) {
    throw new Error('Invoice total must be greater than zero');
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? 'http://localhost:3000';
  const portalPath = `/portal/invoices/${encodeURIComponent(token)}`;
  const successUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}${portalPath}?paid=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}${portalPath}?cancelled=1`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: (invoice.currency ?? 'gbp').toLowerCase(),
          unit_amount: invoice.total_pence,
          product_data: {
            name: `Invoice ${invoice.id}`,
            description: 'Invoice payment',
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: invoice.id,
    metadata: {
      invoice_id: invoice.id,
      account_id: invoice.account_id,
    },
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session');
  }

  await admin
    .from('invoices')
    .update({
      stripe_checkout_session_id: session.id,
    })
    .eq('id', invoice.id);

  return session.url;
}

export async function reconcileInvoicePaymentByCheckoutSession(
  checkoutSessionId: string,
  token?: string,
) {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);

  return applyPaidCheckoutSession(session, token);
}

export async function applyInvoicePaymentFromCheckoutSession(
  session: Stripe.Checkout.Session,
) {
  return applyPaidCheckoutSession(session);
}
