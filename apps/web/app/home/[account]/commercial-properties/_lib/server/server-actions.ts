'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  AddCommercialPropertyPartySchema,
  CreateCommercialPropertySchema,
  CreatePropertyFromListingSchema,
  GetCommercialPropertySchema,
  LinkListingToPropertySchema,
  ListCommercialPropertiesSchema,
  RemoveCommercialPropertyPartySchema,
  SearchCommercialPropertiesSchema,
  SearchPropertyPartyClientsSchema,
  UpdateCommercialPropertySchema,
} from '../schema/commercial-properties.schema';
import { createCommercialPropertiesService } from './commercial-properties.service';

function getService() {
  return createCommercialPropertiesService(getSupabaseServerClient());
}

export const listCommercialProperties = enhanceAction(
  async (input) => getService().listProperties(input),
  { schema: ListCommercialPropertiesSchema },
);

export const getCommercialProperty = enhanceAction(
  async (input) => getService().getProperty(input.propertyId, input.accountId),
  { schema: GetCommercialPropertySchema },
);

export const createCommercialProperty = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(input.accountId, 'create properties');
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    const property = await getService().createProperty({
      ...input,
      createdBy: user?.id ?? null,
    });
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/home', 'layout');
    return property;
  },
  { schema: CreateCommercialPropertySchema },
);

export const updateCommercialProperty = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(input.accountId, 'update properties');
    const property = await getService().updateProperty(input);
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/home', 'layout');
    return property;
  },
  { schema: UpdateCommercialPropertySchema },
);

export const searchCommercialProperties = enhanceAction(
  async (input) => getService().searchProperties(input),
  { schema: SearchCommercialPropertiesSchema },
);

export const searchPropertyPartyClients = enhanceAction(
  async (input) => getService().searchPartyClients(input),
  { schema: SearchPropertyPartyClientsSchema },
);

export const addCommercialPropertyParty = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'link property parties',
    );
    const result = await getService().addParty(input);
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/home', 'layout');
    return result;
  },
  { schema: AddCommercialPropertyPartySchema },
);

export const removeCommercialPropertyParty = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'link property parties',
    );
    const result = await getService().removeParty(input);
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/home', 'layout');
    return result;
  },
  { schema: RemoveCommercialPropertyPartySchema },
);

export const linkListingToCommercialProperty = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'link disposal to property',
    );
    await getService().linkListingToProperty(input);
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/home', 'layout');
    return { success: true as const };
  },
  { schema: LinkListingToPropertySchema },
);

export const createCommercialPropertyFromListing = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create property from disposal',
    );
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    const property = await getService().createPropertyFromListing({
      ...input,
      createdBy: user?.id ?? null,
    });
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/home', 'layout');
    return property;
  },
  { schema: CreatePropertyFromListingSchema },
);
