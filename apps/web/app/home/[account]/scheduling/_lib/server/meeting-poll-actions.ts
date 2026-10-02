'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import {
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
    return service.resolveManualSlot(input);
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
