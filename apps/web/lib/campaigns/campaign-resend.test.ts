import { describe, expect, it } from 'vitest';

import {
  followUpCampaignName,
  nonResponderEmails,
  uniqueRecipientEmails,
} from './campaign-resend';

describe('uniqueRecipientEmails', () => {
  it('dedupes and lowercases', () => {
    expect(
      uniqueRecipientEmails([
        { email: 'Ada@Example.com' },
        { email: 'ada@example.com' },
        { email: '  ' },
        { email: 'bob@example.com' },
      ]),
    ).toEqual(['ada@example.com', 'bob@example.com']);
  });
});

describe('nonResponderEmails', () => {
  it('drops people who already submitted an RSVP', () => {
    expect(
      nonResponderEmails(
        [
          { email: 'ada@example.com' },
          { email: 'bob@example.com' },
          { email: 'cam@example.com' },
        ],
        [{ contactEmail: 'Bob@example.com' }, { contactEmail: null }],
      ),
    ).toEqual(['ada@example.com', 'cam@example.com']);
  });
});

describe('followUpCampaignName', () => {
  it('appends a follow-up suffix within 160 chars', () => {
    expect(followUpCampaignName('Launch')).toBe('Launch (follow-up)');
    const long = 'A'.repeat(160);
    const named = followUpCampaignName(long);
    expect(named.endsWith(' (follow-up)')).toBe(true);
    expect(named.length).toBeLessThanOrEqual(160);
  });
});
