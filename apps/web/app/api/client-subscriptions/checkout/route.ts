import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createPlanTemplatesService } from '~/home/[account]/settings/services/_lib/server/plan-templates.service';
import {
  createClientSubscriptionCheckout,
  reconcileClientSubscriptionCheckoutSession,
} from '~/lib/billing/subscription-checkout';

/**
 * GET /api/client-subscriptions/checkout?subscriptionId=xxx
 * Public redirect / success reconcile for client subscriptions.
 * Prefers G2 connected-account reconcile when account_id is present.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subscriptionId = searchParams.get('subscriptionId');
  const sessionId = searchParams.get('session_id');
  const completed = searchParams.get('completed');
  const cancelled = searchParams.get('cancelled');

  if (!subscriptionId) {
    return NextResponse.json(
      { error: 'subscriptionId is required' },
      { status: 400 },
    );
  }

  if (completed === '1' && sessionId) {
    try {
      const admin = getSupabaseServerAdminClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- G2 columns pending typegen
      const { data: row } = await (admin as any)
        .from('client_subscriptions')
        .select('id, account_id, stripe_checkout_session_id')
        .eq('id', subscriptionId)
        .maybeSingle();

      if (
        row?.stripe_checkout_session_id &&
        row.stripe_checkout_session_id !== sessionId
      ) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
      }

      if (row?.account_id) {
        await createPlanTemplatesService(
          admin as never,
        ).reconcileCheckoutSession(subscriptionId, sessionId);
      } else {
        await reconcileClientSubscriptionCheckoutSession(
          sessionId,
          subscriptionId,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not confirm payment';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, subscriptionId });
  }

  if (cancelled === '1') {
    return NextResponse.json({ ok: true, cancelled: true, subscriptionId });
  }

  try {
    // G2 rows already store Checkout URL on stripe_payment_link
    const admin = getSupabaseServerAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- G2 columns pending typegen
    const { data: row } = await (admin as any)
      .from('client_subscriptions')
      .select('stripe_payment_link, account_id')
      .eq('id', subscriptionId)
      .maybeSingle();

    if (row?.stripe_payment_link && row?.account_id) {
      return NextResponse.redirect(String(row.stripe_payment_link), {
        status: 303,
      });
    }

    const url = await createClientSubscriptionCheckout(subscriptionId);
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not start checkout';

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
