import 'server-only';

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
  CreateListingInput,
  CreateListingMediaInput,
  CreateListingUnitInput,
  MediaType,
  UpdateListingInput,
  UpdateListingUnitInput,
} from '../schema/listings.schema';

export type { MediaType };

const UNPUBLISH_STATUSES: ListingStatus[] = ['withdrawn', 'let', 'sold'];

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
  onMarketAt: string | null;
  offMarketAt: string | null;
  landlordShareToken: string | null;
  landlordShareEnabled: boolean;
  notes: string | null;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
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
    onMarketAt: (row.on_market_at as string | null) ?? null,
    offMarketAt: (row.off_market_at as string | null) ?? null,
    landlordShareToken: (row.landlord_share_token as string | null) ?? null,
    landlordShareEnabled: Boolean(row.landlord_share_enabled),
    notes: (row.notes as string | null) ?? null,
    externalId: (row.external_id as string | null) ?? null,
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
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.externalId !== undefined && { external_id: input.externalId }),
    ...(input.instructingClientId !== undefined && {
      instructing_client_id: input.instructingClientId,
    }),
  };
}

function generateShareToken() {
  return randomBytes(24).toString('hex');
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

      return ((data ?? []) as ListingRow[]).map(mapListing);
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
      return mapListing(data as ListingRow);
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

      const { data, error } = await client
        .from('commercial_listing_media')
        .insert({
          account_id: input.accountId,
          listing_id: input.listingId,
          media_type: input.mediaType ?? 'image',
          storage_path: input.storagePath ?? null,
          external_url: input.externalUrl ?? null,
          file_name: input.fileName ?? null,
          mime_type: input.mimeType ?? null,
          sort_order: input.sortOrder ?? 0,
        })
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create media');
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
      return Promise.all(
        media.map(async (item) => {
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
            console.error(
              '[listings] signed media url error:',
              error.message,
            );
            return { ...item, url: null };
          }
          return { ...item, url: data.signedUrl };
        }),
      );
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
  };
}
