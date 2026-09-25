import { describe, expect, it } from 'vitest';

import {
  type PublicPollSource,
  buildPublicPollView,
  isPollInviteToken,
} from './public-poll-view';

const TOKEN_A = 'a'.repeat(64);
const TOKEN_B = 'b'.repeat(64);

function source(overrides?: Partial<PublicPollSource>): PublicPollSource {
  return {
    token: TOKEN_A,
    poll: {
      id: 'poll-1',
      status: 'open',
      title: 'Design review',
      description: 'Bring sketches',
      location: 'Studio',
      durationMinutes: 30,
      timezone: 'Europe/London',
      showVoterNames: true,
      chosenSlotId: null,
      conferencingUrl: 'https://meet.example/abc',
    },
    invitee: {
      id: 'invitee-a',
      pollId: 'poll-1',
      token: TOKEN_A,
      name: 'Ada',
      email: 'ada@example.com',
    },
    slots: [
      {
        id: 'slot-1',
        startsAt: '2026-06-01T09:00:00.000Z',
        endsAt: '2026-06-01T09:30:00.000Z',
      },
    ],
    invitees: [
      {
        id: 'invitee-a',
        name: 'Ada',
        email: 'ada@example.com',
      },
      {
        id: 'invitee-b',
        name: 'Bea',
        email: 'bea@example.com',
      },
    ],
    responses: [
      { inviteeId: 'invitee-a', slotId: 'slot-1', answer: 'yes' },
      { inviteeId: 'invitee-b', slotId: 'slot-1', answer: 'if_need_be' },
    ],
    ...overrides,
  };
}

describe('buildPublicPollView token access', () => {
  it('rejects unknown, mismatched, and draft tokens', () => {
    expect(isPollInviteToken('short')).toBe(false);
    expect(buildPublicPollView(source({ token: 'nope' })).status).toBe(
      'not_found',
    );
    expect(
      buildPublicPollView(
        source({
          invitee: {
            id: 'invitee-a',
            pollId: 'poll-1',
            token: TOKEN_B,
            name: 'Ada',
            email: 'ada@example.com',
          },
        }),
      ).status,
    ).toBe('not_found');
    expect(
      buildPublicPollView(
        source({
          invitee: {
            id: 'invitee-a',
            pollId: 'other-poll',
            token: TOKEN_A,
            name: 'Ada',
            email: 'ada@example.com',
          },
        }),
      ).status,
    ).toBe('not_found');
    expect(
      buildPublicPollView(
        source({
          poll: { ...source().poll!, status: 'draft' },
        }),
      ).status,
    ).toBe('not_found');
    expect(
      buildPublicPollView(source({ poll: null, invitee: null })).status,
    ).toBe('not_found');
  });

  it('shows other names when allowed and never leaks their token or email', () => {
    const view = buildPublicPollView(source());
    expect(view.status).toBe('ok');
    if (view.status !== 'ok') return;

    expect(view.canVote).toBe(true);
    expect(view.participants.map((row) => row.label)).toEqual(['You', 'Bea']);
    expect(view.yourEmail).toBe('ada@example.com');
    expect(view.counts).toEqual([
      { slotId: 'slot-1', yes: 1, ifNeedBe: 1, no: 0 },
    ]);
    expect(view.conferencingUrl).toBeNull();

    const serialised = JSON.stringify(view);
    expect(serialised).not.toContain(TOKEN_A);
    expect(serialised).not.toContain(TOKEN_B);
    expect(serialised).not.toContain('bea@example.com');
  });

  it('hides other voters when the poll is counts only', () => {
    const view = buildPublicPollView(
      source({
        poll: { ...source().poll!, showVoterNames: false },
      }),
    );
    expect(view.status).toBe('ok');
    if (view.status !== 'ok') return;

    expect(view.participants).toHaveLength(1);
    expect(view.participants[0]?.label).toBe('You');
    expect(view.counts[0]).toMatchObject({ yes: 1, ifNeedBe: 1 });

    const serialised = JSON.stringify(view);
    expect(serialised).not.toContain('Bea');
    expect(serialised).not.toContain('bea@example.com');
    expect(serialised).not.toContain(TOKEN_B);
  });

  it('closes voting and reveals the chosen time without another poll', () => {
    const closed = buildPublicPollView(
      source({
        poll: {
          ...source().poll!,
          status: 'closed',
          chosenSlotId: 'slot-1',
        },
      }),
    );
    expect(closed.status).toBe('ok');
    if (closed.status !== 'ok') return;
    expect(closed.canVote).toBe(false);
    expect(closed.chosenSlotId).toBe('slot-1');
    expect(closed.conferencingUrl).toBe('https://meet.example/abc');

    const cancelled = buildPublicPollView(
      source({
        poll: { ...source().poll!, status: 'cancelled' },
      }),
    );
    expect(cancelled.status).toBe('ok');
    if (cancelled.status !== 'ok') return;
    expect(cancelled.canVote).toBe(false);
    expect(cancelled.pollStatus).toBe('cancelled');
  });
});
