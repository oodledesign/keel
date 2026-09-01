'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  CreateRequirementSchema,
  DeleteRequirementSchema,
  ListRequirementOfficesSchema,
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
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit requirements',
    );
    const { sourceEnquiryId, ...rest } = input;
    const created = await createRequirementsService(client).createRequirement({
      ...rest,
      createdBy: user?.id ?? null,
    });

    if (sourceEnquiryId) {
      try {
        const { createListingsService } =
          await import('../../../listings/_lib/server/listings.service');
        await createListingsService(client).updateEnquiry(
          sourceEnquiryId,
          input.accountId,
          { requirementId: created.id },
        );
      } catch (err) {
        console.error(
          '[createRequirement] failed to link enquiry to requirement:',
          err,
        );
      }
    }

    const { revalidateMatchRequirementsCache } =
      await import('~/lib/cache/disposals-data-cache');
    revalidateMatchRequirementsCache(input.accountId);

    return created;
  },
  { schema: CreateRequirementSchema },
);

export const updateRequirement = enhanceAction(
  async (input, user) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit requirements',
    );
    const { requirementId, accountId, ...rest } = input;
    const updated = await getService().updateRequirement(
      requirementId,
      accountId,
      rest,
      { actorUserId: user.id },
    );
    const { revalidateMatchRequirementsCache } =
      await import('~/lib/cache/disposals-data-cache');
    revalidateMatchRequirementsCache(accountId);
    return updated;
  },
  { schema: UpdateRequirementSchema },
);

export const deleteRequirement = enhanceAction(
  async (input) => {
    await getService().deleteRequirement(input.requirementId, input.accountId);
    const { revalidateMatchRequirementsCache } =
      await import('~/lib/cache/disposals-data-cache');
    revalidateMatchRequirementsCache(input.accountId);
    return { success: true };
  },
  { schema: DeleteRequirementSchema },
);

export const listRequirementOffices = enhanceAction(
  async (input) => getService().listOffices(input.accountId),
  { schema: ListRequirementOfficesSchema },
);
