import { describe, expect, it } from 'vitest';

import {
  displayNameFromEmailLocalPart,
  formatEmailParticipantLabel,
  isUsableParticipantName,
  resolveEmailParticipantName,
} from './email-participant-label';

describe('isUsableParticipantName', () => {
  it('rejects empty names and names that equal the email', () => {
    expect(isUsableParticipantName('  ', 'dan@oodle.design')).toBe(false);
    expect(
      isUsableParticipantName('dan@oodle.design', 'dan@oodle.design'),
    ).toBe(false);
    expect(
      isUsableParticipantName('Dan@Oodle.Design', 'dan@oodle.design'),
    ).toBe(false);
    expect(isUsableParticipantName('Guest', 'dan@oodle.design')).toBe(false);
  });

  it('accepts a real display name', () => {
    expect(isUsableParticipantName('Dan Potter', 'dan@oodle.design')).toBe(
      true,
    );
  });
});

describe('displayNameFromEmailLocalPart', () => {
  it('title-cases dotted local parts', () => {
    expect(
      displayNameFromEmailLocalPart('mick.haselden@angellane.org.uk'),
    ).toBe('Mick Haselden');
  });

  it('strips plus tags and ignores numeric-only locals', () => {
    expect(displayNameFromEmailLocalPart('dan+meet@oodle.design')).toBe('Dan');
    expect(displayNameFromEmailLocalPart('12345@oodle.design')).toBeNull();
  });
});

describe('resolveEmailParticipantName', () => {
  it('prefers a contact name over a calendar name that is just the email', () => {
    expect(
      resolveEmailParticipantName('dan@oodle.design', {
        contacts: [{ name: 'Dan Potter', email: 'dan@oodle.design' }],
        calendarAttendees: [
          { name: 'dan@oodle.design', email: 'dan@oodle.design' },
        ],
      }),
    ).toBe('Dan Potter');
  });

  it('uses a calendar name when it is not the email', () => {
    expect(
      resolveEmailParticipantName('mick.haselden@angellane.org.uk', {
        calendarAttendees: [
          {
            name: 'Mick Haselden',
            email: 'mick.haselden@angellane.org.uk',
          },
        ],
      }),
    ).toBe('Mick Haselden');
  });

  it('falls back to a derived name instead of email-email', () => {
    expect(
      resolveEmailParticipantName('mick.haselden@angellane.org.uk', {
        calendarAttendees: [
          {
            name: 'mick.haselden@angellane.org.uk',
            email: 'mick.haselden@angellane.org.uk',
          },
        ],
      }),
    ).toBe('Mick Haselden');
  });
});

describe('formatEmailParticipantLabel', () => {
  it('formats name and email without duplicating the address', () => {
    expect(
      formatEmailParticipantLabel('Dan Potter', 'dan@oodle.design'),
    ).toEqual({
      displayName: 'Dan Potter',
      label: 'Dan Potter - dan@oodle.design',
    });
  });

  it('shows only the email when the name is unusable', () => {
    expect(
      formatEmailParticipantLabel('dan@oodle.design', 'dan@oodle.design'),
    ).toEqual({
      displayName: null,
      label: 'dan@oodle.design',
    });
  });
});
