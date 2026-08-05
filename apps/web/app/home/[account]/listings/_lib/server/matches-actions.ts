'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  CreateMatchSchema,
  DeleteMatchSchema,
  ListMatchesForListingSchema,
  ListMatchesForRequirementSchema,
  UpdateMatchSchema,
} from '../schema/matches.schema';
import { createMatchesService } from './matches.service';

function getService() {
  return createMatchesService(getSupabaseServerClient());
}

export const listMatchesForListing = enhanceAction(
  async (input) => getService().listForListing(input),
  { schema: ListMatchesForListingSchema },
);

export const listMatchesForRequirement = enhanceAction(
  async (input) => getService().listForRequirement(input),
  { schema: ListMatchesForRequirementSchema },
);

export const createInterestMatch = enhanceAction(
  async (input, user) => {
    const match = await getService().createMatch({
      ...input,
      createdBy: user.id,
    });
    revalidatePath('/home', 'layout');
    return match;
  },
  { schema: CreateMatchSchema },
);

export const updateInterestMatch = enhanceAction(
  async (input) => {
    const match = await getService().updateMatch(input);
    revalidatePath('/home', 'layout');
    return match;
  },
  { schema: UpdateMatchSchema },
);

export const deleteInterestMatch = enhanceAction(
  async (input) => {
    await getService().deleteMatch(input.matchId, input.accountId);
    revalidatePath('/home', 'layout');
    return { ok: true as const };
  },
  { schema: DeleteMatchSchema },
);
