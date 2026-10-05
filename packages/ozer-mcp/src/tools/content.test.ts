import { describe, expect, it } from 'vitest';

import {
  buildPostPatch,
  createContentPostSchema,
  isValidPeriodStart,
  setPeriodNoteSchema,
} from './content';

const ID = '11111111-1111-4111-8111-111111111111';

describe('content tools', () => {
  it('validates period starts', () => {
    expect(isValidPeriodStart('week', '2026-10-05')).toBe(true);
    expect(isValidPeriodStart('week', '2026-10-06')).toBe(false);
    expect(isValidPeriodStart('month', '2026-10-01')).toBe(true);
    expect(isValidPeriodStart('month', '2026-10-02')).toBe(false);
  });

  it('stamps posted_at only when posted', () => {
    const now = () => '2026-10-03T00:00:00.000Z';
    expect(buildPostPatch({ id: ID, status: 'posted' }, now)).toMatchObject({
      status: 'posted',
      posted_at: now(),
    });
    expect(buildPostPatch({ id: ID, status: 'scheduled' }, now)).toMatchObject({
      posted_at: null,
    });
    expect(buildPostPatch({ id: ID, title: 'x' }, now)).toEqual({ title: 'x' });
  });

  it('defaults and rejects bad input', () => {
    const post = createContentPostSchema.parse({
      project_id: ID,
      post_date: '2026-10-05',
      title: 'Launch',
    });
    expect(post.status).toBe('idea');
    expect(post.platforms).toEqual([]);
    expect(() =>
      createContentPostSchema.parse({
        project_id: ID,
        post_date: '5 Oct',
        title: 'x',
      }),
    ).toThrow();
    expect(() =>
      setPeriodNoteSchema.parse({
        project_id: ID,
        period_kind: 'day',
        period_start: '2026-10-05',
        body: '',
      }),
    ).toThrow();
  });
});
