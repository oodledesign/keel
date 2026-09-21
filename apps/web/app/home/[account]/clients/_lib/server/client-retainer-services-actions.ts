'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  AddCustomClientRetainerServiceSchema,
  LoadClientRetainerServicesSchema,
  ReplaceClientRetainerServicesSchema,
  ResetClientRetainerServicesSchema,
} from '../schema/client-retainer-services.schema';
import { createClientRetainerServicesService } from './client-retainer-services.service';

function getService() {
  return createClientRetainerServicesService(getSupabaseServerClient());
}

export const loadClientRetainerServicesAction = enhanceAction(
  async (input) => getService().load(input.accountId, input.clientId),
  { auth: true, schema: LoadClientRetainerServicesSchema },
);

export const replaceClientRetainerServicesAction = enhanceAction(
  async (input) => {
    const result = await getService().replaceList({
      accountId: input.accountId,
      clientId: input.clientId,
      services: input.services.map((row) => ({
        id: row.id,
        sourceServiceId: null,
        name: row.name,
        description: row.description ?? null,
        creditCost: row.creditCost,
        requestTypeId: row.requestTypeId ?? null,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
        scope: 'client',
      })),
    });
    revalidatePath('/home/[account]/clients', 'page');
    return result;
  },
  { auth: true, schema: ReplaceClientRetainerServicesSchema },
);

export const resetClientRetainerServicesAction = enhanceAction(
  async (input) => {
    const result = await getService().reset(input.accountId, input.clientId);
    revalidatePath('/home/[account]/clients', 'page');
    return result;
  },
  { auth: true, schema: ResetClientRetainerServicesSchema },
);

export const addCustomClientRetainerServiceAction = enhanceAction(
  async (input) => {
    const result = await getService().addCustom(input);
    revalidatePath('/home/[account]/clients', 'page');
    return result;
  },
  { auth: true, schema: AddCustomClientRetainerServiceSchema },
);
