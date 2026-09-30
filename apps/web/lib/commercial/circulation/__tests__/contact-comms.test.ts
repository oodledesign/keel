import { describe, expect, it } from 'vitest';

import {
  type ConsentRowInput,
  describeLastEmail,
  matchesCirculationFilter,
  needsAttention,
  pickCirculationStatus,
  pickNewsletterStatus,
  resolveNotEmailedReason,
} from '../contact-comms';

const row = (
  email: string,
  marketingStatus: string,
  autoSendEnabled: boolean | null = true,
): ConsentRowInput => ({
  email,
  clientId: 'c1',
  marketingStatus,
  autoSendEnabled,
});

describe('pickCirculationStatus', () => {
  it('returns none with no consent rows', () => {
    expect(pickCirculationStatus([], new Set(['a@x.com']))).toBe('none');
  });

  it('treats a subscriber with auto-send off as paused', () => {
    expect(
      pickCirculationStatus(
        [row('a@x.com', 'subscribed', false)],
        new Set(['a@x.com']),
      ),
    ).toBe('paused');
  });

  it('lets the current address win over an old subscribed address', () => {
    expect(
      pickCirculationStatus(
        [row('old@x.com', 'subscribed'), row('new@x.com', 'unsubscribed')],
        new Set(['new@x.com']),
      ),
    ).toBe('unsubscribed');
  });

  it('falls back to client-linked rows when the current address has none', () => {
    expect(
      pickCirculationStatus(
        [row('old@x.com', 'subscribed')],
        new Set(['new@x.com']),
      ),
    ).toBe('subscribed');
  });
});

describe('pickNewsletterStatus', () => {
  it('prefers subscribed across the primary address rows', () => {
    expect(
      pickNewsletterStatus(
        [row('a@x.com', 'unsubscribed'), row('a@x.com', 'subscribed')],
        new Set(['a@x.com']),
      ),
    ).toBe('subscribed');
  });
});

describe('matchesCirculationFilter', () => {
  it('groups suppressed with unsubscribed and none with not subscribed', () => {
    expect(matchesCirculationFilter('suppressed', 'unsubscribed')).toBe(true);
    expect(matchesCirculationFilter('none', 'not_subscribed')).toBe(true);
    expect(matchesCirculationFilter('paused', 'subscribed')).toBe(false);
  });
});

describe('resolveNotEmailedReason', () => {
  const base = {
    activeRequirementCount: 1,
    hasRecipientEmail: true,
    circulationStatus: 'subscribed' as const,
    lastCirculatedAt: null,
    lastFailedAt: null,
    lastSentAt: null,
    minGapDays: 5,
    now: new Date('2026-09-30T12:00:00Z'),
  };

  it('returns null with no active requirement or when eligible', () => {
    expect(
      resolveNotEmailedReason({ ...base, activeRequirementCount: 0 }),
    ).toBeNull();
    expect(resolveNotEmailedReason(base)).toBeNull();
  });

  it('explains missing email, unsubscribes and pauses', () => {
    expect(resolveNotEmailedReason({ ...base, hasRecipientEmail: false })).toBe(
      'no_email',
    );
    expect(
      resolveNotEmailedReason({ ...base, circulationStatus: 'unsubscribed' }),
    ).toBe('unsubscribed');
    expect(
      resolveNotEmailedReason({ ...base, circulationStatus: 'paused' }),
    ).toBe('paused');
    expect(
      resolveNotEmailedReason({ ...base, circulationStatus: 'none' }),
    ).toBe('not_subscribed');
  });

  it('flags the minimum gap and unresolved failures', () => {
    expect(
      resolveNotEmailedReason({
        ...base,
        lastCirculatedAt: '2026-09-28T12:00:00Z',
      }),
    ).toBe('recently_emailed');
    expect(
      resolveNotEmailedReason({
        ...base,
        lastFailedAt: '2026-09-29T12:00:00Z',
        lastSentAt: '2026-09-20T12:00:00Z',
      }),
    ).toBe('last_send_failed');
    expect(
      resolveNotEmailedReason({
        ...base,
        lastFailedAt: '2026-09-20T12:00:00Z',
        lastSentAt: '2026-09-29T12:00:00Z',
        lastCirculatedAt: '2026-09-20T12:00:00Z',
      }),
    ).toBeNull();
  });
});

describe('needsAttention', () => {
  it('only flags contacts with an active requirement', () => {
    const flagged = {
      hasRecipientEmail: false,
      circulationStatus: 'subscribed' as const,
      hasUnresolvedFailure: false,
    };
    expect(needsAttention({ ...flagged, activeRequirementCount: 0 })).toBe(
      false,
    );
    expect(needsAttention({ ...flagged, activeRequirementCount: 2 })).toBe(
      true,
    );
  });
});

describe('describeLastEmail', () => {
  const NOW = new Date('2026-09-30T12:00:00Z');

  it('summarises a circulation digest', () => {
    expect(
      describeLastEmail(
        {
          kind: 'circulation_digest',
          sentAt: '2026-09-12T08:00:00Z',
          subject: '3 new properties',
          listingCount: 3,
          listingNames: ['Unit 4 Riverside Park'],
          automatic: true,
        },
        NOW,
      ),
    ).toBe(
      'Circulation digest, 3 properties (Unit 4 Riverside Park, +2), 12 Sep, automatic',
    );
  });

  it('summarises a campaign by subject', () => {
    expect(
      describeLastEmail(
        {
          kind: 'campaign',
          sentAt: '2026-09-01T08:00:00Z',
          subject: 'Autumn update',
          listingCount: 0,
          listingNames: [],
          automatic: false,
        },
        NOW,
      ),
    ).toBe('Campaign, “Autumn update”, 1 Sep');
  });
});
