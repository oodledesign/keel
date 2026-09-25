import { describe, expect, it } from 'vitest';

import { rankPollSlots } from './rank-poll-slots';

describe('rankPollSlots', () => {
  const slots = [
    { id: 'early', startsAt: '2026-06-01T09:00:00.000Z' },
    { id: 'mid', startsAt: '2026-06-01T11:00:00.000Z' },
    { id: 'late', startsAt: '2026-06-02T09:00:00.000Z' },
  ];

  it('ranks most Yes, then If need be, then fewest No, then earlier start', () => {
    const ranked = rankPollSlots({
      slots,
      inviteeIds: ['a', 'b', 'c'],
      responses: [
        { slotId: 'early', inviteeId: 'a', answer: 'yes' },
        { slotId: 'early', inviteeId: 'b', answer: 'no' },
        { slotId: 'early', inviteeId: 'c', answer: 'no' },
        { slotId: 'mid', inviteeId: 'a', answer: 'yes' },
        { slotId: 'mid', inviteeId: 'b', answer: 'yes' },
        { slotId: 'mid', inviteeId: 'c', answer: 'if_need_be' },
        { slotId: 'late', inviteeId: 'a', answer: 'yes' },
        { slotId: 'late', inviteeId: 'b', answer: 'if_need_be' },
        { slotId: 'late', inviteeId: 'c', answer: 'if_need_be' },
      ],
    });

    expect(ranked.map((row) => row.slotId)).toEqual(['mid', 'late', 'early']);
    expect(ranked[0]).toMatchObject({
      rank: 1,
      yes: 2,
      ifNeedBe: 1,
      no: 0,
      pending: 0,
    });
    expect(ranked[2]).toMatchObject({ yes: 1, no: 2, rank: 3 });
  });

  it('breaks a Yes tie by If need be and counts each invitee once', () => {
    const ranked = rankPollSlots({
      slots: slots.slice(0, 2),
      inviteeIds: ['a', 'b'],
      responses: [
        { slotId: 'early', inviteeId: 'a', answer: 'no' },
        { slotId: 'early', inviteeId: 'a', answer: 'yes' },
        { slotId: 'early', inviteeId: 'b', answer: 'if_need_be' },
        { slotId: 'mid', inviteeId: 'a', answer: 'yes' },
        { slotId: 'mid', inviteeId: 'b', answer: 'no' },
      ],
    });

    expect(ranked.map((row) => row.slotId)).toEqual(['early', 'mid']);
    expect(ranked[0]).toMatchObject({ yes: 1, ifNeedBe: 1, no: 0, pending: 0 });
  });

  it('keeps unanswered invitees as pending and leaves an empty poll chronological', () => {
    const ranked = rankPollSlots({
      slots,
      inviteeIds: ['a', 'b'],
      responses: [{ slotId: 'late', inviteeId: 'a', answer: 'yes' }],
    });

    expect(ranked[0]).toMatchObject({
      slotId: 'late',
      yes: 1,
      pending: 1,
      rank: 1,
    });
    expect(ranked[1]).toMatchObject({ slotId: 'early', pending: 2, rank: 2 });
    expect(ranked[2]).toMatchObject({ slotId: 'mid', pending: 2, rank: 3 });
  });
});
