'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  DeleteRequestTypeSchema,
  ListRequestTypesSchema,
  ReorderRequestTypesSchema,
  UpsertRequestTypeSchema,
} from '../schema/request-types.schema';
import { createRequestTypesService } from './request-types.service';

function getService() {
  return createRequestTypesService(getSupabaseServerClient());
}

export const listRequestTypesAction = enhanceAction(
  async (input) =>
    getService().list(input.accountId, { activeOnly: input.activeOnly }),
  { schema: ListRequestTypesSchema },
);

export const upsertRequestTypeAction = enhanceAction(
  async (input) => {
    const result = await getService().upsert(input);
    revalidatePath('/home/[account]/settings/services', 'page');
    return result;
  },
  { schema: UpsertRequestTypeSchema },
);

export const deleteRequestTypeAction = enhanceAction(
  async (input) => {
    const result = await getService().softDelete(input.accountId, input.id);
    revalidatePath('/home/[account]/settings/services', 'page');
    return result;
  },
  { schema: DeleteRequestTypeSchema },
);

export const reorderRequestTypesAction = enhanceAction(
  async (input) => {
    const result = await getService().reorder(
      input.accountId,
      input.orderedIds,
    );
    revalidatePath('/home/[account]/settings/services', 'page');
    return result;
  },
  { schema: ReorderRequestTypesSchema },
);
