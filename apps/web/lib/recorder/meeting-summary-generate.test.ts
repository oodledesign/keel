import { describe, expect, it } from 'vitest';

import { attendeeEmailsFromCalendarAttendees } from './meeting-summary-generate';

describe('attendeeEmailsFromCalendarAttendees', () => {
  it('deduplicates and normalizes attendee emails', () => {
    expect(
      attendeeEmailsFromCalendarAttendees([
        { name: 'Alex', email: 'Alex@Example.com' },
        { name: 'Alex duplicate', email: 'alex@example.com' },
        { name: 'No email', email: '' },
        { name: 'Sam', email: 'sam@example.com' },
      ]),
    ).toEqual(['alex@example.com', 'sam@example.com']);
  });
});
