import { describe, expect, it } from 'vitest';

import { googleSyncMetaParts, parseGoogleSyncMeta } from './google-sync-meta';
import {
  attachGoogleEventIdsToPlan,
  parsePlanDocument,
  serializePlanDocument,
} from './plan-blocks';

describe('google-sync-meta', () => {
  it('round-trips sync fields through plan markdown', () => {
    const markdown = [
      '### Schedule',
      '9am–10am · Task one · gid:evt-123 · gcal:cal-primary · gpushed',
      '10am–11am · 📅 Stand-up',
    ].join('\n');

    const doc = parsePlanDocument(markdown);
    const task = doc.sections[0]?.blocks[0];
    expect(task?.googleEventId).toBe('evt-123');
    expect(task?.googleCalendarId).toBe('cal-primary');
    expect(task?.pushedByPlanner).toBe(true);
    expect(task?.meta).not.toContain('gid:evt-123');

    const serialized = serializePlanDocument(doc);
    expect(serialized).toContain('gid:evt-123');
    expect(serialized).toContain('gcal:cal-primary');
    expect(serialized).toContain('gpushed');
  });

  it('parses mixed display and sync meta', () => {
    const parsed = parseGoogleSyncMeta([
      '~45min',
      'gid:abc',
      'Client work',
      'gcal:work-cal',
    ]);

    expect(parsed.googleEventId).toBe('abc');
    expect(parsed.googleCalendarId).toBe('work-cal');
    expect(parsed.displayMeta).toEqual(['~45min', 'Client work']);
    expect(googleSyncMetaParts(parsed)).toEqual(['gid:abc', 'gcal:work-cal']);
  });
});

describe('attachGoogleEventIdsToPlan', () => {
  it('links calendar blocks by title and start time', () => {
    const dateIso = '2026-07-03T12:00:00';
    const eventStart = new Date(dateIso);
    eventStart.setHours(9, 0, 0, 0);

    const doc = parsePlanDocument(
      '9am–10am · 📅 Team stand-up\n10am–11am · Deep work',
    );

    const linked = attachGoogleEventIdsToPlan(
      doc,
      [
        {
          id: 'google-evt-1',
          title: 'Team stand-up',
          start: eventStart.toISOString(),
          calendarId: 'primary',
        },
      ],
      dateIso,
    );

    const calendarBlock = linked.sections[0]?.blocks[0];
    expect(calendarBlock?.googleEventId).toBe('google-evt-1');
    expect(calendarBlock?.googleCalendarId).toBe('primary');
  });
});
