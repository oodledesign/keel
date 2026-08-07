'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  CreateListingEnquirySchema,
  CreateListingMediaSchema,
  CreateListingSchema,
  CreateListingUnitSchema,
  CreateWorkspaceTeamSchema,
  DeleteListingMediaSchema,
  DeleteListingSchema,
  DeleteListingUnitSchema,
  GetListingAssignmentSchema,
  GetListingSchema,
  AddListingCoAgentSchema,
  ListListingCoAgentsSchema,
  ListListingMembersSchema,
  ListListingsSchema,
  ListWorkspaceTeamsSchema,
  RemoveListingCoAgentSchema,
  SearchCoAgentClientsSchema,
  SetLandlordShareSchema,
  SetListingMediaCoverSchema,
  UpdateListingAssignmentSchema,
  UpdateListingEnquirySchema,
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
    const { requireCommercialBillableActor } = await import(
      '~/lib/commercial/require-commercial-billable-actor'
    );
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );
    return createListingsService(client).createListing({
      ...input,
      createdBy: user?.id ?? null,
    });
  },
  { schema: CreateListingSchema },
);

export const updateListing = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } = await import(
      '~/lib/commercial/require-commercial-billable-actor'
    );
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );
    const { listingId, accountId, ...rest } = input;
    return getService().updateListing(listingId, accountId, rest);
  },
  { schema: UpdateListingSchema },
);

export const deleteListing = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } = await import(
      '~/lib/commercial/require-commercial-billable-actor'
    );
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );
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

export const setListingMediaCover = enhanceAction(
  async (input) => {
    const media = await getService().setMediaCover(input);
    const [withUrl] = await getService().withSignedMediaUrls([media]);
    return withUrl ?? media;
  },
  { schema: SetListingMediaCoverSchema },
);

export const deleteListingMedia = enhanceAction(
  async (input) => {
    await getService().deleteMedia(input.mediaId, input.accountId);
    return { success: true };
  },
  { schema: DeleteListingMediaSchema },
);

export const createListingEnquiry = enhanceAction(
  async (input) => {
    return getService().createEnquiry(input);
  },
  { schema: CreateListingEnquirySchema },
);

export const updateListingEnquiry = enhanceAction(
  async (input) => {
    const { enquiryId, accountId, ...rest } = input;
    return getService().updateEnquiry(enquiryId, accountId, rest);
  },
  { schema: UpdateListingEnquirySchema },
);

export const listListingMembers = enhanceAction(
  async (input) => getService().listAccountMembers(input.accountSlug),
  { schema: ListListingMembersSchema },
);

export const listWorkspaceTeams = enhanceAction(
  async (input) => getService().listWorkspaceTeams(input.accountId),
  { schema: ListWorkspaceTeamsSchema },
);

export const createWorkspaceTeam = enhanceAction(
  async (input) => getService().createWorkspaceTeam(input),
  { schema: CreateWorkspaceTeamSchema },
);

export const getListingAssignment = enhanceAction(
  async (input) =>
    getService().getListingAssignment(
      input.listingId,
      input.accountId,
      input.accountSlug,
    ),
  { schema: GetListingAssignmentSchema },
);

export const updateListingAssignment = enhanceAction(
  async (input) => getService().updateListingAssignment(input),
  { schema: UpdateListingAssignmentSchema },
);

export const listListingCoAgents = enhanceAction(
  async (input) => getService().listCoAgents(input.listingId, input.accountId),
  { schema: ListListingCoAgentsSchema },
);

export const searchCoAgentClients = enhanceAction(
  async (input) => getService().searchCoAgentClients(input),
  { schema: SearchCoAgentClientsSchema },
);

export const addListingCoAgent = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } = await import(
      '~/lib/commercial/require-commercial-billable-actor'
    );
    await requireCommercialBillableActor(
      input.accountId,
      'link co-marketing agents',
    );
    const result = await getService().addCoAgent({
      listingId: input.listingId,
      accountId: input.accountId,
      clientId: input.clientId,
      companyName: input.companyName,
      contactName: input.contactName,
      contactEmail: input.contactEmail || null,
      contactPhone: input.contactPhone,
    });
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/home', 'layout');
    return result;
  },
  { schema: AddListingCoAgentSchema },
);

export const removeListingCoAgent = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } = await import(
      '~/lib/commercial/require-commercial-billable-actor'
    );
    await requireCommercialBillableActor(
      input.accountId,
      'link co-marketing agents',
    );
    const result = await getService().removeCoAgent(input);
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/home', 'layout');
    return result;
  },
  { schema: RemoveListingCoAgentSchema },
);
