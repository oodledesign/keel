'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  DeleteRetainerServiceCategorySchema,
  DeleteRetainerServiceSchema,
  ListRetainerServiceCategoriesSchema,
  ListRetainerServicesSchema,
  PatchRetainerServiceSchema,
  ReorderRetainerServiceCategoriesSchema,
  SeedDefaultRetainerServicesSchema,
  UpsertRetainerServiceCategorySchema,
  UpsertRetainerServiceSchema,
} from '../schema/retainer-services.schema';
import { createRetainerServicesService } from './retainer-services.service';

function getService() {
  return createRetainerServicesService(getSupabaseServerClient());
}

function revalidateServices() {
  revalidatePath('/home/[account]/settings/services', 'page');
}

export const listRetainerServicesAction = enhanceAction(
  async (input) =>
    getService().list(input.accountId, { activeOnly: input.activeOnly }),
  { auth: true, schema: ListRetainerServicesSchema },
);

export const listRetainerServiceCategoriesAction = enhanceAction(
  async (input) => getService().listCategories(input.accountId),
  { auth: true, schema: ListRetainerServiceCategoriesSchema },
);

export const upsertRetainerServiceAction = enhanceAction(
  async (input) => {
    const result = await getService().upsert(input);
    revalidateServices();
    return result;
  },
  { auth: true, schema: UpsertRetainerServiceSchema },
);

export const patchRetainerServiceAction = enhanceAction(
  async (input) => {
    const result = await getService().patch(input);
    revalidateServices();
    return result;
  },
  { auth: true, schema: PatchRetainerServiceSchema },
);

export const deleteRetainerServiceAction = enhanceAction(
  async (input) => {
    const result = await getService().softDelete(input.accountId, input.id);
    revalidateServices();
    return result;
  },
  { auth: true, schema: DeleteRetainerServiceSchema },
);

export const seedDefaultRetainerServicesAction = enhanceAction(
  async (input) => {
    const result = await getService().seedDefaultsIfEmpty(input.accountId);
    revalidateServices();
    return result;
  },
  { auth: true, schema: SeedDefaultRetainerServicesSchema },
);

export const upsertRetainerServiceCategoryAction = enhanceAction(
  async (input) => {
    const result = await getService().upsertCategory(input);
    revalidateServices();
    return result;
  },
  { auth: true, schema: UpsertRetainerServiceCategorySchema },
);

export const deleteRetainerServiceCategoryAction = enhanceAction(
  async (input) => {
    const result = await getService().deleteCategory(input.accountId, input.id);
    revalidateServices();
    return result;
  },
  { auth: true, schema: DeleteRetainerServiceCategorySchema },
);

export const reorderRetainerServiceCategoriesAction = enhanceAction(
  async (input) => {
    const result = await getService().reorderCategories(
      input.accountId,
      input.ids,
    );
    revalidateServices();
    return result;
  },
  { auth: true, schema: ReorderRetainerServiceCategoriesSchema },
);
