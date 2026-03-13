import { NextResponse } from 'next/server';

import Stripe from 'stripe';

import { applyInvoicePaymentFromCheckoutSession } from '~/home/[account]/invoices/_lib/server/invoice-checkout';

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Stripe webhook for invoice payments.
 * Add this URL in Stripe Dashboard → Webhooks with event checkout.session.completed.
 * Uses the same STRIPE_WEBHOOK_SECRET as billing (or set STRIPE_INVOICE_WEBHOOK_SECRET).
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_INVOICE_WEBHOOK_SECRET ?? STRIPE_WEBHOOK_SECRET;
  if (!STRIPE_SECRET?.startsWith('sk_') || !secret?.startsWith('whsec_')) {
    return NextResponse.json(
      { error: 'Stripe webhook not configured' },
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
    const stripe = new Stripe(STRIPE_SECRET);
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const result = await applyInvoicePaymentFromCheckoutSession(session);

  if (!result.paid && result.reason === 'update_failed') {
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
