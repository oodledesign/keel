export type PollVote = 'yes' | 'if_need_be' | 'no';

export type RankedPollSlot = {
  slotId: string;
  startsAt: string;
  yes: number;
  ifNeedBe: number;
  no: number;
  answered: number;
  pending: number;
  rank: number;
};

/**
 * Best slots first: most Yes, then most If need be, then fewest No,
 * then earlier start. Each invitee counts once per slot.
 */
export function rankPollSlots(input: {
  slots: Array<{ id: string; startsAt: string }>;
  responses: Array<{ slotId: string; inviteeId: string; answer: PollVote }>;
  inviteeIds: string[];
}): RankedPollSlot[] {
  const inviteeCount = new Set(input.inviteeIds).size;

  const ranked = input.slots.map((slot) => {
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

    return {
      slotId: slot.id,
      startsAt: slot.startsAt,
      yes,
      ifNeedBe,
      no,
      answered: byInvitee.size,
      pending: Math.max(0, inviteeCount - byInvitee.size),
      rank: 0,
    };
  });

  ranked.sort((left, right) => {
    if (right.yes !== left.yes) return right.yes - left.yes;
    if (right.ifNeedBe !== left.ifNeedBe) return right.ifNeedBe - left.ifNeedBe;
    if (left.no !== right.no) return left.no - right.no;
    return left.startsAt.localeCompare(right.startsAt);
  });

  return ranked.map((row, index) => ({ ...row, rank: index + 1 }));
}
