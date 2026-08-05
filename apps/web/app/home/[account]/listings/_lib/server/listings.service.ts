import 'server-only';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';

import { randomBytes } from 'crypto';

import { getLogger } from '@kit/shared/logger';

import type {
  DisposalType,
  ListingStatus,
} from '~/lib/commercial/commercial-constants';
import {
  pushListingToPropertyHive,
  unpublishListingFromPropertyHive,
} from '~/lib/commercial/property-hive-sync';

import type {
  CreateListingEnquiryInput,
  CreateListingInput,
  CreateListingMediaInput,
  CreateListingUnitInput,
  MediaType,
  UpdateListingEnquiryInput,
  UpdateListingInput,
  UpdateListingUnitInput,
} from '../schema/listings.schema';

export type { MediaType };

const UNPUBLISH_STATUSES: ListingStatus[] = ['withdrawn', 'let', 'sold'];

/** Tables not yet in generated Database types — unwrap until typegen. */
function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

async function syncPropertyHiveOnStatusChange(input: {
  accountId: string;
  listingId: string;
  status: ListingStatus | undefined;
}) {
  if (!input.status) return;

  const logger = await getLogger();

  if (input.status === 'marketing') {
    try {
      await pushListingToPropertyHive(input.accountId, input.listingId);
    } catch (err) {
      logger.error(
        {
          name: 'commercial.listings.pushPropertyHive',
          accountId: input.accountId,
          listingId: input.listingId,
          error: err instanceof Error ? err.message : String(err),
        },
        'Property Hive push failed after status→marketing',
      );
    }
    return;
  }

  if (UNPUBLISH_STATUSES.includes(input.status)) {
    try {
      await unpublishListingFromPropertyHive(input.accountId, input.listingId);
    } catch (err) {
      logger.error(
        {
          name: 'commercial.listings.unpublishPropertyHive',
          accountId: input.accountId,
          listingId: input.listingId,
          error: err instanceof Error ? err.message : String(err),
        },
        'Property Hive unpublish failed after off-market status',
      );
    }
  }
}

export type ListingAgent = {
  userId: string;
  name: string;
  email: string | null;
  pictureUrl: string | null;
  sortOrder: number;
};

export type CommercialListing = {
  id: string;
  accountId: string;
  instructingClientId: string | null;
  assignedTo: string | null;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  town: string | null;
  postcode: string | null;
  country: string | null;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  sector: string | null;
  tenure: string | null;
  disposalType: DisposalType;
  instructionNature: 'exclusive' | 'joint';
  status: ListingStatus;
  askingRentPence: number | null;
  askingPricePence: number | null;
  rentFrequency: string | null;
  hideRentFromMarketing: boolean;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  measurementStandard: string | null;
  useClass: string | null;
  availableFrom: string | null;
  epcBand: string | null;
  epcRating: number | null;
  summary: string | null;
  description: string | null;
  locationCopy: string | null;
  keyPoints: string[];
  onMarketAt: string | null;
  offMarketAt: string | null;
  landlordShareToken: string | null;
  landlordShareEnabled: boolean;
  notes: string | null;
  externalId: string | null;
  paUserId: string | null;
  recordOwnerUserId: string | null;
  teamId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Signed cover/thumbnail URL when loaded with list thumbnails. */
  coverUrl?: string | null;
  /** Acting agents when loaded with list assignment data. */
  actingAgents?: ListingAgent[];
};

export type ListingMemberOption = {
  userId: string;
  name: string;
  email: string | null;
  pictureUrl: string | null;
};

export type WorkspaceTeam = {
  id: string;
  accountId: string;
  name: string;
  sortOrder: number;
};

export type ListingAssignment = {
  listingId: string;
  accountId: string;
  actingAgents: ListingAgent[];
  paUserId: string | null;
  recordOwnerUserId: string | null;
  teamId: string | null;
  teamName: string | null;
};

export type CommercialListingUnit = {
  id: string;
  listingId: string;
  accountId: string;
  label: string;
  floorOrUnit: string | null;
  sizeSqft: number | null;
  measurementStandard: string | null;
  sortOrder: number;
  externalId: string | null;
};

export type CommercialListingMedia = {
  id: string;
  listingId: string;
  accountId: string;
  mediaType: MediaType;
  storagePath: string | null;
  externalUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  sortOrder: number;
  isCover: boolean;
  createdAt: string;
  /** Signed or external URL for display (filled by loader when available). */
  url?: string | null;
};

export type CommercialEnquiry = {
  id: string;
  accountId: string;
  listingId: string | null;
  requirementId: string | null;
  source: string;
  status: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  message: string | null;
  targetSizeMinSqft: number | null;
  targetSizeMaxSqft: number | null;
  propertyTypes: string | null;
  areasText: string | null;
  tenure: string | null;
  receivedAt: string;
  createdAt: string;
};

export type CommercialPortalPublication = {
  id: string;
  accountId: string;
  listingId: string;
  portal: string;
  externalId: string | null;
  externalUrl: string | null;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
};

type ListingRow = Record<string, unknown> & {
  id: string;
  account_id: string;
  created_at: string;
  updated_at: string;
};

type UnitRow = Record<string, unknown> & {
  id: string;
  listing_id: string;
  account_id: string;
  label: string;
  sort_order: number;
};

type MediaRow = Record<string, unknown> & {
  id: string;
  listing_id: string;
  account_id: string;
  media_type: string;
  created_at: string;
  sort_order: number;
  is_cover?: boolean | null;
};

type EnquiryRow = Record<string, unknown> & {
  id: string;
  account_id: string;
  received_at: string;
  created_at: string;
};

type PublicationRow = Record<string, unknown> & {
  id: string;
  account_id: string;
  listing_id: string;
  portal: string;
};

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapKeyPoints(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function mapListing(row: ListingRow): CommercialListing {
  return {
    id: row.id,
    accountId: row.account_id,
    instructingClientId: (row.instructing_client_id as string | null) ?? null,
    assignedTo: (row.assigned_to as string | null) ?? null,
    name: (row.name as string) ?? 'Untitled',
    addressLine1: (row.address_line_1 as string | null) ?? null,
    addressLine2: (row.address_line_2 as string | null) ?? null,
    town: (row.town as string | null) ?? null,
    postcode: (row.postcode as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    county: (row.county as string | null) ?? null,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    sector: (row.sector as string | null) ?? null,
    tenure: (row.tenure as string | null) ?? null,
    disposalType: (row.disposal_type as DisposalType) ?? 'to_let',
    instructionNature:
      (row.instruction_nature as 'exclusive' | 'joint') ?? 'exclusive',
    status: (row.status as ListingStatus) ?? 'draft',
    askingRentPence: num(row.asking_rent_pence),
    askingPricePence: num(row.asking_price_pence),
    rentFrequency: (row.rent_frequency as string | null) ?? null,
    hideRentFromMarketing: Boolean(row.hide_rent_from_marketing),
    sizeMinSqft: num(row.size_min_sqft),
    sizeMaxSqft: num(row.size_max_sqft),
    measurementStandard: (row.measurement_standard as string | null) ?? null,
    useClass: (row.use_class as string | null) ?? null,
    availableFrom: (row.available_from as string | null) ?? null,
    epcBand: (row.epc_band as string | null) ?? null,
    epcRating: num(row.epc_rating),
    summary: (row.summary as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    locationCopy: (row.location_copy as string | null) ?? null,
    keyPoints: mapKeyPoints(row.key_points),
    onMarketAt: (row.on_market_at as string | null) ?? null,
    offMarketAt: (row.off_market_at as string | null) ?? null,
    landlordShareToken: (row.landlord_share_token as string | null) ?? null,
    landlordShareEnabled: Boolean(row.landlord_share_enabled),
    notes: (row.notes as string | null) ?? null,
    externalId: (row.external_id as string | null) ?? null,
    paUserId: (row.pa_user_id as string | null) ?? null,
    recordOwnerUserId: (row.record_owner_user_id as string | null) ?? null,
    teamId: (row.team_id as string | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUnit(row: UnitRow): CommercialListingUnit {
  return {
    id: row.id,
    listingId: row.listing_id,
    accountId: row.account_id,
    label: row.label,
    floorOrUnit: (row.floor_or_unit as string | null) ?? null,
    sizeSqft: num(row.size_sqft),
    measurementStandard: (row.measurement_standard as string | null) ?? null,
    sortOrder: row.sort_order ?? 0,
    externalId: (row.external_id as string | null) ?? null,
  };
}

function mapMedia(row: MediaRow): CommercialListingMedia {
  return {
    id: row.id,
    listingId: row.listing_id,
    accountId: row.account_id,
    mediaType: (row.media_type as MediaType) ?? 'image',
    storagePath: (row.storage_path as string | null) ?? null,
    externalUrl: (row.external_url as string | null) ?? null,
    fileName: (row.file_name as string | null) ?? null,
    mimeType: (row.mime_type as string | null) ?? null,
    sortOrder: row.sort_order ?? 0,
    isCover: Boolean(row.is_cover),
    createdAt: row.created_at,
  };
}

function mapEnquiry(row: EnquiryRow): CommercialEnquiry {
  return {
    id: row.id,
    accountId: row.account_id,
    listingId: (row.listing_id as string | null) ?? null,
    requirementId: (row.requirement_id as string | null) ?? null,
    source: (row.source as string) ?? 'manual',
    status: (row.status as string) ?? 'unactioned',
    contactName: (row.contact_name as string | null) ?? null,
    contactEmail: (row.contact_email as string | null) ?? null,
    contactPhone: (row.contact_phone as string | null) ?? null,
    message: (row.message as string | null) ?? null,
    targetSizeMinSqft: num(row.target_size_min_sqft),
    targetSizeMaxSqft: num(row.target_size_max_sqft),
    propertyTypes: (row.property_types as string | null) ?? null,
    areasText: (row.areas_text as string | null) ?? null,
    tenure: (row.tenure as string | null) ?? null,
    receivedAt: row.received_at,
    createdAt: row.created_at,
  };
}

function mapPublication(row: PublicationRow): CommercialPortalPublication {
  return {
    id: row.id,
    accountId: row.account_id,
    listingId: row.listing_id,
    portal: row.portal,
    externalId: (row.external_id as string | null) ?? null,
    externalUrl: (row.external_url as string | null) ?? null,
    status: (row.status as string) ?? 'draft',
    lastSyncAt: (row.last_sync_at as string | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
  };
}

function writeColumns(input: Partial<CreateListingInput>) {
  return {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.addressLine1 !== undefined && {
      address_line_1: input.addressLine1,
    }),
    ...(input.addressLine2 !== undefined && {
      address_line_2: input.addressLine2,
    }),
    ...(input.town !== undefined && { town: input.town }),
    ...(input.postcode !== undefined && { postcode: input.postcode }),
    ...(input.country !== undefined && { country: input.country }),
    ...(input.sector !== undefined && { sector: input.sector }),
    ...(input.tenure !== undefined && { tenure: input.tenure }),
    ...(input.disposalType !== undefined && {
      disposal_type: input.disposalType,
    }),
    ...(input.instructionNature !== undefined && {
      instruction_nature: input.instructionNature,
    }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.askingRentPence !== undefined && {
      asking_rent_pence: input.askingRentPence,
    }),
    ...(input.askingPricePence !== undefined && {
      asking_price_pence: input.askingPricePence,
    }),
    ...(input.rentFrequency !== undefined && {
      rent_frequency: input.rentFrequency,
    }),
    ...(input.hideRentFromMarketing !== undefined && {
      hide_rent_from_marketing: input.hideRentFromMarketing,
    }),
    ...(input.sizeMinSqft !== undefined && {
      size_min_sqft: input.sizeMinSqft,
    }),
    ...(input.sizeMaxSqft !== undefined && {
      size_max_sqft: input.sizeMaxSqft,
    }),
    ...(input.measurementStandard !== undefined && {
      measurement_standard: input.measurementStandard,
    }),
    ...(input.useClass !== undefined && { use_class: input.useClass }),
    ...(input.availableFrom !== undefined && {
      available_from: input.availableFrom,
    }),
    ...(input.epcBand !== undefined && { epc_band: input.epcBand }),
    ...(input.epcRating !== undefined && { epc_rating: input.epcRating }),
    ...(input.summary !== undefined && { summary: input.summary }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.locationCopy !== undefined && {
      location_copy: input.locationCopy,
    }),
    ...(input.keyPoints !== undefined && {
      key_points: input.keyPoints ?? [],
    }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.externalId !== undefined && { external_id: input.externalId }),
    ...(input.instructingClientId !== undefined && {
      instructing_client_id: input.instructingClientId,
    }),
    ...(input.county !== undefined && { county: input.county }),
    ...(input.latitude !== undefined && { latitude: input.latitude }),
    ...(input.longitude !== undefined && { longitude: input.longitude }),
  };
}

function generateShareToken() {
  return randomBytes(24).toString('hex');
}

async function signMediaUrl(
  client: SupabaseClient,
  item: CommercialListingMedia,
): Promise<CommercialListingMedia> {
  if (item.externalUrl) {
    return { ...item, url: item.externalUrl };
  }
  if (!item.storagePath) {
    return { ...item, url: null };
  }
  const { data, error } = await client.storage
    .from('commercial-listing-media')
    .createSignedUrl(item.storagePath, 3600);
  if (error) {
    console.error('[listings] signed media url error:', error.message);
    return { ...item, url: null };
  }
  return { ...item, url: data.signedUrl };
}

async function attachCoverUrls(
  client: SupabaseClient,
  listings: CommercialListing[],
): Promise<CommercialListing[]> {
  if (listings.length === 0) return listings;

  const listingIds = listings.map((l) => l.id);
  const { data: mediaRows, error } = await client
    .from('commercial_listing_media')
    .select('*')
    .in('listing_id', listingIds)
    .or('media_type.eq.image,mime_type.ilike.image/%')
    .order('is_cover', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[listings] cover media error:', error.message);
    return listings;
  }

  const coverByListing = new Map<string, CommercialListingMedia>();
  for (const row of (mediaRows ?? []) as MediaRow[]) {
    const media = mapMedia(row);
    if (!coverByListing.has(media.listingId)) {
      coverByListing.set(media.listingId, media);
    }
  }

  const signed = await Promise.all(
    [...coverByListing.values()].map((item) => signMediaUrl(client, item)),
  );
  const urlByListing = new Map(
    signed.map((item) => [item.listingId, item.url ?? null]),
  );

  return listings.map((listing) => ({
    ...listing,
    coverUrl: urlByListing.get(listing.id) ?? null,
  }));
}

async function attachActingAgents(
  client: SupabaseClient,
  accountId: string,
  listings: CommercialListing[],
): Promise<CommercialListing[]> {
  if (listings.length === 0) return listings;

  const listingIds = listings.map((l) => l.id);
  const { data: agentRows, error } = await fromTable(
    client,
    'commercial_listing_agents',
  )
    .select('listing_id, user_id, sort_order')
    .eq('account_id', accountId)
    .in('listing_id', listingIds)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[listings] attachActingAgents:', error.message);
    return listings.map((listing) => ({ ...listing, actingAgents: [] }));
  }

  const rows = (agentRows ?? []) as Array<{
    listing_id: string;
    user_id: string;
    sort_order: number;
  }>;
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const memberById = new Map<
    string,
    { name: string; email: string | null; pictureUrl: string | null }
  >();

  if (userIds.length > 0) {
    const { data: accounts } = await client
      .from('accounts')
      .select('id, name, picture_url')
      .in('id', userIds);
    for (const row of accounts ?? []) {
      memberById.set(row.id as string, {
        name: (row.name as string)?.trim() || 'Team member',
        email: null,
        pictureUrl: (row.picture_url as string | null) ?? null,
      });
    }
  }

  const agentsByListing = new Map<string, ListingAgent[]>();
  for (const row of rows) {
    const member = memberById.get(row.user_id);
    const list = agentsByListing.get(row.listing_id) ?? [];
    list.push({
      userId: row.user_id,
      name: member?.name ?? 'Team member',
      email: member?.email ?? null,
      pictureUrl: member?.pictureUrl ?? null,
      sortOrder: row.sort_order ?? list.length,
    });
    agentsByListing.set(row.listing_id, list);
  }

  return listings.map((listing) => ({
    ...listing,
    actingAgents: agentsByListing.get(listing.id) ?? [],
  }));
}

export function createListingsService(client: SupabaseClient) {
  return {
    async listListings(
      accountId: string,
      status?: ListingStatus,
    ): Promise<CommercialListing[]> {
      let query = client
        .from('commercial_listings')
        .select('*')
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[listings] listListings error:', error.message);
        return [];
      }

      const listings = ((data ?? []) as ListingRow[]).map(mapListing);
      const withCovers = await attachCoverUrls(client, listings);
      return attachActingAgents(client, accountId, withCovers);
    },

    async getListing(
      listingId: string,
      accountId: string,
    ): Promise<CommercialListing | null> {
      const { data, error } = await client
        .from('commercial_listings')
        .select('*')
        .eq('id', listingId)
        .eq('account_id', accountId)
        .maybeSingle();

      if (error || !data) return null;
      const [withCover] = await attachCoverUrls(client, [
        mapListing(data as ListingRow),
      ]);
      return withCover ?? null;
    },

    async createListing(
      input: CreateListingInput & { createdBy?: string | null },
    ): Promise<CommercialListing> {
      const { data, error } = await client
        .from('commercial_listings')
        .insert({
          account_id: input.accountId,
          name: input.name,
          address_line_1: input.addressLine1 ?? null,
          address_line_2: input.addressLine2 ?? null,
          town: input.town ?? null,
          postcode: input.postcode ?? null,
          country: input.country ?? 'GB',
          county: input.county ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          sector: input.sector ?? null,
          tenure: input.tenure ?? null,
          disposal_type: input.disposalType ?? 'to_let',
          instruction_nature: input.instructionNature ?? 'exclusive',
          status: input.status ?? 'draft',
          asking_rent_pence: input.askingRentPence ?? null,
          asking_price_pence: input.askingPricePence ?? null,
          rent_frequency: input.rentFrequency ?? 'per_annum',
          hide_rent_from_marketing: input.hideRentFromMarketing ?? false,
          size_min_sqft: input.sizeMinSqft ?? null,
          size_max_sqft: input.sizeMaxSqft ?? null,
          measurement_standard: input.measurementStandard ?? 'gia',
          use_class: input.useClass ?? null,
          available_from: input.availableFrom ?? null,
          epc_band: input.epcBand ?? null,
          epc_rating: input.epcRating ?? null,
          summary: input.summary ?? null,
          description: input.description ?? null,
          location_copy: input.locationCopy ?? null,
          key_points: input.keyPoints ?? [],
          notes: input.notes ?? null,
          external_id: input.externalId ?? null,
          instructing_client_id: input.instructingClientId ?? null,
          created_by: input.createdBy ?? null,
          on_market_at:
            input.status === 'marketing' ? new Date().toISOString() : null,
        })
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create listing');
      }

      const listing = mapListing(data as ListingRow);
      await syncPropertyHiveOnStatusChange({
        accountId: input.accountId,
        listingId: listing.id,
        status: listing.status,
      });
      return listing;
    },

    async updateListing(
      listingId: string,
      accountId: string,
      input: Omit<UpdateListingInput, 'listingId' | 'accountId'>,
    ): Promise<CommercialListing> {
      const patch = writeColumns(input);

      if (input.status === 'marketing') {
        const existing = await this.getListing(listingId, accountId);
        if (existing && !existing.onMarketAt) {
          Object.assign(patch, { on_market_at: new Date().toISOString() });
        }
      }

      if (
        input.status === 'let' ||
        input.status === 'sold' ||
        input.status === 'withdrawn'
      ) {
        Object.assign(patch, { off_market_at: new Date().toISOString() });
      }

      const { data, error } = await client
        .from('commercial_listings')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', listingId)
        .eq('account_id', accountId)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update listing');
      }

      const listing = mapListing(data as ListingRow);
      await syncPropertyHiveOnStatusChange({
        accountId,
        listingId,
        status: input.status,
      });
      return listing;
    },

    async deleteListing(listingId: string, accountId: string): Promise<void> {
      const { error } = await client
        .from('commercial_listings')
        .delete()
        .eq('id', listingId)
        .eq('account_id', accountId);

      if (error) throw new Error(error.message);
    },

    async listUnits(listingId: string): Promise<CommercialListingUnit[]> {
      const { data, error } = await client
        .from('commercial_listing_units')
        .select('*')
        .eq('listing_id', listingId)
        .order('sort_order');

      if (error) {
        console.error('[listings] listUnits error:', error.message);
        return [];
      }

      return ((data ?? []) as UnitRow[]).map(mapUnit);
    },

    async listUnitsForAccount(
      accountId: string,
    ): Promise<CommercialListingUnit[]> {
      const { data, error } = await client
        .from('commercial_listing_units')
        .select('*')
        .eq('account_id', accountId)
        .order('sort_order');

      if (error) {
        console.error('[listings] listUnitsForAccount error:', error.message);
        return [];
      }

      return ((data ?? []) as UnitRow[]).map(mapUnit);
    },

    async createUnit(
      input: CreateListingUnitInput,
    ): Promise<CommercialListingUnit> {
      const { data, error } = await client
        .from('commercial_listing_units')
        .insert({
          account_id: input.accountId,
          listing_id: input.listingId,
          label: input.label,
          floor_or_unit: input.floorOrUnit ?? null,
          size_sqft: input.sizeSqft ?? null,
          measurement_standard: input.measurementStandard ?? 'gia',
          sort_order: input.sortOrder ?? 0,
          external_id: input.externalId ?? null,
        })
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create unit');
      }

      return mapUnit(data as UnitRow);
    },

    async updateUnit(
      unitId: string,
      accountId: string,
      input: UpdateListingUnitInput,
    ): Promise<CommercialListingUnit> {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.label !== undefined) patch.label = input.label;
      if (input.floorOrUnit !== undefined)
        patch.floor_or_unit = input.floorOrUnit;
      if (input.sizeSqft !== undefined) patch.size_sqft = input.sizeSqft;
      if (input.measurementStandard !== undefined) {
        patch.measurement_standard = input.measurementStandard;
      }
      if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
      if (input.externalId !== undefined) patch.external_id = input.externalId;

      const { data, error } = await client
        .from('commercial_listing_units')
        .update(patch)
        .eq('id', unitId)
        .eq('account_id', accountId)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update unit');
      }

      return mapUnit(data as UnitRow);
    },

    async deleteUnit(unitId: string, accountId: string): Promise<void> {
      const { error } = await client
        .from('commercial_listing_units')
        .delete()
        .eq('id', unitId)
        .eq('account_id', accountId);

      if (error) throw new Error(error.message);
    },

    async listMedia(listingId: string): Promise<CommercialListingMedia[]> {
      const { data, error } = await client
        .from('commercial_listing_media')
        .select('*')
        .eq('listing_id', listingId)
        .order('sort_order')
        .order('created_at');

      if (error) {
        console.error('[listings] listMedia error:', error.message);
        return [];
      }

      return ((data ?? []) as MediaRow[]).map(mapMedia);
    },

    async createMedia(
      input: CreateListingMediaInput,
    ): Promise<CommercialListingMedia> {
      if (!input.storagePath && !input.externalUrl) {
        throw new Error('Provide a file or external URL');
      }

      const mediaType = input.mediaType ?? 'image';
      const isImage =
        mediaType === 'image' || Boolean(input.mimeType?.startsWith('image/'));

      let isCover = Boolean(input.isCover);
      if (isImage && !isCover) {
        const { count } = await client
          .from('commercial_listing_media')
          .select('id', { count: 'exact', head: true })
          .eq('listing_id', input.listingId)
          .eq('is_cover', true);
        isCover = (count ?? 0) === 0;
      }

      if (isCover) {
        await client
          .from('commercial_listing_media')
          .update({ is_cover: false })
          .eq('listing_id', input.listingId)
          .eq('is_cover', true);
      }

      const { data, error } = await client
        .from('commercial_listing_media')
        .insert({
          account_id: input.accountId,
          listing_id: input.listingId,
          media_type: mediaType,
          storage_path: input.storagePath ?? null,
          external_url: input.externalUrl ?? null,
          file_name: input.fileName ?? null,
          mime_type: input.mimeType ?? null,
          sort_order: input.sortOrder ?? 0,
          is_cover: isCover,
        })
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create media');
      }

      return mapMedia(data as MediaRow);
    },

    async setMediaCover(input: {
      mediaId: string;
      listingId: string;
      accountId: string;
    }): Promise<CommercialListingMedia> {
      await client
        .from('commercial_listing_media')
        .update({ is_cover: false })
        .eq('listing_id', input.listingId)
        .eq('account_id', input.accountId)
        .eq('is_cover', true);

      const { data, error } = await client
        .from('commercial_listing_media')
        .update({ is_cover: true, sort_order: 0 })
        .eq('id', input.mediaId)
        .eq('listing_id', input.listingId)
        .eq('account_id', input.accountId)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to set cover image');
      }

      return mapMedia(data as MediaRow);
    },

    async deleteMedia(mediaId: string, accountId: string): Promise<void> {
      const { data: existing, error: fetchError } = await client
        .from('commercial_listing_media')
        .select('storage_path')
        .eq('id', mediaId)
        .eq('account_id', accountId)
        .maybeSingle();

      if (fetchError) throw new Error(fetchError.message);

      const storagePath = (existing as { storage_path?: string | null } | null)
        ?.storage_path;

      const { error } = await client
        .from('commercial_listing_media')
        .delete()
        .eq('id', mediaId)
        .eq('account_id', accountId);

      if (error) throw new Error(error.message);

      if (storagePath) {
        const { error: storageError } = await client.storage
          .from('commercial-listing-media')
          .remove([storagePath]);
        if (storageError) {
          console.error(
            '[listings] deleteMedia storage error:',
            storageError.message,
          );
        }
      }
    },

    async withSignedMediaUrls(
      media: CommercialListingMedia[],
    ): Promise<CommercialListingMedia[]> {
      return Promise.all(media.map((item) => signMediaUrl(client, item)));
    },

    async listEnquiriesForListing(
      listingId: string,
    ): Promise<CommercialEnquiry[]> {
      const { data, error } = await client
        .from('commercial_enquiries')
        .select('*')
        .eq('listing_id', listingId)
        .order('received_at', { ascending: false });

      if (error) {
        console.error('[listings] listEnquiries error:', error.message);
        return [];
      }

      return ((data ?? []) as EnquiryRow[]).map(mapEnquiry);
    },

    async createEnquiry(
      input: CreateListingEnquiryInput,
    ): Promise<CommercialEnquiry> {
      const { data, error } = await client
        .from('commercial_enquiries')
        .insert({
          account_id: input.accountId,
          listing_id: input.listingId,
          contact_name: input.contactName?.trim() || null,
          contact_email: input.contactEmail?.trim() || null,
          contact_phone: input.contactPhone?.trim() || null,
          message: input.message?.trim() || null,
          source: input.source ?? 'manual',
          status: input.status ?? 'unactioned',
          received_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create enquiry');
      }

      const enquiry = mapEnquiry(data as EnquiryRow);

      const { data: listing } = await client
        .from('commercial_listings')
        .select('name')
        .eq('id', input.listingId)
        .eq('account_id', input.accountId)
        .maybeSingle();

      const listingName =
        (listing as { name?: string | null } | null)?.name?.trim() ||
        'Disposal';
      const contactLabel =
        enquiry.contactName?.trim() ||
        enquiry.contactEmail?.trim() ||
        'Enquiry';
      const dealName = `${contactLabel} — ${listingName}`;

      const noteParts = [
        enquiry.message?.trim() || null,
        enquiry.contactEmail ? `Email: ${enquiry.contactEmail}` : null,
        enquiry.contactPhone ? `Phone: ${enquiry.contactPhone}` : null,
        `Source: ${enquiry.source}`,
      ].filter(Boolean);

      const { error: dealError } = await client.from('pipeline_deals').insert({
        account_id: input.accountId,
        business_id: null,
        name: dealName,
        contact_name: contactLabel,
        company_name: null,
        notes: noteParts.length ? noteParts.join('\n') : null,
        value: 0,
        stage: 'enquiry',
        commercial_listing_id: input.listingId,
      });

      if (dealError) {
        console.error(
          '[listings] createEnquiry deal link failed:',
          dealError.message,
        );
        throw new Error(
          `Enquiry saved, but creating the deal failed: ${dealError.message}`,
        );
      }

      revalidatePath('/home', 'layout');

      return enquiry;
    },

    async updateEnquiry(
      enquiryId: string,
      accountId: string,
      input: Omit<UpdateListingEnquiryInput, 'enquiryId' | 'accountId'>,
    ): Promise<CommercialEnquiry> {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.status !== undefined) patch.status = input.status;
      if (input.source !== undefined) patch.source = input.source;
      if (input.contactName !== undefined) {
        patch.contact_name = input.contactName?.trim() || null;
      }
      if (input.contactEmail !== undefined) {
        patch.contact_email = input.contactEmail?.trim() || null;
      }
      if (input.contactPhone !== undefined) {
        patch.contact_phone = input.contactPhone?.trim() || null;
      }
      if (input.message !== undefined) {
        patch.message = input.message?.trim() || null;
      }

      const { data, error } = await client
        .from('commercial_enquiries')
        .update(patch)
        .eq('id', enquiryId)
        .eq('account_id', accountId)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update enquiry');
      }

      return mapEnquiry(data as EnquiryRow);
    },

    async getInterestSummary(listingId: string): Promise<{
      active: number;
      archived: number;
      total: number;
      linkedDeals: number;
    }> {
      const enquiries = await this.listEnquiriesForListing(listingId);
      const { count: linkedDeals } = await client
        .from('pipeline_deals')
        .select('id', { count: 'exact', head: true })
        .eq('commercial_listing_id', listingId);

      return {
        active: enquiries.filter((e) => e.status !== 'archived').length,
        archived: enquiries.filter((e) => e.status === 'archived').length,
        total: enquiries.length,
        linkedDeals: linkedDeals ?? 0,
      };
    },

    async listPublicationsForListing(
      listingId: string,
    ): Promise<CommercialPortalPublication[]> {
      const { data, error } = await client
        .from('commercial_portal_publications')
        .select('*')
        .eq('listing_id', listingId)
        .order('portal');

      if (error) {
        console.error('[listings] listPublications error:', error.message);
        return [];
      }

      return ((data ?? []) as PublicationRow[]).map(mapPublication);
    },

    async setLandlordShare(input: {
      listingId: string;
      accountId: string;
      enabled: boolean;
    }): Promise<CommercialListing> {
      const existing = await this.getListing(input.listingId, input.accountId);
      if (!existing) {
        throw new Error('Listing not found');
      }

      const token =
        input.enabled && !existing.landlordShareToken
          ? generateShareToken()
          : existing.landlordShareToken;

      const { data, error } = await client
        .from('commercial_listings')
        .update({
          landlord_share_enabled: input.enabled,
          landlord_share_token: token,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.listingId)
        .eq('account_id', input.accountId)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update landlord share');
      }

      return mapListing(data as ListingRow);
    },

    async listAccountMembers(
      accountSlug: string,
    ): Promise<ListingMemberOption[]> {
      const { data, error } = await client.rpc('get_account_members', {
        account_slug: accountSlug,
      });
      if (error) {
        console.error('[listings] listAccountMembers:', error.message);
        return [];
      }

      return (
        (data ?? []) as Array<{
          user_id: string;
          name?: string | null;
          email?: string | null;
          picture_url?: string | null;
        }>
      )
        .map((row) => ({
          userId: row.user_id,
          name: row.name?.trim() || row.email?.trim() || 'Team member',
          email: row.email?.trim() || null,
          pictureUrl: row.picture_url?.trim() || null,
        }))
        .filter((row) => Boolean(row.userId));
    },

    async listWorkspaceTeams(accountId: string): Promise<WorkspaceTeam[]> {
      const { data, error } = await fromTable(client, 'commercial_workspace_teams')
        .select('id, account_id, name, sort_order')
        .eq('account_id', accountId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('[listings] listWorkspaceTeams:', error.message);
        return [];
      }

      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: row.id as string,
        accountId: row.account_id as string,
        name: (row.name as string) ?? '',
        sortOrder: Number(row.sort_order ?? 0),
      }));
    },

    async createWorkspaceTeam(input: {
      accountId: string;
      name: string;
    }): Promise<WorkspaceTeam> {
      const name = input.name.trim();
      if (!name) throw new Error('Team name is required');

      const { data: existing } = await fromTable(client, 'commercial_workspace_teams')
        .select('id, account_id, name, sort_order')
        .eq('account_id', input.accountId)
        .ilike('name', name)
        .maybeSingle();

      if (existing) {
        return {
          id: existing.id as string,
          accountId: existing.account_id as string,
          name: existing.name as string,
          sortOrder: Number(existing.sort_order ?? 0),
        };
      }

      const { count } = await fromTable(client, 'commercial_workspace_teams')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', input.accountId);

      const { data, error } = await fromTable(client, 'commercial_workspace_teams')
        .insert({
          account_id: input.accountId,
          name,
          sort_order: count ?? 0,
        })
        .select('id, account_id, name, sort_order')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create team');
      }

      return {
        id: data.id as string,
        accountId: data.account_id as string,
        name: data.name as string,
        sortOrder: Number(data.sort_order ?? 0),
      };
    },

    async getListingAssignment(
      listingId: string,
      accountId: string,
      accountSlug: string,
    ): Promise<ListingAssignment> {
      const listing = await this.getListing(listingId, accountId);
      if (!listing) throw new Error('Listing not found');

      const members = await this.listAccountMembers(accountSlug);
      const byUser = new Map(members.map((m) => [m.userId, m]));

      const { data: agentRows, error: agentError } = await fromTable(client, 'commercial_listing_agents')
        .select('user_id, sort_order')
        .eq('listing_id', listingId)
        .eq('account_id', accountId)
        .order('sort_order', { ascending: true });

      if (agentError) {
        console.error(
          '[listings] getListingAssignment agents:',
          agentError.message,
        );
      }

      const actingAgents: ListingAgent[] = (
        (agentRows ?? []) as Array<{ user_id: string; sort_order: number }>
      ).map((row, index) => {
        const member = byUser.get(row.user_id);
        return {
          userId: row.user_id,
          name: member?.name ?? 'Team member',
          email: member?.email ?? null,
          pictureUrl: member?.pictureUrl ?? null,
          sortOrder: row.sort_order ?? index,
        };
      });

      let teamName: string | null = null;
      if (listing.teamId) {
        const { data: team } = await fromTable(client, 'commercial_workspace_teams')
          .select('name')
          .eq('id', listing.teamId)
          .eq('account_id', accountId)
          .maybeSingle();
        teamName = (team?.name as string | null | undefined)?.trim() || null;
      }

      return {
        listingId,
        accountId,
        actingAgents,
        paUserId: listing.paUserId,
        recordOwnerUserId: listing.recordOwnerUserId ?? listing.assignedTo,
        teamId: listing.teamId,
        teamName,
      };
    },

    async updateListingAssignment(input: {
      listingId: string;
      accountId: string;
      accountSlug: string;
      actingAgentUserIds?: string[];
      paUserId?: string | null;
      recordOwnerUserId?: string | null;
      teamId?: string | null;
    }): Promise<ListingAssignment> {
      const listing = await this.getListing(input.listingId, input.accountId);
      if (!listing) throw new Error('Listing not found');

      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.paUserId !== undefined) {
        patch.pa_user_id = input.paUserId;
      }
      if (input.recordOwnerUserId !== undefined) {
        patch.record_owner_user_id = input.recordOwnerUserId;
        // Keep legacy assigned_to in sync with record owner
        patch.assigned_to = input.recordOwnerUserId;
      }
      if (input.teamId !== undefined) {
        patch.team_id = input.teamId;
      }

      if (Object.keys(patch).length > 1) {
        const { error } = await client
          .from('commercial_listings')
          .update(patch)
          .eq('id', input.listingId)
          .eq('account_id', input.accountId);
        if (error) throw new Error(error.message);
      }

      if (input.actingAgentUserIds !== undefined) {
        const uniqueIds = Array.from(
          new Set(input.actingAgentUserIds.filter(Boolean)),
        );

        const { error: deleteError } = await fromTable(client, 'commercial_listing_agents')
          .delete()
          .eq('listing_id', input.listingId)
          .eq('account_id', input.accountId);
        if (deleteError) throw new Error(deleteError.message);

        if (uniqueIds.length > 0) {
          const { error: insertError } = await fromTable(client, 'commercial_listing_agents')
            .insert(
              uniqueIds.map((userId, index) => ({
                listing_id: input.listingId,
                account_id: input.accountId,
                user_id: userId,
                sort_order: index,
              })),
            );
          if (insertError) throw new Error(insertError.message);
        }
      }

      return this.getListingAssignment(
        input.listingId,
        input.accountId,
        input.accountSlug,
      );
    },
  };
}
