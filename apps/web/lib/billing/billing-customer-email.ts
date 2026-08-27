import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

type AnyClient = SupabaseClient<any>;

/** Stripe billing contact for the workspace (usually whoever completed checkout). */
export async function loadBillingCustomerEmail(
  admin: AnyClient,
  accountId: string,
  stripeCustomerId: string,
): Promise<string | null> {
  const customerId = stripeCustomerId.trim();
  if (!customerId) return null;

  const { data } = await admin
    .from('billing_customers')
    .select('email')
    .eq('account_id', accountId)
    .eq('provider', 'stripe')
    .eq('customer_id', customerId)
    .maybeSingle();

  const stored = (data?.email as string | null | undefined)?.trim();
  if (stored) return stored;

  try {
    const secret = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secret?.startsWith('sk_')) return null;

    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(secret);
    const customer = await stripe.customers.retrieve(customerId);

    if ('deleted' in customer && customer.deleted) {
      return null;
    }

    return customer.email?.trim() ?? null;
  } catch {
    return null;
  }
}
