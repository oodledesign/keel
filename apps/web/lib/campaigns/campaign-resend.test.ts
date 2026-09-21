import { describe, expect, it } from 'vitest';

import {
  followUpAudienceEmails,
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

describe('followUpAudienceEmails', () => {
  const recipients = [
    { email: 'ada@example.com' },
    { email: 'bob@example.com' },
  ];

  it('snapshots every invited email for send-again-to-all', () => {
    expect(
      followUpAudienceEmails({
        mode: 'all',
        recipients,
        responderEmails: [{ contactEmail: 'ada@example.com' }],
      }),
    ).toEqual(['ada@example.com', 'bob@example.com']);
  });

  it('excludes RSVP respondents for non-responders', () => {
    expect(
      followUpAudienceEmails({
        mode: 'non_responders',
        recipients,
        responderEmails: [{ contactEmail: 'ADA@example.com' }],
      }),
    ).toEqual(['bob@example.com']);
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
