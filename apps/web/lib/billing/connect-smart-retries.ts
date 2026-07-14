import 'server-only';

import Stripe from 'stripe';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { getStripeClientSecret } from '~/lib/billing/stripe-connect';

/**
 * Smart Retries for subscription invoices are configured in the connected
 * account's Stripe Billing Dashboard (Revenue recovery → Retries). There is no
 * public Stripe API to toggle Smart Retries on behalf of a connected account.
 *
 * We record that Ozer guided/confirmed Connect so ops know to verify retries,
 * and open an Account Login Link when possible so the agency can enable them.
 */
export async function ensureConnectedAccountSmartRetries(
  accountId: string,
  stripeAccountId: string,
): Promise<{ configured: boolean; loginUrl: string | null }> {
  const admin = getSupabaseServerAdminClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- G4 column pending typegen
  const stripe = new Stripe(getStripeClientSecret());

  let loginUrl: string | null = null;
  try {
    const link = await stripe.accounts.createLoginLink(stripeAccountId);
    loginUrl = link.url;
  } catch {
    // Express/Standard may reject login links depending on Controllers; ignore.
  }

  await admin.from('account_payment_settings').upsert(
    {
      account_id: accountId,
      stripe_smart_retries_configured_at: new Date().toISOString(),
    },
    { onConflict: 'account_id' },
  );

  console.info(
    '[connect-billing] Smart Retries are Dashboard-managed on the connected account. Enable at Billing → Revenue recovery → Retries.',
    { accountId, stripeAccountId, hasLoginLink: Boolean(loginUrl) },
  );

  return { configured: Boolean(loginUrl), loginUrl };
}
