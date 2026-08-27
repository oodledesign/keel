import 'server-only';

import { cache } from 'react';

import Stripe from 'stripe';

import { getStripeClientSecret } from '~/lib/billing/stripe-connect';

export type PlatformBillingInvoice = {
  id: string;
  number: string | null;
  status: string;
  amountPaidPence: number;
  currency: string;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

function mapStripeInvoice(invoice: Stripe.Invoice): PlatformBillingInvoice {
  return {
    id: invoice.id,
    number: invoice.number ?? null,
    status: invoice.status ?? 'paid',
    amountPaidPence: invoice.amount_paid ?? 0,
    currency: (invoice.currency ?? 'gbp').toLowerCase(),
    paidAt: invoice.status_transitions?.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
      : invoice.created
        ? new Date(invoice.created * 1000).toISOString()
        : null,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdf: invoice.invoice_pdf ?? null,
  };
}

/**
 * Paid platform Stripe invoices for a workspace billing customer (not Connect).
 */
export const loadPlatformBillingInvoices = cache(
  async (
    stripeCustomerId: string,
    stripeSubscriptionId?: string | null,
  ): Promise<PlatformBillingInvoice[]> => {
    const customerId = stripeCustomerId.trim();
    if (!customerId) {
      return [];
    }

    const subscriptionId = stripeSubscriptionId?.trim() || undefined;

    try {
      const stripe = new Stripe(getStripeClientSecret());
      const list = await stripe.invoices.list({
        customer: customerId,
        ...(subscriptionId ? { subscription: subscriptionId } : {}),
        status: 'paid',
        limit: 24,
      });

      return list.data
        .map(mapStripeInvoice)
        .sort((a, b) => {
          const at = a.paidAt ? Date.parse(a.paidAt) : 0;
          const bt = b.paidAt ? Date.parse(b.paidAt) : 0;
          return bt - at;
        });
    } catch (error) {
      console.error('[platform-billing] stripe invoice list failed', error);
      return [];
    }
  },
);
