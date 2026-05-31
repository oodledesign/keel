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

type BusinessMember = {
  role?: string | null;
};

type QueryBuilder<T> = PromiseLike<{
  data: T | null;
  error: { message: string } | null;
}> & {
  select: (columns: string) => QueryBuilder<T>;
  eq: (column: string, value: string) => QueryBuilder<T>;
  maybeSingle: () => Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
};

type DynamicClient = {
  from: (table: string) => {
    select: <T>(columns: string) => QueryBuilder<T>;
  };
};

/**
 * GET /api/stripe-connect/authorize?businessId=xxx
 * Redirects an agency owner/admin to the Stripe Connect OAuth flow.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('businessId');

  if (!businessId) {
    return NextResponse.json(
      { error: 'businessId is required' },
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

  const db = client as unknown as DynamicClient;
  const { data: membership } = await db
    .from('business_members')
    .select<BusinessMember>('role')
    .eq('business_id', businessId)
    .eq('user_id', user.id)
    .maybeSingle();

  const role = membership?.role;
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json(
      { error: 'Only owners and admins can connect Stripe' },
      { status: 403 },
    );
  }

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const keyMode = getStripeSecretKeyMode(stripeSecret);
  const origin = getSiteOrigin();

  if (!clientId || !stripeSecret || !keyMode) {
    const admin = getSupabaseServerAdminClient();
    return NextResponse.redirect(
      await buildStripeConnectSettingsRedirect(admin, {
        origin,
        businessId,
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
    businessId,
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
