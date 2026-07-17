import { describe, expect, it } from 'vitest';

import {
  type EditablePlanBlock,
  blockToScheduleLine,
  parsePlanDocument,
  serializePlanDocument,
} from '~/lib/planner/plan-blocks';
import {
  canPlaceBlock,
  findValidDropStart,
  findValidDuration,
} from '~/lib/planner/schedule-constraints';

const sampleMarkdown = `## Today's Plan — Friday

### Morning (8:30am–12:00pm)
8:30am–10:00am · Deep work · Client A · ~90min
10:00am–11:00am · 📅 Team standup

### Afternoon (1:00pm–5:30pm)
1:00pm–2:00pm · Admin · Inbox · ~60min

### Not scheduled today
- Big task — no room left
`;

describe('plan-blocks', () => {
  it('round-trips schedule lines through markdown', () => {
    const doc = parsePlanDocument(sampleMarkdown);
    const serialized = serializePlanDocument(doc);

    expect(serialized).toContain('Deep work · Client A · ~90min');
    expect(serialized).toContain('📅 Team standup');
    expect(serialized).toContain('### Not scheduled today');
  });
});

describe('schedule-constraints', () => {
  const blocks: EditablePlanBlock[] = [
    {
      id: 'task',
      startMinutes: 8 * 60 + 30,
      endMinutes: 10 * 60,
      title: 'Deep work',
      meta: ['~90min'],
      isCalendarEvent: false,
      isBreak: false,
      movable: true,
    },
    {
      id: 'meeting',
      startMinutes: 10 * 60,
      endMinutes: 11 * 60,
      title: 'Team standup',
      meta: [],
      isCalendarEvent: true,
      isBreak: false,
      movable: false,
    },
    {
      id: 'admin',
      startMinutes: 13 * 60,
      endMinutes: 14 * 60,
      title: 'Admin',
      meta: ['~60min'],
      isCalendarEvent: false,
      isBreak: false,
      movable: true,
    },
  ];

  it('rejects overlapping a calendar event', () => {
    expect(canPlaceBlock(blocks, 'task', 9 * 60 + 45, 10 * 60 + 15).ok).toBe(
      false,
    );
  });

  it('finds a valid drop start in a free gap', () => {
    expect(findValidDropStart(blocks, 'admin', 12 * 60 + 50)).toBe(
      12 * 60 + 50,
    );
  });

  it('rejects durations that no longer fit', () => {
    expect(findValidDuration(blocks, 'task', 120)).toBeNull();
    expect(findValidDuration(blocks, 'admin', 45)).toBe(45);
  });

  it('allows moving a calendar event when it is marked movable', () => {
    const movableMeeting = { ...blocks[1]!, movable: true };
    const movableBlocks = [blocks[0]!, movableMeeting, blocks[2]!];

    expect(canPlaceBlock(movableBlocks, 'meeting', 11 * 60, 12 * 60).ok).toBe(
      true,
    );
  });

  it('keeps calendar blocks immovable in serialized lines', () => {
    const meeting = blocks[1]!;
    expect(blockToScheduleLine(meeting)).toContain('📅 Team standup');
  });
});
