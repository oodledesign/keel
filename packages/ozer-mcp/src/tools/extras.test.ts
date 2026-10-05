import { describe, expect, it } from 'vitest';

import {
  addCanvasCommentSchema,
  connectorsTouching,
  linkTasksSchema,
  matchPerson,
} from './canvas-cards';
import {
  addDays,
  nextOccurrence,
  updateRecurringTaskSchema,
} from './recurring';
import { updateTasksSchema } from './tasks';

const ID = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';

describe('recurrence', () => {
  it('advances daily, weekdays and weekly', () => {
    const fri = new Date('2026-10-02T12:00:00Z');
    expect(nextOccurrence(fri, 'daily').toISOString().slice(0, 10)).toBe(
      '2026-10-03',
    );
    expect(nextOccurrence(fri, 'weekdays').toISOString().slice(0, 10)).toBe(
      '2026-10-05',
    );
    expect(
      nextOccurrence(new Date('2026-10-05T12:00:00Z'), 'weekly')
        .toISOString()
        .slice(0, 10),
    ).toBe('2026-10-12');
  });

  it('clamps month ends', () => {
    expect(
      nextOccurrence(new Date('2026-01-31T12:00:00Z'), 'monthly', 31)
        .toISOString()
        .slice(0, 10),
    ).toBe('2026-02-28');
    expect(addDays('2026-10-05', 3)).toBe('2026-10-08');
  });

  it('rejects an empty update shape', () => {
    expect(() => updateRecurringTaskSchema.parse({ id: 'x' })).toThrow();
  });
});

describe('canvas cards', () => {
  it('finds connectors attached to deleted items', () => {
    const rows = [
      { id: 'c1', kind: 'connector', data: { source: 'a', target: 'b' } },
      { id: 'c2', kind: 'connector', data: { source: 'x', target: 'y' } },
      { id: 'a', kind: 'task', data: {} },
    ];
    expect(connectorsTouching(rows, new Set(['b']))).toEqual(['c1']);
  });

  it('matches people by first name and rejects ambiguity', () => {
    const people = [
      { id: '1', name: 'Paul Smith', email: 'paul@x.com' },
      { id: '2', name: 'Louise Jones', email: 'lou@x.com' },
      { id: '3', name: 'Paul Brown', email: 'pb@x.com' },
    ];
    expect(matchPerson(people, 'louise').id).toBe('2');
    expect(matchPerson(people, 'paul smith').id).toBe('1');
    expect(() => matchPerson(people, 'paul')).toThrow(/several/);
    expect(() => matchPerson(people, 'zed')).toThrow(/No workspace/);
  });

  it('validates comment targets and links', () => {
    expect(() =>
      addCanvasCommentSchema.parse({ project_id: ID, body: 'hi' }),
    ).toThrow();
    expect(() =>
      addCanvasCommentSchema.parse({
        project_id: ID,
        task_id: ID,
        item_id: ID2,
        body: 'hi',
      }),
    ).toThrow();
    expect(
      addCanvasCommentSchema.parse({
        project_id: ID,
        task_id: ID2,
        body: 'hi',
        mention_names: ['Paul'],
      }).mention_names,
    ).toEqual(['Paul']);
    expect(
      linkTasksSchema.parse({
        project_id: ID,
        links: [{ prerequisite_task_id: ID, dependent_task_id: ID2 }],
      }).links,
    ).toHaveLength(1);
  });
});

describe('batch', () => {
  it('caps batch size', () => {
    expect(() => updateTasksSchema.parse({ updates: [] })).toThrow();
    expect(
      updateTasksSchema.parse({ updates: [{ id: ID, title: 'x' }] }).updates,
    ).toHaveLength(1);
  });
});
