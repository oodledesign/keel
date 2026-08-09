import 'server-only';

import Stripe from 'stripe';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  isSupportedInvoiceCurrency,
  normalizeInvoiceCurrency,
} from '../invoice-currency';
import {
  CARD_FEE_LINE_ITEM_NAME,
  estimateStripeCardFeePence,
  normalizeStripeCardFeeMode,
} from '../invoice-stripe-fee';
import { sendInvoicePaidNotifications } from './invoice-notifications';
import { loadPaymentSettingsForPortal } from './invoice-payment-settings.service';
import {
  getCheckoutAmountPence,
  recordInvoicePayment,
} from './invoice-v2.server';

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
    : (session.payment_intent?.id ?? null);
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
    .select(
      'id, account_id, status, public_token, total_pence, amount_paid_pence, deposit_type, deposit_value',
    )
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
    const payDepositOnly = session.metadata?.pay_deposit_only === '1';
    // Always record the invoice portion only — never include passed-through card fees.
    const amount = getCheckoutAmountPence(
      {
        total_pence: invoice.total_pence ?? 0,
        amount_paid_pence: invoice.amount_paid_pence,
        deposit_type: (invoice as { deposit_type?: string | null })
          .deposit_type,
        deposit_value: (invoice as { deposit_value?: number | null })
          .deposit_value,
      },
      payDepositOnly,
    );

    if (amount <= 0) {
      return { paid: false, reason: 'nothing_to_pay' as const };
    }

    await recordInvoicePayment({
      accountId: invoice.account_id,
      invoiceId: invoice.id,
      amount_pence: amount,
      payment_method: 'stripe',
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      actorId: null,
    });

    await admin
      .from('invoices')
      .update({
        stripe_payment_intent_id: paymentIntentId,
        stripe_checkout_session_id: session.id,
      })
      .eq('id', invoice.id);

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

export async function createInvoiceCheckoutSessionByToken(
  token: string,
  options?: { payDepositOnly?: boolean },
): Promise<string> {
  const stripe = getStripeClient();
  const admin = getSupabaseServerAdminClient();

  const { data: invoice, error: invError } = await admin
    .from('invoices')
    .select('*')
    .eq('public_token', token)
    .single();

  if (invError || !invoice) {
    throw new Error('Invoice not found');
  }
  if (['cancelled', 'void'].includes(invoice.status)) {
    throw new Error('This invoice is no longer payable');
  }
  if (!['sent', 'read'].includes(invoice.status)) {
    throw new Error('This invoice is not available for payment');
  }

  const paymentSettings = await loadPaymentSettingsForPortal(
    invoice.account_id,
  );
  if (
    !paymentSettings?.stripe_connect_enabled ||
    !paymentSettings.stripe_account_id ||
    !paymentSettings.stripe_pay_now_enabled
  ) {
    throw new Error('Card payments are not enabled for this invoice');
  }

  const amount = getCheckoutAmountPence(
    invoice,
    options?.payDepositOnly ?? false,
  );
  if (amount <= 0) {
    throw new Error('Nothing left to pay on this invoice');
  }

  if (!isSupportedInvoiceCurrency(invoice.currency)) {
    throw new Error(
      `This invoice currency (${String(invoice.currency ?? '').toUpperCase() || 'unknown'}) is not supported for card payments.`,
    );
  }
  const currency = normalizeInvoiceCurrency(invoice.currency);
  const feeMode = normalizeStripeCardFeeMode(
    paymentSettings.stripe_card_fee_mode,
  );
  const feePence = estimateStripeCardFeePence(amount, currency);
  // application_fee must be less than the charge amount
  const applicationFeeAmount = Math.min(
    feePence,
    Math.max(0, amount + (feeMode === 'pass_to_client' ? feePence : 0) - 1),
  );

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_URL ??
    'http://localhost:3000';
  const portalPath = `/portal/invoices/${encodeURIComponent(token)}`;
  const successUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}${portalPath}?paid=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}${portalPath}?cancelled=1`;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency,
        unit_amount: amount,
        product_data: {
          name: `Invoice ${invoice.invoice_number}`,
          description: options?.payDepositOnly
            ? 'Deposit payment'
            : 'Invoice payment',
        },
      },
      quantity: 1,
    },
  ];

  if (feeMode === 'pass_to_client' && feePence > 0) {
    lineItems.push({
      price_data: {
        currency,
        unit_amount: feePence,
        product_data: {
          name: CARD_FEE_LINE_ITEM_NAME,
          description: 'Estimated card processing fee',
        },
      },
      quantity: 1,
    });
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: invoice.id,
      metadata: {
        invoice_id: invoice.id,
        account_id: invoice.account_id,
        pay_deposit_only: options?.payDepositOnly ? '1' : '0',
        stripe_card_fee_mode: feeMode,
        card_fee_pence: String(feePence),
      },
      payment_intent_data: {
        transfer_data: {
          destination: paymentSettings.stripe_account_id,
        },
        ...(applicationFeeAmount > 0
          ? { application_fee_amount: applicationFeeAmount }
          : {}),
        metadata: {
          invoice_id: invoice.id,
          account_id: invoice.account_id,
          stripe_card_fee_mode: feeMode,
        },
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error);
    if (
      message.includes('currency') ||
      message.includes('not supported') ||
      message.includes('invalid')
    ) {
      throw new Error(
        `Card payments are not available in ${currency.toUpperCase()} for this Stripe account. Ask the business to enable that currency in Stripe, or pay by bank transfer.`,
      );
    }
    throw error instanceof Error
      ? error
      : new Error('Could not start card payment');
  }

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
