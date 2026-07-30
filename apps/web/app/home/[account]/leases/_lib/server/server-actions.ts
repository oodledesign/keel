'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  CreateLeaseSchema,
  DeleteLeaseSchema,
  ListLeasesSchema,
  UpdateLeaseSchema,
} from '../schema/leases.schema';
import { createLeasesService } from './leases.service';

function getService() {
  return createLeasesService(getSupabaseServerClient());
}

export const listLeases = enhanceAction(
  async (input) => getService().listLeases(input.accountId),
  { schema: ListLeasesSchema },
);

export const createLease = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    return createLeasesService(client).createLease({
      ...input,
      createdBy: user?.id ?? null,
    });
  },
  { schema: CreateLeaseSchema },
);

export const updateLease = enhanceAction(
  async (input) => {
    const { leaseId, accountId, ...rest } = input;
    return getService().updateLease(leaseId, accountId, rest);
  },
  { schema: UpdateLeaseSchema },
);

export const deleteLease = enhanceAction(
  async (input) => {
    await getService().deleteLease(input.leaseId, input.accountId);
    return { success: true };
  },
  { schema: DeleteLeaseSchema },
);
