/**
 * Decides what "Pay now" should do for a retainer that already has a saved
 * Stripe Checkout session.
 *
 * Checkout sessions expire (24h by default), and a saved URL for an expired or
 * completed session shows Stripe's "You're all done here" page. So the saved
 * link is only reused after Stripe confirms the session is still open.
 */

/** The parts of a Stripe Checkout Session this decision needs. */
export type StoredCheckoutSession = {
  /** Stripe: 'open' | 'complete' | 'expired'. */
  status: string | null;
  /** Stripe: 'paid' | 'unpaid' | 'no_payment_required'. */
  payment_status: string | null;
  url: string | null;
};

export type StoredCheckoutResolution =
  /** Session is still open: send the client to it. */
  | { kind: 'reuse'; url: string }
  /** Client already paid: confirm the subscription, do not charge again. */
  | { kind: 'paid'; sessionId: string }
  /** Checkout finished but payment has not cleared yet (e.g. bank debit). */
  | { kind: 'processing' }
  /** Nothing usable saved: create a fresh session. */
  | { kind: 'create' };

export async function resolveStoredCheckout(
  stored: {
    stripePaymentLink: string | null;
    stripeCheckoutSessionId: string | null;
  },
  /**
   * Fetch the session from Stripe. Resolve `null` when Stripe no longer has
   * it; let any other failure throw so a Stripe outage never creates
   * duplicate sessions.
   */
  retrieve: (sessionId: string) => Promise<StoredCheckoutSession | null>,
): Promise<StoredCheckoutResolution> {
  const { stripePaymentLink, stripeCheckoutSessionId } = stored;

  // Without the session id the saved URL cannot be verified, so replace it.
  if (!stripePaymentLink || !stripeCheckoutSessionId) {
    return { kind: 'create' };
  }

  const session = await retrieve(stripeCheckoutSessionId);
  if (!session) {
    return { kind: 'create' };
  }

  if (session.status === 'open') {
    return { kind: 'reuse', url: session.url ?? stripePaymentLink };
  }

  if (session.status === 'complete') {
    // Never create a second session once the client has completed one.
    return session.payment_status === 'paid'
      ? { kind: 'paid', sessionId: stripeCheckoutSessionId }
      : { kind: 'processing' };
  }

  // expired (or an unknown status): the saved link is dead.
  return { kind: 'create' };
}

/** True when a Stripe error means the object does not exist. */
export function isStripeResourceMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'resource_missing'
  );
}
