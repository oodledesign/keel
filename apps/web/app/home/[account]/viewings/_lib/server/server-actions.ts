'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  CreateViewingSchema,
  DeleteViewingSchema,
  ListViewingsSchema,
  UpdateViewingSchema,
} from '../schema/viewings.schema';
import { createViewingsService } from './viewings.service';

function getService() {
  return createViewingsService(getSupabaseServerClient());
}

export const listViewings = enhanceAction(
  async (input) => getService().listViewings(input.accountId),
  { schema: ListViewingsSchema },
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
