import { describe, expect, it } from 'vitest';

import {
  type UpcomingMeetingItem,
  calendarEventHasOtherParticipants,
  isUpcomingMeetingActive,
  mergeUpcomingMeetings,
  otherParticipantLabel,
  upcomingMeetingsMatch,
} from './upcoming-meetings';

const userEmails = ['dan@example.com'];

function meeting(
  overrides: Partial<UpcomingMeetingItem> = {},
): UpcomingMeetingItem {
  return {
    id: 'cal-1',
    title: 'Client sync',
    startAt: '2099-01-02T10:00:00.000Z',
    endAt: '2099-01-02T10:30:00.000Z',
    inviteeName: 'Alex Example',
    conferencingUrl: 'https://meet.google.com/abc',
    detailHref: 'https://calendar.google.com/event?eid=1',
    source: 'calendar',
    ...overrides,
  };
}

describe('calendarEventHasOtherParticipants', () => {
  it('excludes events with no attendees', () => {
    expect(calendarEventHasOtherParticipants(undefined, userEmails)).toBe(
      false,
    );
    expect(calendarEventHasOtherParticipants([], userEmails)).toBe(false);
  });

  it('excludes solo blocks that only list the current user', () => {
    expect(
      calendarEventHasOtherParticipants(
        [{ email: 'dan@example.com', self: true }],
        userEmails,
      ),
    ).toBe(false);
    expect(
      calendarEventHasOtherParticipants(
        [{ email: 'dan@example.com' }],
        userEmails,
      ),
    ).toBe(false);
  });

  it('includes events with any other human attendee', () => {
    expect(
      calendarEventHasOtherParticipants(
        [
          { email: 'dan@example.com', self: true },
          { email: 'alex@example.com', displayName: 'Alex' },
        ],
        userEmails,
      ),
    ).toBe(true);
    expect(
      calendarEventHasOtherParticipants(
        [{ email: 'alex@example.com', displayName: 'Alex' }],
        userEmails,
      ),
    ).toBe(true);
  });

  it('includes events with more than one attendee even without user email', () => {
    expect(
      calendarEventHasOtherParticipants([
        { email: 'alex@example.com' },
        { email: 'sam@example.com' },
      ]),
    ).toBe(true);
  });

  it('excludes a single unknown attendee when the user cannot be identified', () => {
    expect(
      calendarEventHasOtherParticipants([{ email: 'alex@example.com' }]),
    ).toBe(false);
  });

  it('ignores room resources when counting people', () => {
    expect(
      calendarEventHasOtherParticipants(
        [
          { email: 'dan@example.com', self: true },
          { email: 'room@example.com', resource: true },
        ],
        userEmails,
      ),
    ).toBe(false);
  });

  it('excludes events the user declined', () => {
    expect(
      calendarEventHasOtherParticipants(
        [
          {
            email: 'dan@example.com',
            self: true,
            responseStatus: 'declined',
          },
          { email: 'alex@example.com' },
        ],
        userEmails,
      ),
    ).toBe(false);
  });
});

describe('otherParticipantLabel', () => {
  it('names other guests and skips the current user', () => {
    expect(
      otherParticipantLabel(
        [
          { email: 'dan@example.com', self: true, displayName: 'Dan' },
          { email: 'alex@example.com', displayName: 'Alex Example' },
        ],
        userEmails,
      ),
    ).toBe('Alex Example');
    expect(
      otherParticipantLabel(
        [
          { email: 'alex@example.com', displayName: 'Alex' },
          { email: 'sam@example.com', displayName: 'Sam' },
          { email: 'jo@example.com', displayName: 'Jo' },
        ],
        userEmails,
      ),
    ).toBe('Alex and 2 others');
  });
});

describe('upcomingMeetingsMatch', () => {
  it('matches on conferencing URL or start plus title', () => {
    expect(
      upcomingMeetingsMatch(
        meeting(),
        meeting({
          id: 'b1',
          source: 'booking',
          title: 'Different title',
        }),
      ),
    ).toBe(true);
    expect(
      upcomingMeetingsMatch(
        meeting({ conferencingUrl: null }),
        meeting({
          id: 'b1',
          source: 'booking',
          conferencingUrl: null,
          title: 'Client sync',
        }),
      ),
    ).toBe(true);
    expect(
      upcomingMeetingsMatch(
        meeting({ conferencingUrl: null }),
        meeting({
          id: 'b1',
          source: 'booking',
          conferencingUrl: null,
          startAt: '2099-01-02T11:00:00.000Z',
        }),
      ),
    ).toBe(false);
  });
});

describe('mergeUpcomingMeetings', () => {
  it('keeps calendar meetings and unmatched bookings, deduping overlaps', () => {
    const calendar = [
      meeting(),
      meeting({
        id: 'cal-2',
        title: 'External standup',
        startAt: '2099-01-03T09:00:00.000Z',
        endAt: '2099-01-03T09:15:00.000Z',
        conferencingUrl: 'https://zoom.us/j/99',
        inviteeName: 'Sam Example',
      }),
    ];
    const bookings = [
      meeting({
        id: 'b1',
        source: 'booking',
        title: 'Client sync',
        detailHref: '/app/studio/scheduling/bookings',
        inviteeName: 'Booking Guest',
      }),
      meeting({
        id: 'b2',
        source: 'booking',
        title: 'Ozer-only intro',
        startAt: '2099-01-04T14:00:00.000Z',
        endAt: '2099-01-04T14:30:00.000Z',
        conferencingUrl: 'https://meet.google.com/ozer',
        inviteeName: 'Pat Client',
        detailHref: '/app/studio/scheduling/bookings',
      }),
    ];

    expect(mergeUpcomingMeetings(calendar, bookings, 8)).toEqual([
      {
        ...meeting(),
        detailHref: '/app/studio/scheduling/bookings',
        inviteeName: 'Alex Example',
      },
      calendar[1],
      bookings[1],
    ]);
  });

  it('drops meetings that have already ended', () => {
    expect(
      isUpcomingMeetingActive(
        {
          startAt: '2020-01-01T10:00:00.000Z',
          endAt: '2020-01-01T10:30:00.000Z',
        },
        Date.parse('2020-01-01T11:00:00.000Z'),
      ),
    ).toBe(false);
    expect(
      isUpcomingMeetingActive(
        {
          startAt: '2020-01-01T10:00:00.000Z',
          endAt: '2020-01-01T11:30:00.000Z',
        },
        Date.parse('2020-01-01T11:00:00.000Z'),
      ),
    ).toBe(true);
  });
});
