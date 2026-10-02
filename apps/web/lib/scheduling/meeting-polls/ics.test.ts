import { describe, expect, it } from 'vitest';

import { buildPollRequestIcs, pollIcsAttachment } from './ics';

describe('buildPollRequestIcs', () => {
  it('sends a METHOD:REQUEST invite with the organiser and every attendee', () => {
    const ics = buildPollRequestIcs({
      uid: 'poll-1@ozer.so',
      title: 'Design review',
      description: 'Bring sketches',
      startAt: '2026-06-01T09:00:00.000Z',
      endAt: '2026-06-01T09:30:00.000Z',
      location: 'Studio',
      organizerEmail: 'dan@example.com',
      organizerName: 'Dan',
      attendees: [
        { email: 'ada@example.com', name: 'Ada' },
        { email: 'bea@example.com', name: 'Bea' },
      ],
    });

    const unfolded = ics.replace(/\r\n[ \t]/g, '');

    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).not.toContain('METHOD:PUBLISH');
    expect(unfolded).toContain('ORGANIZER;CN=Dan:mailto:dan@example.com');
    expect(
      unfolded
        .split('\r\n')
        .some(
          (line) =>
            line.startsWith('ATTENDEE') && line.includes('dan@example.com'),
        ),
    ).toBe(false);
    expect(unfolded).toContain('mailto:ada@example.com');
    expect(unfolded).toContain('mailto:bea@example.com');
    expect(ics).toContain('DTSTART:20260601T090000Z');
    expect(ics).toContain('LOCATION:Studio');

    expect(pollIcsAttachment(ics).mimeType).toContain('method=REQUEST');
  });

  it('folds on UTF-8 octets and keeps multibyte characters intact', () => {
    const name = `${'Å'.repeat(40)}${'😀'.repeat(8)}`;
    const ics = buildPollRequestIcs({
      uid: 'poll-1@ozer.so',
      title: 'Design review',
      description: 'Bring sketches',
      startAt: '2026-06-01T09:00:00.000Z',
      endAt: '2026-06-01T09:30:00.000Z',
      organizerEmail: 'dan@example.com',
      organizerName: name,
      attendees: [{ email: 'ada@example.com', name: 'Ada' }],
    });

    for (const line of ics.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }

    expect(ics.replace(/\r\n[ \t]/g, '')).toContain(name);
  });
});
