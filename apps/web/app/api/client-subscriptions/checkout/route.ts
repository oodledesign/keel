import { NextResponse } from 'next/server';

import {
  createClientSubscriptionCheckout,
  reconcileClientSubscriptionCheckoutSession,
} from '~/lib/billing/subscription-checkout';

/**
 * GET /api/client-subscriptions/checkout?subscriptionId=xxx
 * Public redirect to Stripe Checkout for a client subscription.
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
      await reconcileClientSubscriptionCheckoutSession(
        sessionId,
        subscriptionId,
      );
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
    const url = await createClientSubscriptionCheckout(subscriptionId);
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not start checkout';

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
