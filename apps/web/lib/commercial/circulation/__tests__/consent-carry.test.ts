import { describe, expect, it } from 'vitest';

import { planConsentCarry } from '../consent-carry';

describe('planConsentCarry', () => {
  it('does nothing when the old address had no consent record', () => {
    expect(planConsentCarry(null, null)).toEqual({ kind: 'none' });
    expect(planConsentCarry(null, 'unsubscribed')).toEqual({ kind: 'none' });
  });

  it('copies consent to a new address with no record of its own', () => {
    expect(planConsentCarry('subscribed', null)).toEqual({ kind: 'copy' });
    expect(planConsentCarry('unsubscribed', null)).toEqual({ kind: 'copy' });
  });

  it('never re-subscribes an unsubscribed or suppressed address', () => {
    expect(planConsentCarry('subscribed', 'unsubscribed')).toEqual({
      kind: 'none',
    });
    expect(planConsentCarry('subscribed', 'suppressed')).toEqual({
      kind: 'none',
    });
    expect(planConsentCarry('unsubscribed', 'suppressed')).toEqual({
      kind: 'none',
    });
  });

  it('makes the new address stricter when the old one was blocked', () => {
    expect(planConsentCarry('unsubscribed', 'subscribed')).toEqual({
      kind: 'restrict',
      status: 'unsubscribed',
    });
    expect(planConsentCarry('suppressed', 'unsubscribed')).toEqual({
      kind: 'restrict',
      status: 'suppressed',
    });
  });
});
