'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  DeleteRetainerServiceSchema,
  ListRetainerServicesSchema,
  UpsertRetainerServiceSchema,
} from '../schema/retainer-services.schema';
import { createRetainerServicesService } from './retainer-services.service';

function getService() {
  return createRetainerServicesService(getSupabaseServerClient());
}

export const listRetainerServicesAction = enhanceAction(
  async (input) =>
    getService().list(input.accountId, { activeOnly: input.activeOnly }),
  { auth: true, schema: ListRetainerServicesSchema },
);

export const upsertRetainerServiceAction = enhanceAction(
  async (input) => {
    const result = await getService().upsert(input);
    revalidatePath('/home/[account]/settings/services', 'page');
    return result;
  },
  { auth: true, schema: UpsertRetainerServiceSchema },
);

export const deleteRetainerServiceAction = enhanceAction(
  async (input) => {
    const result = await getService().softDelete(input.accountId, input.id);
    revalidatePath('/home/[account]/settings/services', 'page');
    return result;
  },
  { auth: true, schema: DeleteRetainerServiceSchema },
);
