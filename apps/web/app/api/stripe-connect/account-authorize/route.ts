import { NextResponse } from 'next/server';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  buildStripeConnectSettingsRedirect,
  getSiteOrigin,
  getStripeSecretKeyMode,
  signStripeConnectState,
} from '~/lib/billing/stripe-connect';

/**
 * GET /api/stripe-connect/account-authorize?accountId=xxx
 * Redirects a workspace owner/admin to Stripe Connect OAuth for invoice payments.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');

  if (!accountId) {
    return NextResponse.json(
      { error: 'accountId is required' },
      { status: 400 },
    );
  }

  const client = getSupabaseServerClient();
  const { data: user } = await requireUser(client);

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (
    membership?.account_role !== 'owner' &&
    membership?.account_role !== 'admin'
  ) {
    return NextResponse.json(
      { error: 'Only owners and admins can connect Stripe' },
      { status: 403 },
    );
  }

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const keyMode = getStripeSecretKeyMode(stripeSecret);
  const origin = getSiteOrigin();
  const admin = getSupabaseServerAdminClient();

  if (!clientId || !stripeSecret || !keyMode) {
    return NextResponse.redirect(
      await buildStripeConnectSettingsRedirect(admin, {
        origin,
        accountId,
        query: {
          stripe_connect_error: !clientId
            ? 'connect_not_configured'
            : 'stripe_not_configured',
        },
      }),
    );
  }

  const redirectUri = `${origin}/api/stripe-connect/callback`;
  const state = signStripeConnectState({
    accountId,
    userId: user.id,
    exp: Date.now() + 10 * 60_000,
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_write',
    redirect_uri: redirectUri,
    state,
    'stripe_user[email]': user.email ?? '',
  });

  return NextResponse.redirect(
    `https://connect.stripe.com/oauth/authorize?${params.toString()}`,
  );
}
