import { describe, expect, it } from 'vitest';

import { applyDurationScheduleToMarkdown } from './apply-duration-schedule';
import { flattenPlanBlocks, parsePlanDocument } from './plan-blocks';

const workingHours = { start: '08:30', end: '17:30' };

describe('applyDurationScheduleToMarkdown', () => {
  it('sizes a scheduled task to duration_minutes', () => {
    const markdown = `## Today's Plan — Friday

### Morning (8:30am–12:00pm)
8:30am–9:00am · Write proposal · Oodle · ~30min
10:00am–11:00am · 📅 Team standup

### Notes
Keep lunch free
`;

    const next = applyDurationScheduleToMarkdown(
      markdown,
      [
        {
          id: 'task-1',
          title: 'Write proposal',
          estimated_duration_minutes: 90,
          project: 'Oodle',
        },
      ],
      { workingHours },
    );

    const blocks = flattenPlanBlocks(parsePlanDocument(next));
    const task = blocks.find((block) => block.title === 'Write proposal');

    expect((task?.endMinutes ?? 0) - (task?.startMinutes ?? 0)).toBe(90);
    expect(task?.meta.some((part) => part.includes('90'))).toBe(true);
    expect(blocks.some((block) => block.isCalendarEvent)).toBe(true);
  });

  it('splits a long task around a calendar event', () => {
    const markdown = `## Today's Plan — Friday

### Morning
8:30am–10:30am · Deep work · Client A · ~120min
10:00am–11:00am · 📅 Team standup
`;

    const next = applyDurationScheduleToMarkdown(
      markdown,
      [
        {
          id: 'task-1',
          title: 'Deep work',
          estimated_duration_minutes: 120,
          project: 'Client A',
        },
      ],
      { workingHours: { start: '08:30', end: '12:00' } },
    );

    const blocks = flattenPlanBlocks(parsePlanDocument(next));
    const parts = blocks.filter((block) => block.title.startsWith('Deep work'));
    const meeting = blocks.find((block) => block.isCalendarEvent);

    expect(parts.length).toBeGreaterThan(1);
    expect(
      parts.reduce(
        (sum, block) => sum + (block.endMinutes - block.startMinutes),
        0,
      ),
    ).toBe(120);
    expect(meeting).toBeTruthy();
    for (const part of parts) {
      expect(
        part.endMinutes <= (meeting?.startMinutes ?? 0) ||
          part.startMinutes >= (meeting?.endMinutes ?? 0),
      ).toBe(true);
    }
  });

  it('lists leftover time instead of dropping the task', () => {
    const markdown = `## Today's Plan — Friday

### Afternoon
4:30pm–5:00pm · 📅 Wrap-up
`;

    const next = applyDurationScheduleToMarkdown(
      markdown,
      [
        {
          id: 'task-1',
          title: 'Big task',
          estimated_duration_minutes: 180,
        },
      ],
      { workingHours: { start: '16:30', end: '17:30' } },
    );

    expect(next).toMatch(/Not scheduled today/i);
    expect(next).toMatch(/Big task/);
    expect(next).toMatch(/150m left|still unscheduled|No free time/i);
  });
});
