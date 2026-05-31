import { NextResponse } from 'next/server';

import Stripe from 'stripe';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  buildStripeConnectSettingsRedirect,
  getSiteOrigin,
  getStripeSecretKeyMode,
  verifyStripeConnectState,
} from '~/lib/billing/stripe-connect';

type UpsertResult = PromiseLike<{ error: { message: string } | null }>;

type DynamicAdmin = {
  from: (table: string) => {
    upsert: (
      values: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => UpsertResult;
  };
};

/**
 * GET /api/stripe-connect/callback?code=xxx&state=xxx
 * Stripe Connect OAuth callback — exchanges auth code for connected account ID.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const origin = getSiteOrigin();
  const state = verifyStripeConnectState(stateParam);
  const admin = getSupabaseServerAdminClient();

  const redirectWithError = async (errorCode: string) => {
    const message =
      errorParam === 'access_denied' ? 'access_denied' : errorCode;

    console.error('[stripe-connect] callback error:', {
      errorCode: message,
      stripeError: errorParam,
      errorDescription,
      businessId: state?.businessId ?? null,
    });

    return NextResponse.redirect(
      await buildStripeConnectSettingsRedirect(admin, {
        origin,
        businessId: state?.businessId ?? null,
        query: { stripe_connect_error: message },
      }),
    );
  };

  if (errorParam) {
    return redirectWithError(
      errorParam === 'access_denied' ? 'access_denied' : errorParam,
    );
  }

  if (!code || !stateParam) {
    return redirectWithError('missing_params');
  }

  if (!state) {
    return redirectWithError('invalid_state');
  }

  const client = getSupabaseServerClient();
  const { data: user } = await requireUser(client);

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/sign-in`);
  }

  if (state.userId !== user.id) {
    return redirectWithError('invalid_state');
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const keyMode = getStripeSecretKeyMode(stripeSecret);

  if (!stripeSecret || !keyMode) {
    return redirectWithError('stripe_not_configured');
  }

  const stripe = new Stripe(stripeSecret);

  try {
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    });

    const connectedAccountId = response.stripe_user_id;
    if (!connectedAccountId) {
      throw new Error('No stripe_user_id returned');
    }

    if (
      typeof response.livemode === 'boolean' &&
      ((keyMode === 'test' && response.livemode) ||
        (keyMode === 'live' && !response.livemode))
    ) {
      console.error('[stripe-connect] mode mismatch', {
        keyMode,
        oauthLivemode: response.livemode,
        businessId: state.businessId,
      });

      return redirectWithError('mode_mismatch');
    }

    const connectedAccount = await stripe.accounts.retrieve(connectedAccountId);
    const db = admin as unknown as DynamicAdmin;
    const { error: upsertError } = await db.from('agency_stripe').upsert(
      {
        business_id: state.businessId,
        stripe_account_id: connectedAccountId,
        stripe_account_email: connectedAccount.email ?? null,
        stripe_connect_enabled: true,
        stripe_pay_now_enabled: true,
      },
      { onConflict: 'business_id' },
    );

    if (upsertError) {
      console.error('Failed to save Stripe Connect account:', upsertError);
      return redirectWithError('save_failed');
    }

    return NextResponse.redirect(
      await buildStripeConnectSettingsRedirect(admin, {
        origin,
        businessId: state.businessId,
        query: { stripe_connected: '1' },
      }),
    );
  } catch (err) {
    const stripeMessage =
      err instanceof Stripe.errors.StripeError ? err.message : null;
    console.error('Stripe Connect OAuth error:', err, {
      businessId: state.businessId,
      keyMode,
      stripeMessage,
    });

    return redirectWithError('oauth_failed');
  }
}
