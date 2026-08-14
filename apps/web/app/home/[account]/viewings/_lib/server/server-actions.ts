'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { recordListingEvent } from '~/lib/commercial/listing-events';

import { createMatchesService } from '../../../listings/_lib/server/matches.service';
import { createRequirementsService } from '../../../requirements/_lib/server/requirements.service';
import {
  ApplyViewingFeedbackFollowUpSchema,
  CreateViewingSchema,
  DeleteViewingSchema,
  ListViewingRequirementOptionsSchema,
  ListViewingsSchema,
  UpdateViewingSchema,
} from '../schema/viewings.schema';
import { createViewingsService } from './viewings.service';

function getService() {
  return createViewingsService(getSupabaseServerClient());
}

export type ViewingRequirementOption = {
  requirementId: string;
  matchId: string;
  clientId: string | null;
  label: string;
  interestStatus: string;
};

export const listViewings = enhanceAction(
  async (input) => getService().listViewings(input.accountId),
  { schema: ListViewingsSchema },
);

/** Linked interest requirements for a listing (for viewing form picker). */
export const listViewingRequirementOptions = enhanceAction(
  async (input) => getService().listRequirementOptions(input),
  { schema: ListViewingRequirementOptionsSchema },
);

export const createViewing = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    return createViewingsService(client).createViewing({
      ...input,
      createdBy: user?.id ?? null,
    });
  },
  { schema: CreateViewingSchema },
);

export const updateViewing = enhanceAction(
  async (input) => {
    const { viewingId, accountId, ...rest } = input;
    return getService().updateViewing(viewingId, accountId, rest);
  },
  { schema: UpdateViewingSchema },
);

export const deleteViewing = enhanceAction(
  async (input) => {
    await getService().deleteViewing(input.viewingId, input.accountId);
    return { success: true };
  },
  { schema: DeleteViewingSchema },
);

export const applyViewingFeedbackFollowUp = enhanceAction(
  async (input, user) => {
    const client = getSupabaseServerClient();
    const matches = createMatchesService(client);
    const requirements = createRequirementsService(client);

    let matchId = input.matchId ?? null;

    if (!matchId) {
      const ensured = await matches.ensureMatch({
        accountId: input.accountId,
        listingId: input.listingId,
        requirementId: input.requirementId,
        createdBy: user.id,
      });
      matchId = ensured.match.id;
    }

    if (input.interestStatus) {
      await matches.updateMatch({
        accountId: input.accountId,
        matchId,
        status: input.interestStatus,
      });
    }

    const feedback = input.feedbackText?.trim() || null;
    let notesAppended = false;

    if (input.appendFeedbackToNotes && feedback) {
      const stamp = new Date().toISOString().slice(0, 10);
      const block = `[Viewing feedback ${stamp}]: ${feedback}`;
      await requirements.appendNotes(
        input.requirementId,
        input.accountId,
        block,
        input.requirementStage ? { stage: input.requirementStage } : undefined,
      );
      notesAppended = true;
    } else if (input.requirementStage) {
      await requirements.updateRequirement(
        input.requirementId,
        input.accountId,
        { stage: input.requirementStage },
      );
    }

    await recordListingEvent(client, {
      accountId: input.accountId,
      listingId: input.listingId,
      actorUserId: user.id,
      eventType: 'note',
      summary: 'Viewing feedback applied to interest / requirement',
      metadata: {
        viewingId: input.viewingId,
        requirementId: input.requirementId,
        matchId,
        interestStatus: input.interestStatus ?? null,
        requirementStage: input.requirementStage ?? null,
        notesAppended,
      },
    });

    revalidatePath('/home', 'layout');
    return {
      ok: true as const,
      matchId,
      notesAppended,
    };
  },
  { schema: ApplyViewingFeedbackFollowUpSchema },
);
