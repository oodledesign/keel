'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import {
  AddMeetingPollInviteesSchema,
  AddMeetingPollSlotsSchema,
  ConfirmMeetingPollSchema,
  MeetingPollIdSchema,
  PreviewMeetingPollSlotSchema,
  ResolveManualPollSlotSchema,
  SaveMeetingPollSchema,
  SuggestMeetingPollSlotsSchema,
} from '../schema/meeting-poll.schema';
import { createMeetingPollsService } from './meeting-polls.service';

function revalidatePolls(accountSlug: string, pollId?: string) {
  const list = pathsConfig.app.accountSchedulingPolls.replace(
    '[account]',
    accountSlug,
  );
  revalidatePath(list, 'page');
  if (!pollId) return;
  revalidatePath(
    pathsConfig.app.accountSchedulingPoll
      .replace('[account]', accountSlug)
      .replace('[pollId]', pollId),
    'page',
  );
}

export const suggestMeetingPollSlotsAction = enhanceAction(
  async (input, user) => {
    const service = createMeetingPollsService(getSupabaseServerClient());
    return service.suggestSlots(input, user.id);
  },
  { schema: SuggestMeetingPollSlotsSchema },
);

export const resolveManualPollSlotAction = enhanceAction(
  async (input) => {
    const service = createMeetingPollsService(getSupabaseServerClient());

    // Return validation problems instead of throwing: thrown messages are
    // masked in production and surface as an opaque 500.
    try {
      return { ok: true as const, slot: service.resolveManualSlot(input) };
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof Error ? error.message : 'Could not add that time',
      };
    }
  },
  { schema: ResolveManualPollSlotSchema },
);

export const saveMeetingPollAction = enhanceAction(
  async (input, user) => {
    const service = createMeetingPollsService(getSupabaseServerClient());
    const result = await service.savePoll(input, user.id);
    revalidatePolls(input.accountSlug, result.pollId);
    return result;
  },
  { schema: SaveMeetingPollSchema },
);

export const sendMeetingPollInvitesAction = enhanceAction(
  async (input) => {
    const service = createMeetingPollsService(getSupabaseServerClient());
    const mail = await service.sendPendingInvites(
      input.accountId,
      input.pollId,
    );
    revalidatePolls(input.accountSlug, input.pollId);
    return { mail };
  },
  { schema: MeetingPollIdSchema },
);

export const remindMeetingPollAction = enhanceAction(
  async (input) => {
    const service = createMeetingPollsService(getSupabaseServerClient());
    const mail = await service.remindNonResponders(
      input.accountId,
      input.pollId,
    );
    revalidatePolls(input.accountSlug, input.pollId);
    return { mail };
  },
  { schema: MeetingPollIdSchema },
);

export const previewMeetingPollSlotAction = enhanceAction(
  async (input) => {
    const service = createMeetingPollsService(getSupabaseServerClient());
    return service.previewSlot(input.accountId, input.pollId, input.slotId);
  },
  { schema: PreviewMeetingPollSlotSchema },
);

export const confirmMeetingPollSlotAction = enhanceAction(
  async (input, user) => {
    const service = createMeetingPollsService(getSupabaseServerClient());
    const result = await service.confirmSlot(input, user.id);
    revalidatePolls(input.accountSlug, input.pollId);
    return result;
  },
  { schema: ConfirmMeetingPollSchema },
);

export const resendMeetingPollConfirmationAction = enhanceAction(
  async (input) => {
    const service = createMeetingPollsService(getSupabaseServerClient());
    const mail = await service.resendConfirmation(
      input.accountId,
      input.pollId,
    );
    return { mail };
  },
  { schema: MeetingPollIdSchema },
);

export const cancelMeetingPollAction = enhanceAction(
  async (input) => {
    const service = createMeetingPollsService(getSupabaseServerClient());
    await service.cancelPoll(input.accountId, input.pollId);
    revalidatePolls(input.accountSlug, input.pollId);
    return { ok: true };
  },
  { schema: MeetingPollIdSchema },
);

// These return problems instead of throwing: thrown messages are masked in
// production and surface as an opaque 500.
function failure(error: unknown, fallback: string) {
  return {
    ok: false as const,
    message: error instanceof Error ? error.message : fallback,
  };
}

export const addMeetingPollSlotsAction = enhanceAction(
  async (input) => {
    const service = createMeetingPollsService(getSupabaseServerClient());
    try {
      const result = await service.addSlots(input);
      revalidatePolls(input.accountSlug, input.pollId);
      return { ok: true as const, ...result };
    } catch (error) {
      return failure(error, 'Could not add the times');
    }
  },
  { schema: AddMeetingPollSlotsSchema },
);

export const addMeetingPollInviteesAction = enhanceAction(
  async (input) => {
    const service = createMeetingPollsService(getSupabaseServerClient());
    try {
      const result = await service.addInvitees(input);
      revalidatePolls(input.accountSlug, input.pollId);
      return { ok: true as const, ...result };
    } catch (error) {
      return failure(error, 'Could not add the people');
    }
  },
  { schema: AddMeetingPollInviteesSchema },
);
