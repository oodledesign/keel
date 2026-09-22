import { describe, expect, it } from 'vitest';

import {
  mergeMeetingNotesRecipientEmails,
  primaryContactEmail,
} from './meeting-notes-recipient-emails';

describe('primaryContactEmail', () => {
  it('prefers the primary address, then any address, then the contact email', () => {
    expect(
      primaryContactEmail({
        email: 'legacy@client.test',
        emails: [
          { email: 'other@client.test', is_primary: false },
          { email: 'primary@client.test', is_primary: true },
        ],
      }),
    ).toBe('primary@client.test');

    expect(
      primaryContactEmail({
        email: null,
        emails: [{ email: ' only@client.test ', is_primary: false }],
      }),
    ).toBe('only@client.test');

    expect(primaryContactEmail({ email: ' person@client.test ' })).toBe(
      'person@client.test',
    );
    expect(primaryContactEmail({ email: '   ', emails: [] })).toBeNull();
  });
});

describe('mergeMeetingNotesRecipientEmails', () => {
  it('keeps calendar participants first and appends client contacts', () => {
    expect(
      mergeMeetingNotesRecipientEmails({
        participantEmails: ['mia@client.test', 'alex@client.test'],
        clientContactEmails: [
          'primary@client.test',
          'alex@client.test',
          'sam@client.test',
        ],
      }),
    ).toEqual([
      'mia@client.test',
      'alex@client.test',
      'primary@client.test',
      'sam@client.test',
    ]);
  });

  it('dedupes by email and skips invalid addresses', () => {
    expect(
      mergeMeetingNotesRecipientEmails({
        participantEmails: ['Alex@Client.test', 'not-an-email', ''],
        clientContactEmails: [' alex@client.test ', 'sam@client.test', 'nope'],
      }),
    ).toEqual(['alex@client.test', 'sam@client.test']);
  });

  it('does not add the workspace user from client contacts', () => {
    expect(
      mergeMeetingNotesRecipientEmails({
        participantEmails: [],
        clientContactEmails: ['dan@oodle.design', 'sam@client.test'],
        currentUserEmails: ['Dan@oodle.design'],
      }),
    ).toEqual(['sam@client.test']);
  });

  it('keeps the workspace user when they are already a call participant', () => {
    expect(
      mergeMeetingNotesRecipientEmails({
        participantEmails: ['dan@oodle.design', 'mia@client.test'],
        clientContactEmails: ['dan@oodle.design', 'sam@client.test'],
        currentUserEmails: ['dan@oodle.design', 'dan@oodle.design'],
      }),
    ).toEqual(['dan@oodle.design', 'mia@client.test', 'sam@client.test']);
  });

  it('returns nothing when neither source has an email', () => {
    expect(
      mergeMeetingNotesRecipientEmails({
        participantEmails: ['', 'missing-at'],
        clientContactEmails: [],
        currentUserEmails: ['dan@oodle.design'],
      }),
    ).toEqual([]);
  });
});
