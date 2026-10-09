import type { PublicPollStatus } from './public-poll-view';
import { isPollInviteToken } from './public-poll-view';
import { type PollVote, rankPollSlots } from './rank-poll-slots';

export type PollResultsSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  rank: number;
  yes: number;
  ifNeedBe: number;
  no: number;
  pending: number;
};

export type PollResultsParticipant = {
  inviteeId: string;
  label: string;
  /** Answered every time on the poll. */
  responded: boolean;
  answers: Array<{ slotId: string; answer: PollVote }>;
};

export type PollResultsView =
  | { status: 'not_found' }
  | {
      status: 'ok';
      pollStatus: PublicPollStatus;
      title: string;
      description: string | null;
      location: string | null;
      durationMinutes: number;
      organiserTimezone: string;
      /** In start order; `rank` 1 is the best time. */
      slots: PollResultsSlot[];
      participants: PollResultsParticipant[];
      respondedCount: number;
      chosenSlotId: string | null;
      conferencingUrl: string | null;
    };

export type PollResultsSource = {
  token: string;
  poll: {
    id: string;
    status: 'draft' | PublicPollStatus;
    title: string;
    description: string | null;
    location: string | null;
    durationMinutes: number;
    timezone: string;
    chosenSlotId: string | null;
    conferencingUrl: string | null;
    resultsToken: string | null;
  } | null;
  slots: Array<{ id: string; startsAt: string; endsAt: string }>;
  invitees: Array<{ id: string; name: string | null; email: string }>;
  responses: Array<{ inviteeId: string; slotId: string; answer: PollVote }>;
};

/**
 * Read-only results for the person making the final call. Names are always
 * shown; full email addresses and invitee tokens are never copied onto the view.
 */
export function buildPollResultsView(
  input: PollResultsSource,
): PollResultsView {
  const { poll, token } = input;

  if (!poll || !isPollInviteToken(token) || poll.resultsToken !== token) {
    return { status: 'not_found' };
  }

  if (poll.status === 'draft') {
    return { status: 'not_found' };
  }

  const slotIds = new Set(input.slots.map((slot) => slot.id));
  const inviteeIds = new Set(input.invitees.map((invitee) => invitee.id));
  const responses = input.responses.filter(
    (row) => slotIds.has(row.slotId) && inviteeIds.has(row.inviteeId),
  );

  const ranked = new Map(
    rankPollSlots({
      slots: input.slots.map((slot) => ({
        id: slot.id,
        startsAt: slot.startsAt,
      })),
      inviteeIds: [...inviteeIds],
      responses,
    }).map((row) => [row.slotId, row]),
  );

  const slots = [...input.slots]
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
    .map((slot) => {
      const row = ranked.get(slot.id);
      return {
        id: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        rank: row?.rank ?? 0,
        yes: row?.yes ?? 0,
        ifNeedBe: row?.ifNeedBe ?? 0,
        no: row?.no ?? 0,
        pending: row?.pending ?? inviteeIds.size,
      };
    });

  const participants = input.invitees.map((invitee) => {
    const bySlot = new Map<string, PollVote>();
    for (const row of responses) {
      if (row.inviteeId === invitee.id) bySlot.set(row.slotId, row.answer);
    }
    return {
      inviteeId: invitee.id,
      label: invitee.name?.trim() || invitee.email.split('@')[0] || 'Invitee',
      responded: slots.length > 0 && bySlot.size >= slots.length,
      answers: [...bySlot.entries()].map(([slotId, answer]) => ({
        slotId,
        answer,
      })),
    };
  });

  const chosenSlotId =
    poll.status === 'closed' &&
    poll.chosenSlotId &&
    slotIds.has(poll.chosenSlotId)
      ? poll.chosenSlotId
      : null;

  return {
    status: 'ok',
    pollStatus: poll.status,
    title: poll.title,
    description: poll.description,
    location: poll.location,
    durationMinutes: poll.durationMinutes,
    organiserTimezone: poll.timezone,
    slots,
    participants,
    respondedCount: participants.filter((row) => row.responded).length,
    chosenSlotId,
    conferencingUrl: poll.status === 'closed' ? poll.conferencingUrl : null,
  };
}
