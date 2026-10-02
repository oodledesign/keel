import { describe, expect, it, vi } from 'vitest';

import {
  type StoredCheckoutSession,
  isStripeResourceMissing,
  resolveStoredCheckout,
} from './pending-checkout';

const LINK = 'https://checkout.stripe.com/c/pay/cs_live_saved';
const SESSION_ID = 'cs_live_saved';
const stored = { stripePaymentLink: LINK, stripeCheckoutSessionId: SESSION_ID };

function session(
  overrides: Partial<StoredCheckoutSession>,
): StoredCheckoutSession {
  return {
    status: 'open',
    payment_status: 'unpaid',
    url: 'https://checkout.stripe.com/c/pay/cs_live_fresh_from_stripe',
    ...overrides,
  };
}

describe('resolveStoredCheckout', () => {
  it('reuses a session Stripe still reports as open', async () => {
    const retrieve = vi.fn().mockResolvedValue(session({ status: 'open' }));

    await expect(resolveStoredCheckout(stored, retrieve)).resolves.toEqual({
      kind: 'reuse',
      url: 'https://checkout.stripe.com/c/pay/cs_live_fresh_from_stripe',
    });
    expect(retrieve).toHaveBeenCalledWith(SESSION_ID);
  });

  it('falls back to the saved link when an open session has no url', async () => {
    const retrieve = vi
      .fn()
      .mockResolvedValue(session({ status: 'open', url: null }));

    await expect(resolveStoredCheckout(stored, retrieve)).resolves.toEqual({
      kind: 'reuse',
      url: LINK,
    });
  });

  it('replaces an expired session (the "You\'re all done here" case)', async () => {
    const retrieve = vi.fn().mockResolvedValue(session({ status: 'expired' }));

    await expect(resolveStoredCheckout(stored, retrieve)).resolves.toEqual({
      kind: 'create',
    });
  });

  it('confirms instead of re-charging when the client already paid', async () => {
    const retrieve = vi
      .fn()
      .mockResolvedValue(
        session({ status: 'complete', payment_status: 'paid' }),
      );

    await expect(resolveStoredCheckout(stored, retrieve)).resolves.toEqual({
      kind: 'paid',
      sessionId: SESSION_ID,
    });
  });

  it('never creates a second session while a completed payment is clearing', async () => {
    const retrieve = vi
      .fn()
      .mockResolvedValue(
        session({ status: 'complete', payment_status: 'unpaid' }),
      );

    await expect(resolveStoredCheckout(stored, retrieve)).resolves.toEqual({
      kind: 'processing',
    });
  });

  it('creates a session when Stripe no longer has the saved one', async () => {
    const retrieve = vi.fn().mockResolvedValue(null);

    await expect(resolveStoredCheckout(stored, retrieve)).resolves.toEqual({
      kind: 'create',
    });
  });

  it('creates a session when nothing verifiable is saved, without calling Stripe', async () => {
    const retrieve = vi.fn();

    await expect(
      resolveStoredCheckout(
        { stripePaymentLink: LINK, stripeCheckoutSessionId: null },
        retrieve,
      ),
    ).resolves.toEqual({ kind: 'create' });
    await expect(
      resolveStoredCheckout(
        { stripePaymentLink: null, stripeCheckoutSessionId: SESSION_ID },
        retrieve,
      ),
    ).resolves.toEqual({ kind: 'create' });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('lets Stripe outages propagate rather than creating duplicate sessions', async () => {
    const retrieve = vi.fn().mockRejectedValue(new Error('Stripe is down'));

    await expect(resolveStoredCheckout(stored, retrieve)).rejects.toThrow(
      'Stripe is down',
    );
  });
});

describe('isStripeResourceMissing', () => {
  it('recognises Stripe resource_missing errors only', () => {
    expect(isStripeResourceMissing({ code: 'resource_missing' })).toBe(true);
    expect(isStripeResourceMissing({ code: 'rate_limit' })).toBe(false);
    expect(isStripeResourceMissing(new Error('nope'))).toBe(false);
    expect(isStripeResourceMissing(null)).toBe(false);
  });
});
