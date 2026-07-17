import { describe, expect, it } from 'vitest';

import { parsePlanDocument } from './plan-blocks';
import { blocksForCalendarSync } from './plan-calendar-sync';

describe('blocksForCalendarSync', () => {
  it('maps week plan sections onto their weekday dates', () => {
    const markdown = [
      '## Week Plan — 6–12 Jul',
      '### Monday 6 July',
      '9am–10am · Write proposal · ~60min',
      '### Wednesday 8 July',
      '2pm–3pm · Client follow-up · ~60min',
    ].join('\n');

    const doc = parsePlanDocument(markdown);
    const blocks = blocksForCalendarSync(doc, '2026-07-08T12:00:00', {
      mode: 'week',
    });

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.title).toBe('Write proposal');
    expect(blocks[0]?.start.slice(0, 10)).toBe('2026-07-06');
    expect(blocks[1]?.title).toBe('Client follow-up');
    expect(blocks[1]?.start.slice(0, 10)).toBe('2026-07-08');
  });

  it('keeps day plans on the selected date', () => {
    const markdown = ['## Today', '9am–10am · Inbox · ~60min'].join('\n');

    const doc = parsePlanDocument(markdown);
    const blocks = blocksForCalendarSync(doc, '2026-07-08T12:00:00', {
      mode: 'day',
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.start.slice(0, 10)).toBe('2026-07-08');
  });
});
