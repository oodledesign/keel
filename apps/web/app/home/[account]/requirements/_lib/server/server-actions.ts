'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  CreateRequirementSchema,
  DeleteRequirementSchema,
  ListRequirementsSchema,
  UpdateRequirementSchema,
} from '../schema/requirements.schema';
import { createRequirementsService } from './requirements.service';

function getService() {
  return createRequirementsService(getSupabaseServerClient());
}

export const listRequirements = enhanceAction(
  async (input) => getService().listRequirements(input.accountId, input.stage),
  { schema: ListRequirementsSchema },
);

export const createRequirement = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    return createRequirementsService(client).createRequirement({
      ...input,
      createdBy: user?.id ?? null,
    });
  },
  { schema: CreateRequirementSchema },
);

export const updateRequirement = enhanceAction(
  async (input) => {
    const { requirementId, accountId, ...rest } = input;
    return getService().updateRequirement(requirementId, accountId, rest);
  },
  { schema: UpdateRequirementSchema },
);

export const deleteRequirement = enhanceAction(
  async (input) => {
    await getService().deleteRequirement(input.requirementId, input.accountId);
    return { success: true };
  },
  { schema: DeleteRequirementSchema },
);
