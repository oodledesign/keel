'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  CreateListingMediaSchema,
  CreateListingSchema,
  CreateListingUnitSchema,
  DeleteListingMediaSchema,
  DeleteListingSchema,
  DeleteListingUnitSchema,
  GetListingSchema,
  ListListingsSchema,
  SetLandlordShareSchema,
  UpdateListingSchema,
  UpdateListingUnitSchema,
} from '../schema/listings.schema';
import { createListingsService } from './listings.service';

function getService() {
  return createListingsService(getSupabaseServerClient());
}

export const listListings = enhanceAction(
  async (input) => {
    return getService().listListings(input.accountId, input.status);
  },
  { schema: ListListingsSchema },
);

export const getListing = enhanceAction(
  async (input) => {
    return getService().getListing(input.listingId, input.accountId);
  },
  { schema: GetListingSchema },
);

export const createListing = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    return createListingsService(client).createListing({
      ...input,
      createdBy: user?.id ?? null,
    });
  },
  { schema: CreateListingSchema },
);

export const updateListing = enhanceAction(
  async (input) => {
    const { listingId, accountId, ...rest } = input;
    return getService().updateListing(listingId, accountId, rest);
  },
  { schema: UpdateListingSchema },
);

export const deleteListing = enhanceAction(
  async (input) => {
    await getService().deleteListing(input.listingId, input.accountId);
    return { success: true };
  },
  { schema: DeleteListingSchema },
);

export const setLandlordShare = enhanceAction(
  async (input) => {
    return getService().setLandlordShare(input);
  },
  { schema: SetLandlordShareSchema },
);

export const createListingUnit = enhanceAction(
  async (input) => {
    return getService().createUnit(input);
  },
  { schema: CreateListingUnitSchema },
);

export const updateListingUnit = enhanceAction(
  async (input) => {
    const { unitId, accountId, ...rest } = input;
    return getService().updateUnit(unitId, accountId, rest);
  },
  { schema: UpdateListingUnitSchema },
);

export const deleteListingUnit = enhanceAction(
  async (input) => {
    await getService().deleteUnit(input.unitId, input.accountId);
    return { success: true };
  },
  { schema: DeleteListingUnitSchema },
);

export const createListingMedia = enhanceAction(
  async (input) => {
    const media = await getService().createMedia(input);
    const [withUrl] = await getService().withSignedMediaUrls([media]);
    return withUrl ?? media;
  },
  { schema: CreateListingMediaSchema },
);

export const deleteListingMedia = enhanceAction(
  async (input) => {
    await getService().deleteMedia(input.mediaId, input.accountId);
    return { success: true };
  },
  { schema: DeleteListingMediaSchema },
);
