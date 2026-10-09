import { describe, expect, it } from 'vitest';

import {
  type PollResultsSource,
  buildPollResultsView,
} from './poll-results-view';

const TOKEN = 'c'.repeat(64);

function source(overrides?: Partial<PollResultsSource>): PollResultsSource {
  return {
    token: TOKEN,
    poll: {
      id: 'poll-1',
      status: 'open',
      title: 'Board meeting',
      description: null,
      location: null,
      durationMinutes: 60,
      timezone: 'Europe/London',
      chosenSlotId: null,
      conferencingUrl: 'https://meet.example/abc',
      resultsToken: TOKEN,
    },
    slots: [
      {
        id: 'late',
        startsAt: '2026-06-02T09:00:00.000Z',
        endsAt: '2026-06-02T10:00:00.000Z',
      },
      {
        id: 'early',
        startsAt: '2026-06-01T09:00:00.000Z',
        endsAt: '2026-06-01T10:00:00.000Z',
      },
    ],
    invitees: [
      { id: 'ada', name: 'Ada Lovelace', email: 'ada@example.com' },
      { id: 'bob', name: null, email: 'bob@example.com' },
    ],
    responses: [
      { inviteeId: 'ada', slotId: 'early', answer: 'no' },
      { inviteeId: 'ada', slotId: 'late', answer: 'yes' },
      { inviteeId: 'bob', slotId: 'late', answer: 'if_need_be' },
    ],
    ...overrides,
  };
}

describe('buildPollResultsView', () => {
  it('rejects a token that does not match the poll', () => {
    expect(buildPollResultsView(source({ token: 'd'.repeat(64) })).status).toBe(
      'not_found',
    );
  });

  it('rejects polls with the link turned off', () => {
    const base = source();
    expect(
      buildPollResultsView({
        ...base,
        poll: { ...base.poll!, resultsToken: null },
      }).status,
    ).toBe('not_found');
  });

  it('hides draft polls', () => {
    const base = source();
    expect(
      buildPollResultsView({
        ...base,
        poll: { ...base.poll!, status: 'draft' },
      }).status,
    ).toBe('not_found');
  });

  it('shows full names, falling back to the email name', () => {
    const view = buildPollResultsView(source());
    if (view.status !== 'ok') throw new Error('expected ok');
    expect(view.participants.map((row) => row.label)).toEqual([
      'Ada Lovelace',
      'bob',
    ]);
  });

  it('orders slots by start and ranks the best time first', () => {
    const view = buildPollResultsView(source());
    if (view.status !== 'ok') throw new Error('expected ok');
    expect(view.slots.map((slot) => [slot.id, slot.rank])).toEqual([
      ['early', 2],
      ['late', 1],
    ]);
    expect(view.slots[1]).toMatchObject({
      yes: 1,
      ifNeedBe: 1,
      no: 0,
      pending: 0,
    });
  });

  it('counts only people who answered every time as responded', () => {
    const view = buildPollResultsView(source());
    if (view.status !== 'ok') throw new Error('expected ok');
    expect(view.respondedCount).toBe(1);
    expect(
      view.participants.find((row) => row.inviteeId === 'bob'),
    ).toMatchObject({ responded: false });
  });

  it('only exposes the join link once a time is confirmed', () => {
    const open = buildPollResultsView(source());
    if (open.status !== 'ok') throw new Error('expected ok');
    expect(open.conferencingUrl).toBeNull();

    const base = source();
    const closed = buildPollResultsView({
      ...base,
      poll: { ...base.poll!, status: 'closed', chosenSlotId: 'late' },
    });
    if (closed.status !== 'ok') throw new Error('expected ok');
    expect(closed.chosenSlotId).toBe('late');
    expect(closed.conferencingUrl).toBe('https://meet.example/abc');
  });
});
