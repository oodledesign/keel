'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  AddListingCoAgentSchema,
  AddListingPartySchema,
  ArchiveListingSchema,
  BackfillListingLocationsSchema,
  CountSuggestedMatchesSchema,
  CountUnassignedListingsSchema,
  CreateListingEnquirySchema,
  CreateListingMediaSchema,
  CreateListingSchema,
  CreateListingUnitSchema,
  CreateWorkspaceTeamSchema,
  DeleteListingMediaSchema,
  DeleteListingSchema,
  DeleteListingUnitSchema,
  DuplicateListingSchema,
  GetListingAssignmentSchema,
  GetListingSchema,
  ListListingCoAgentsSchema,
  ListListingMembersSchema,
  ListListingPartiesSchema,
  ListListingsSchema,
  ListWorkspaceTeamsSchema,
  RemoveListingCoAgentSchema,
  RemoveListingPartySchema,
  SearchCoAgentClientsSchema,
  SearchListingPartyClientsSchema,
  SetBrochureShareSchema,
  SetLandlordShareSchema,
  SetListingMediaCoverSchema,
  UpdateListingAssignmentSchema,
  UpdateListingEnquirySchema,
  UpdateListingMediaSchema,
  UpdateListingPartySchema,
  UpdateListingSchema,
  UpdateListingUnitSchema,
} from '../schema/listings.schema';
import { createListingsService } from './listings.service';

function getService() {
  return createListingsService(getSupabaseServerClient());
}

async function invalidateDisposalsData(input: {
  accountId: string;
  listingId?: string;
}) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const { revalidateDisposalsCaches } =
    await import('~/lib/cache/disposals-data-cache');
  revalidateDisposalsCaches({
    accountId: input.accountId,
    userId: user?.id,
    listingId: input.listingId,
  });
}

export const listListings = enhanceAction(
  async (input) => {
    return getService().listListingsPage({
      accountId: input.accountId,
      status: input.status,
      statuses: input.statuses,
      search: input.search,
      accountBranchId: input.accountBranchId,
      actingAgentUserId: input.actingAgentUserId,
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 20,
    });
  },
  { schema: ListListingsSchema },
);

export const countUnassignedListings = enhanceAction(
  async (input) => {
    return getService().countUnassignedListings({
      accountId: input.accountId,
      status: input.status,
      statuses: input.statuses,
    });
  },
  { schema: CountUnassignedListingsSchema },
);

export const countSuggestedMatches = enhanceAction(
  async (input) => {
    return getService().countSuggestedMatchesByListingIds({
      accountId: input.accountId,
      listingIds: input.listingIds,
    });
  },
  { schema: CountSuggestedMatchesSchema },
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
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );
    return createListingsService(client)
      .createListing({
        ...input,
        createdBy: user?.id ?? null,
      })
      .then(async (listing) => {
        await invalidateDisposalsData({
          accountId: input.accountId,
          listingId: listing.id,
        });
        return listing;
      });
  },
  { schema: CreateListingSchema },
);

export const updateListing = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );
    const { listingId, accountId, ...rest } = input;
    const listing = await getService().updateListing(
      listingId,
      accountId,
      rest,
    );
    await invalidateDisposalsData({ accountId, listingId });
    return listing;
  },
  { schema: UpdateListingSchema },
);

export const deleteListing = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );
    await getService().deleteListing(input.listingId, input.accountId);
    await invalidateDisposalsData({
      accountId: input.accountId,
      listingId: input.listingId,
    });
    return { success: true };
  },
  { schema: DeleteListingSchema },
);

export const duplicateListing = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );
    const listing = await createListingsService(client).duplicateListing({
      listingId: input.listingId,
      accountId: input.accountId,
      accountSlug: input.accountSlug,
      createdBy: user?.id ?? null,
    });
    await invalidateDisposalsData({
      accountId: input.accountId,
      listingId: listing.id,
    });
    return listing;
  },
  { schema: DuplicateListingSchema },
);

export const archiveListing = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );
    const listing = await getService().archiveListing({
      listingId: input.listingId,
      accountId: input.accountId,
    });
    await invalidateDisposalsData({
      accountId: input.accountId,
      listingId: input.listingId,
    });
    return listing;
  },
  { schema: ArchiveListingSchema },
);

export const backfillListingLocations = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );
    return getService().backfillListingLocations(input.accountId, {
      limit: input.limit,
    });
  },
  { schema: BackfillListingLocationsSchema },
);

export const setLandlordShare = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );
    return getService().setLandlordShare(input);
  },
  { schema: SetLandlordShareSchema },
);

export const setBrochureShare = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );
    return getService().setBrochureShare(input);
  },
  { schema: SetBrochureShareSchema },
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

export const updateListingMedia = enhanceAction(
  async (input) => {
    const media = await getService().updateMedia(input);
    const [withUrl] = await getService().withSignedMediaUrls([media]);
    return withUrl ?? media;
  },
  { schema: UpdateListingMediaSchema },
);

export const deleteListingMedia = enhanceAction(
  async (input) => {
    await getService().deleteMedia(
      input.mediaId,
      input.accountId,
      input.listingId,
    );
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
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
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
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
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

export const listListingParties = enhanceAction(
  async (input) =>
    getService().listParties(input.listingId, input.accountId, input.role),
  { schema: ListListingPartiesSchema },
);

export const searchListingPartyClients = enhanceAction(
  async (input) => getService().searchPartyClients(input),
  { schema: SearchListingPartyClientsSchema },
);

export const addListingParty = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'link listing parties',
    );
    const result = await getService().addParty({
      listingId: input.listingId,
      accountId: input.accountId,
      role: input.role,
      clientId: input.clientId,
      contactId: input.contactId,
      companyName: input.companyName,
      contactName: input.contactName,
      contactEmail: input.contactEmail || null,
      contactPhone: input.contactPhone,
      isPrivate: input.isPrivate,
    });
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/home', 'layout');
    return result;
  },
  { schema: AddListingPartySchema },
);

export const removeListingParty = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'link listing parties',
    );
    const result = await getService().removeParty(input);
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/home', 'layout');
    return result;
  },
  { schema: RemoveListingPartySchema },
);

export const updateListingParty = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'link listing parties',
    );
    const result = await getService().updateParty(input);
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/home', 'layout');
    return result;
  },
  { schema: UpdateListingPartySchema },
);
