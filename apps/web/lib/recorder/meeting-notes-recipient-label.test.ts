import { describe, expect, it } from 'vitest';

import {
  formatMeetingNotesRecipientLabel,
  resolveMeetingNotesRecipientName,
  usableRecipientName,
} from './meeting-notes-recipient-label';

describe('usableRecipientName', () => {
  it('returns a real display name', () => {
    expect(usableRecipientName('Dan Potter', 'dan@oodle.design')).toBe(
      'Dan Potter',
    );
  });

  it('rejects a missing or email-like name', () => {
    expect(usableRecipientName(null, 'dan@oodle.design')).toBeNull();
    expect(usableRecipientName('  ', 'dan@oodle.design')).toBeNull();
    expect(
      usableRecipientName('dan@oodle.design', 'dan@oodle.design'),
    ).toBeNull();
    expect(
      usableRecipientName('Dan@Oodle.Design', 'dan@oodle.design'),
    ).toBeNull();
    expect(usableRecipientName('other@example.com', 'dan@oodle.design')).toBe(
      null,
    );
  });
});

describe('formatMeetingNotesRecipientLabel', () => {
  it('formats name and email with a dash', () => {
    expect(
      formatMeetingNotesRecipientLabel({
        name: 'Dan Potter',
        email: 'dan@oodle.design',
      }),
    ).toEqual({
      name: 'Dan Potter',
      email: 'dan@oodle.design',
      label: 'Dan Potter - dan@oodle.design',
    });
  });

  it('shows the email once when the name is the email', () => {
    expect(
      formatMeetingNotesRecipientLabel({
        name: 'dan@oodle.design',
        email: 'dan@oodle.design',
      }),
    ).toEqual({
      name: null,
      email: 'dan@oodle.design',
      label: 'dan@oodle.design',
    });
  });
});

describe('resolveMeetingNotesRecipientName', () => {
  it('prefers a contact name over a calendar email name', () => {
    expect(
      resolveMeetingNotesRecipientName({
        email: 'dan@oodle.design',
        contacts: [{ name: 'Dan Potter', email: 'dan@oodle.design' }],
        attendees: [{ name: 'dan@oodle.design', email: 'dan@oodle.design' }],
      }),
    ).toBe('Dan Potter');
  });

  it('uses a usable calendar attendee name next', () => {
    expect(
      resolveMeetingNotesRecipientName({
        email: 'mick.haselden@angellane.org.uk',
        attendees: [
          {
            name: 'Mick Haselden',
            email: 'mick.haselden@angellane.org.uk',
          },
        ],
      }),
    ).toBe('Mick Haselden');
  });

  it('falls back to a workspace member', () => {
    expect(
      resolveMeetingNotesRecipientName({
        email: 'ada@oodle.design',
        members: [{ name: 'Ada Lovelace', email: 'ada@oodle.design' }],
      }),
    ).toBe('Ada Lovelace');
  });
});
