import type { PollVote } from './rank-poll-slots';

const TOKEN_RE = /^[a-f0-9]{64}$/;

export function isPollInviteToken(value: string): boolean {
  return TOKEN_RE.test(value);
}

export type PublicPollStatus = 'open' | 'closed' | 'cancelled';

export type PublicPollParticipant = {
  inviteeId: string;
  label: string;
  isYou: boolean;
  answers: Array<{ slotId: string; answer: PollVote }>;
};

export type PublicPollView =
  | { status: 'not_found' }
  | {
      status: 'ok';
      canVote: boolean;
      pollStatus: PublicPollStatus;
      title: string;
      description: string | null;
      location: string | null;
      durationMinutes: number;
      organiserTimezone: string;
      showVoterNames: boolean;
      yourName: string;
      yourEmail: string;
      slots: Array<{ id: string; startsAt: string; endsAt: string }>;
      participants: PublicPollParticipant[];
      counts: Array<{
        slotId: string;
        yes: number;
        ifNeedBe: number;
        no: number;
      }>;
      chosenSlotId: string | null;
      conferencingUrl: string | null;
    };

export type PublicPollSource = {
  token: string;
  poll: {
    id: string;
    status: 'draft' | PublicPollStatus;
    title: string;
    description: string | null;
    location: string | null;
    durationMinutes: number;
    timezone: string;
    showVoterNames: boolean;
    chosenSlotId: string | null;
    conferencingUrl: string | null;
  } | null;
  invitee: {
    id: string;
    pollId: string;
    token: string;
    name: string | null;
    email: string;
  } | null;
  slots: Array<{ id: string; startsAt: string; endsAt: string }>;
  invitees: Array<{
    id: string;
    name: string | null;
    email: string;
  }>;
  responses: Array<{
    inviteeId: string;
    slotId: string;
    answer: PollVote;
  }>;
};

/**
 * Builds the invitee page from a token lookup.
 * Draft polls and unknown tokens are not found.
 * Other invitees' tokens and email addresses are never copied onto the view.
 */
export function buildPublicPollView(input: PublicPollSource): PublicPollView {
  const { poll, invitee, token } = input;

  if (!poll || !invitee) {
    return { status: 'not_found' };
  }

  if (!isPollInviteToken(token) || invitee.token !== token) {
    return { status: 'not_found' };
  }

  if (invitee.pollId !== poll.id) {
    return { status: 'not_found' };
  }

  if (poll.status === 'draft') {
    return { status: 'not_found' };
  }

  const slotIds = new Set(input.slots.map((slot) => slot.id));
  const answersFor = (inviteeId: string) => {
    const bySlot = new Map<string, PollVote>();

    for (const response of input.responses) {
      if (response.inviteeId !== inviteeId) continue;
      if (!slotIds.has(response.slotId)) continue;
      bySlot.set(response.slotId, response.answer);
    }

    return [...bySlot.entries()].map(([slotId, answer]) => ({
      slotId,
      answer,
    }));
  };

  const counts = input.slots.map((slot) => {
    const byInvitee = new Map<string, PollVote>();

    for (const response of input.responses) {
      if (response.slotId !== slot.id) continue;
      byInvitee.set(response.inviteeId, response.answer);
    }

    let yes = 0;
    let ifNeedBe = 0;
    let no = 0;

    for (const answer of byInvitee.values()) {
      if (answer === 'yes') yes += 1;
      else if (answer === 'if_need_be') ifNeedBe += 1;
      else no += 1;
    }

    return { slotId: slot.id, yes, ifNeedBe, no };
  });

  const you: PublicPollParticipant = {
    inviteeId: invitee.id,
    label: 'You',
    isYou: true,
    answers: answersFor(invitee.id),
  };

  const others: PublicPollParticipant[] = poll.showVoterNames
    ? input.invitees
        .filter((row) => row.id !== invitee.id)
        .map((row) => ({
          inviteeId: row.id,
          label: row.name?.trim() || 'Invitee',
          isYou: false,
          answers: answersFor(row.id),
        }))
    : [];

  const chosenSlotId =
    poll.status === 'closed' &&
    poll.chosenSlotId &&
    slotIds.has(poll.chosenSlotId)
      ? poll.chosenSlotId
      : null;

  return {
    status: 'ok',
    canVote: poll.status === 'open',
    pollStatus: poll.status,
    title: poll.title,
    description: poll.description,
    location: poll.location,
    durationMinutes: poll.durationMinutes,
    organiserTimezone: poll.timezone,
    showVoterNames: poll.showVoterNames,
    yourName: invitee.name?.trim() || '',
    yourEmail: invitee.email,
    slots: input.slots.map((slot) => ({
      id: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    })),
    participants: [you, ...others],
    counts,
    chosenSlotId,
    conferencingUrl: poll.status === 'closed' ? poll.conferencingUrl : null,
  };
}
