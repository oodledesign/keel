import 'server-only';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';

import { randomBytes } from 'crypto';

import { getLogger } from '@kit/shared/logger';

import type {
  DisposalType,
  ListingLetType,
  ListingPartyRole,
  ListingStatus,
} from '~/lib/commercial/commercial-constants';
import { geocodeListingAddress } from '~/lib/commercial/geocode-listing';
import {
  recordListingEvent,
  type ListingEventType,
} from '~/lib/commercial/listing-events';
import { resolveCommercialMediaPublicUrl } from '~/lib/commercial/migrate-external-listing-media';
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
import { createMatchSuggestionsService } from './match-suggestions.service';

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
  isInstructed: boolean;
  termsOfEngagement: 'yes' | 'no' | 'pending' | null;
  restrictAccessToAssigned: boolean;
  hideLandlordFromMarketing: boolean;
  commercialPropertyId: string | null;
  referenceNumber: string | null;
  projectCode: string | null;
  accountBranchId: string | null;
  averageFloorPlateSqft: number | null;
  sizeBreakdown: string | null;
  controlledBy: string | null;
  sizeAccuracy: string | null;
  termsInternal: string | null;
  breeamRating: string | null;
  conditionDescription: string | null;
  status: ListingStatus;
  askingRentPence: number | null;
  askingRentToPence: number | null;
  askingPricePence: number | null;
  rentFrequency: string | null;
  hideRentFromMarketing: boolean;
  hidePriceFromMarketing: boolean;
  serviceChargePerSqft: number | null;
  ratesPayablePerSqft: number | null;
  estateChargePerSqft: number | null;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  measurementStandard: string | null;
  useClass: string | null;
  availableFrom: string | null;
  letType: ListingLetType | null;
  letContractLengthMonths: number | null;
  epcBand: string | null;
  epcRating: number | null;
  possession: string | null;
  buildStatus: string | null;
  planningStatus: string | null;
  fittedSpace: boolean | null;
  landSizeMin: number | null;
  landSizeMax: number | null;
  landSizeMetric: string | null;
  insuranceType: string | null;
  streetViewPanoId: string | null;
  streetViewHeading: number | null;
  streetViewPitch: number | null;
  streetViewZoom: number | null;
  summary: string | null;
  description: string | null;
  locationCopy: string | null;
  keyPoints: string[];
  amenities: string[];
  parkingAvailable: boolean;
  parkingSpaces: number | null;
  marketingSections: Array<{
    id: string;
    kind: 'promo' | 'specifications' | 'viewings' | 'terms' | 'custom';
    title: string;
    body: string;
  }>;
  websiteUrl: string | null;
  onMarketAt: string | null;
  offMarketAt: string | null;
  landlordShareToken: string | null;
  landlordShareEnabled: boolean;
  brochureShareToken: string | null;
  brochureShareEnabled: boolean;
  autoCirculateMatches: boolean;
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
  /** External co-marketing agents (workspace clients) when loaded. */
  coAgents?: ListingCoAgent[];
  /** Suggested fits + linked interest count when loaded with list match counts. */
  matchCount?: number;
};

export type ListingMemberOption = {
  userId: string;
  name: string;
  email: string | null;
  pictureUrl: string | null;
};

export type ListingCoAgent = {
  id: string;
  listingId: string;
  clientId: string;
  clientName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  externalId: string | null;
  sortOrder: number;
};

export type CoAgentClientOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  commercialRole: string | null;
  contactId?: string | null;
  contactName?: string | null;
  subtitle?: string | null;
};

export type ListingParty = {
  id: string;
  listingId: string;
  clientId: string;
  contactId: string | null;
  role: ListingPartyRole;
  clientName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  displayPhone: string | null;
  isPrivate: boolean;
  sortOrder: number;
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
  accountBranchId: string | null;
  accountBranchName: string | null;
  restrictAccessToAssigned: boolean;
};

export type CommercialListingUnit = {
  id: string;
  listingId: string;
  accountId: string;
  label: string;
  floorOrUnit: string | null;
  description: string | null;
  partFloor: boolean;
  sector: string | null;
  tenure: string | null;
  status: string | null;
  sizeSqft: number | null;
  measurementStandard: string | null;
  askingRentPence: number | null;
  rentPerSqft: number | null;
  serviceChargePerSqft: number | null;
  ratesPayablePerSqft: number | null;
  estateChargePerSqft: number | null;
  epcBand: string | null;
  possession: string | null;
  buildStatus: string | null;
  planningStatus: string | null;
  fittedSpace: boolean | null;
  sizeAccuracy: string | null;
  notes: string | null;
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
  isPrivate: boolean;
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

function mapAmenities(value: unknown): string[] {
  return mapKeyPoints(value);
}

function mapMarketingSections(
  value: unknown,
): CommercialListing['marketingSections'] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set([
    'promo',
    'specifications',
    'viewings',
    'terms',
    'custom',
  ]);
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const kind = String(row.kind ?? '');
      if (!allowed.has(kind)) return null;
      const title = String(row.title ?? '').trim();
      const body = String(row.body ?? '');
      const id = String(row.id ?? '').trim() || randomBytes(8).toString('hex');
      if (!title) return null;
      return {
        id,
        kind: kind as CommercialListing['marketingSections'][number]['kind'],
        title,
        body,
      };
    })
    .filter((item): item is CommercialListing['marketingSections'][number] =>
      Boolean(item),
    );
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
    isInstructed: row.is_instructed !== false,
    termsOfEngagement:
      (row.terms_of_engagement as 'yes' | 'no' | 'pending' | null) ?? null,
    restrictAccessToAssigned: Boolean(row.restrict_access_to_assigned),
    hideLandlordFromMarketing: Boolean(row.hide_landlord_from_marketing),
    commercialPropertyId: (row.commercial_property_id as string | null) ?? null,
    referenceNumber: (row.reference_number as string | null) ?? null,
    projectCode: (row.project_code as string | null) ?? null,
    accountBranchId: (row.account_branch_id as string | null) ?? null,
    averageFloorPlateSqft: num(row.average_floor_plate_sqft),
    sizeBreakdown: (row.size_breakdown as string | null) ?? null,
    controlledBy: (row.controlled_by as string | null) ?? null,
    sizeAccuracy: (row.size_accuracy as string | null) ?? null,
    termsInternal: (row.terms_internal as string | null) ?? null,
    breeamRating: (row.breeam_rating as string | null) ?? null,
    conditionDescription: (row.condition_description as string | null) ?? null,
    status: (row.status as ListingStatus) ?? 'draft',
    askingRentPence: num(row.asking_rent_pence),
    askingRentToPence: num(row.asking_rent_to_pence),
    askingPricePence: num(row.asking_price_pence),
    rentFrequency: (row.rent_frequency as string | null) ?? null,
    hideRentFromMarketing: Boolean(row.hide_rent_from_marketing),
    hidePriceFromMarketing: Boolean(row.hide_price_from_marketing),
    serviceChargePerSqft: num(row.service_charge_per_sqft),
    ratesPayablePerSqft: num(row.rates_payable_per_sqft),
    estateChargePerSqft: num(row.estate_charge_per_sqft),
    sizeMinSqft: num(row.size_min_sqft),
    sizeMaxSqft: num(row.size_max_sqft),
    measurementStandard: (row.measurement_standard as string | null) ?? null,
    useClass: (row.use_class as string | null) ?? null,
    availableFrom: (row.available_from as string | null) ?? null,
    letType: (row.let_type as ListingLetType | null) ?? null,
    letContractLengthMonths: num(row.let_contract_length_months),
    epcBand: (row.epc_band as string | null) ?? null,
    epcRating: num(row.epc_rating),
    possession: (row.possession as string | null) ?? null,
    buildStatus: (row.build_status as string | null) ?? null,
    planningStatus: (row.planning_status as string | null) ?? null,
    fittedSpace: row.fitted_space == null ? null : Boolean(row.fitted_space),
    landSizeMin: num(row.land_size_min),
    landSizeMax: num(row.land_size_max),
    landSizeMetric: (row.land_size_metric as string | null) ?? null,
    insuranceType: (row.insurance_type as string | null) ?? null,
    streetViewPanoId: (row.street_view_pano_id as string | null) ?? null,
    streetViewHeading: num(row.street_view_heading),
    streetViewPitch: num(row.street_view_pitch),
    streetViewZoom: num(row.street_view_zoom),
    summary: (row.summary as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    locationCopy: (row.location_copy as string | null) ?? null,
    keyPoints: mapKeyPoints(row.key_points),
    amenities: mapAmenities(row.amenities),
    parkingAvailable: Boolean(row.parking_available),
    parkingSpaces: num(row.parking_spaces),
    marketingSections: mapMarketingSections(row.marketing_sections),
    websiteUrl: (row.website_url as string | null) ?? null,
    onMarketAt: (row.on_market_at as string | null) ?? null,
    offMarketAt: (row.off_market_at as string | null) ?? null,
    landlordShareToken: (row.landlord_share_token as string | null) ?? null,
    landlordShareEnabled: Boolean(row.landlord_share_enabled),
    brochureShareToken: (row.brochure_share_token as string | null) ?? null,
    brochureShareEnabled: Boolean(row.brochure_share_enabled),
    autoCirculateMatches: Boolean(row.auto_circulate_matches),
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
    description: (row.description as string | null) ?? null,
    partFloor: Boolean(row.part_floor),
    sector: (row.sector as string | null) ?? null,
    tenure: (row.tenure as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    sizeSqft: num(row.size_sqft),
    measurementStandard: (row.measurement_standard as string | null) ?? null,
    askingRentPence: num(row.asking_rent_pence),
    rentPerSqft: num(row.rent_per_sqft),
    serviceChargePerSqft: num(row.service_charge_per_sqft),
    ratesPayablePerSqft: num(row.rates_payable_per_sqft),
    estateChargePerSqft: num(row.estate_charge_per_sqft),
    epcBand: (row.epc_band as string | null) ?? null,
    possession: (row.possession as string | null) ?? null,
    buildStatus: (row.build_status as string | null) ?? null,
    planningStatus: (row.planning_status as string | null) ?? null,
    fittedSpace: row.fitted_space == null ? null : Boolean(row.fitted_space),
    sizeAccuracy: (row.size_accuracy as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
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
    isPrivate: Boolean(row.is_private),
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
    ...(input.isInstructed !== undefined && {
      is_instructed: input.isInstructed,
    }),
    ...(input.termsOfEngagement !== undefined && {
      terms_of_engagement: input.termsOfEngagement,
    }),
    ...(input.restrictAccessToAssigned !== undefined && {
      restrict_access_to_assigned: input.restrictAccessToAssigned,
    }),
    ...(input.hideLandlordFromMarketing !== undefined && {
      hide_landlord_from_marketing: input.hideLandlordFromMarketing,
    }),
    ...(input.commercialPropertyId !== undefined && {
      commercial_property_id: input.commercialPropertyId,
    }),
    ...(input.referenceNumber !== undefined && {
      reference_number: input.referenceNumber,
    }),
    ...(input.projectCode !== undefined && {
      project_code: input.projectCode,
    }),
    ...(input.accountBranchId !== undefined && {
      account_branch_id: input.accountBranchId,
    }),
    ...(input.onMarketAt !== undefined && {
      on_market_at: input.onMarketAt,
    }),
    ...(input.offMarketAt !== undefined && {
      off_market_at: input.offMarketAt,
    }),
    ...(input.averageFloorPlateSqft !== undefined && {
      average_floor_plate_sqft: input.averageFloorPlateSqft,
    }),
    ...(input.sizeBreakdown !== undefined && {
      size_breakdown: input.sizeBreakdown,
    }),
    ...(input.controlledBy !== undefined && {
      controlled_by: input.controlledBy,
    }),
    ...(input.sizeAccuracy !== undefined && {
      size_accuracy: input.sizeAccuracy,
    }),
    ...(input.termsInternal !== undefined && {
      terms_internal: input.termsInternal,
    }),
    ...(input.breeamRating !== undefined && {
      breeam_rating: input.breeamRating,
    }),
    ...(input.conditionDescription !== undefined && {
      condition_description: input.conditionDescription,
    }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.askingRentPence !== undefined && {
      asking_rent_pence: input.askingRentPence,
    }),
    ...(input.askingRentToPence !== undefined && {
      asking_rent_to_pence: input.askingRentToPence,
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
    ...(input.hidePriceFromMarketing !== undefined && {
      hide_price_from_marketing: input.hidePriceFromMarketing,
    }),
    ...(input.serviceChargePerSqft !== undefined && {
      service_charge_per_sqft: input.serviceChargePerSqft,
    }),
    ...(input.ratesPayablePerSqft !== undefined && {
      rates_payable_per_sqft: input.ratesPayablePerSqft,
    }),
    ...(input.estateChargePerSqft !== undefined && {
      estate_charge_per_sqft: input.estateChargePerSqft,
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
    ...(input.letType !== undefined && { let_type: input.letType }),
    ...(input.letContractLengthMonths !== undefined && {
      let_contract_length_months: input.letContractLengthMonths,
    }),
    ...(input.epcBand !== undefined && { epc_band: input.epcBand }),
    ...(input.epcRating !== undefined && { epc_rating: input.epcRating }),
    ...(input.possession !== undefined && { possession: input.possession }),
    ...(input.buildStatus !== undefined && {
      build_status: input.buildStatus,
    }),
    ...(input.planningStatus !== undefined && {
      planning_status: input.planningStatus,
    }),
    ...(input.fittedSpace !== undefined && {
      fitted_space: input.fittedSpace,
    }),
    ...(input.landSizeMin !== undefined && {
      land_size_min: input.landSizeMin,
    }),
    ...(input.landSizeMax !== undefined && {
      land_size_max: input.landSizeMax,
    }),
    ...(input.landSizeMetric !== undefined && {
      land_size_metric: input.landSizeMetric,
    }),
    ...(input.insuranceType !== undefined && {
      insurance_type: input.insuranceType,
    }),
    ...(input.streetViewPanoId !== undefined && {
      street_view_pano_id: input.streetViewPanoId,
    }),
    ...(input.streetViewHeading !== undefined && {
      street_view_heading: input.streetViewHeading,
    }),
    ...(input.streetViewPitch !== undefined && {
      street_view_pitch: input.streetViewPitch,
    }),
    ...(input.streetViewZoom !== undefined && {
      street_view_zoom: input.streetViewZoom,
    }),
    ...(input.summary !== undefined && { summary: input.summary }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.locationCopy !== undefined && {
      location_copy: input.locationCopy,
    }),
    ...(input.keyPoints !== undefined && {
      key_points: input.keyPoints ?? [],
    }),
    ...(input.amenities !== undefined && {
      amenities: input.amenities ?? [],
    }),
    ...(input.parkingAvailable !== undefined && {
      parking_available: input.parkingAvailable,
    }),
    ...(input.parkingSpaces !== undefined && {
      parking_spaces: input.parkingSpaces,
    }),
    ...(input.marketingSections !== undefined && {
      marketing_sections: input.marketingSections ?? [],
    }),
    ...(input.websiteUrl !== undefined && {
      website_url: input.websiteUrl?.trim() ? input.websiteUrl.trim() : null,
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
  // External/public cover hosts need no storage round-trip.
  if (!item.storagePath && item.externalUrl) {
    return {
      ...item,
      url: resolveCommercialMediaPublicUrl({
        storageSignedUrl: null,
        externalUrl: item.externalUrl,
      }),
    };
  }

  let storageSignedUrl: string | null = null;
  if (item.storagePath) {
    const { data, error } = await client.storage
      .from('commercial-listing-media')
      .createSignedUrl(item.storagePath, 3600);
    if (error) {
      console.error('[listings] signed media url error:', error.message);
    } else {
      storageSignedUrl = data.signedUrl ?? null;
    }
  }

  const url = resolveCommercialMediaPublicUrl({
    storageSignedUrl,
    externalUrl: item.externalUrl,
  });
  return { ...item, url };
}

async function attachCoverUrls(
  client: SupabaseClient,
  listings: CommercialListing[],
): Promise<CommercialListing[]> {
  if (listings.length === 0) return listings;

  const listingIds = listings.map((l) => l.id);
  const { data: mediaRows, error } = await client
    .from('commercial_listing_media')
    .select(
      'id, listing_id, account_id, media_type, storage_path, external_url, file_name, mime_type, sort_order, is_cover, is_private, created_at',
    )
    .in('listing_id', listingIds)
    .eq('is_private', false)
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

async function attachCoAgents(
  client: SupabaseClient,
  accountId: string,
  listings: CommercialListing[],
): Promise<CommercialListing[]> {
  if (listings.length === 0) return listings;

  const listingIds = listings.map((l) => l.id);
  const { data: rows, error } = await fromTable(
    client,
    'commercial_listing_co_agents',
  )
    .select(
      'id, listing_id, client_id, contact_name, contact_email, contact_phone, external_id, sort_order, clients(display_name, company_name, first_name, last_name)',
    )
    .eq('account_id', accountId)
    .in('listing_id', listingIds)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[listings] attachCoAgents:', error.message);
    return listings.map((listing) => ({ ...listing, coAgents: [] }));
  }

  const byListing = new Map<string, ListingCoAgent[]>();
  for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
    const clientRow = row.clients as Record<string, unknown> | null;
    const clientName =
      (clientRow?.display_name as string | null)?.trim() ||
      (clientRow?.company_name as string | null)?.trim() ||
      [clientRow?.first_name, clientRow?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      'Co-marketing agent';
    const list = byListing.get(row.listing_id as string) ?? [];
    list.push({
      id: row.id as string,
      listingId: row.listing_id as string,
      clientId: row.client_id as string,
      clientName,
      contactName: (row.contact_name as string | null) ?? null,
      contactEmail: (row.contact_email as string | null) ?? null,
      contactPhone: (row.contact_phone as string | null) ?? null,
      externalId: (row.external_id as string | null) ?? null,
      sortOrder: Number(row.sort_order ?? list.length),
    });
    byListing.set(row.listing_id as string, list);
  }

  return listings.map((listing) => ({
    ...listing,
    coAgents: byListing.get(listing.id) ?? [],
  }));
}

async function attachMatchCounts(
  client: SupabaseClient,
  accountId: string,
  listings: CommercialListing[],
  options?: { includeSuggestions?: boolean },
): Promise<CommercialListing[]> {
  if (listings.length === 0) return listings;

  const listingIds = listings.map((l) => l.id);
  const includeSuggestions = options?.includeSuggestions === true;

  const [{ data, error }, suggestedByListing] = await Promise.all([
    client
      .from('commercial_matches')
      .select('listing_id')
      .eq('account_id', accountId)
      .in('listing_id', listingIds),
    includeSuggestions
      ? createMatchSuggestionsService(client).countSuggestionsByListingIds({
          accountId,
          listingIds,
        })
      : Promise.resolve(new Map<string, number>()),
  ]);

  if (error) {
    console.error('[listings] attachMatchCounts:', error.message);
  }

  const linkedCounts = new Map<string, number>();
  for (const row of data ?? []) {
    const listingId = row.listing_id as string;
    linkedCounts.set(listingId, (linkedCounts.get(listingId) ?? 0) + 1);
  }

  return listings.map((listing) => {
    const linked = error ? 0 : (linkedCounts.get(listing.id) ?? 0);
    const suggested = suggestedByListing.get(listing.id) ?? 0;
    return {
      ...listing,
      matchCount: linked + suggested,
    };
  });
}

/** Merge parallel attach results that share the same listing order. */
function mergeListingEnrichment(
  base: CommercialListing[],
  covers: CommercialListing[],
  agents: CommercialListing[],
  coAgents: CommercialListing[],
): CommercialListing[] {
  return base.map((listing, index) => ({
    ...listing,
    coverUrl: covers[index]?.coverUrl ?? null,
    actingAgents: agents[index]?.actingAgents ?? [],
    coAgents: coAgents[index]?.coAgents ?? [],
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
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[listings] listListings error:', error.message);
        return [];
      }

      const listings = ((data ?? []) as ListingRow[]).map(mapListing);
      const [covers, agents, coAgents] = await Promise.all([
        attachCoverUrls(client, listings),
        attachActingAgents(client, accountId, listings),
        attachCoAgents(client, accountId, listings),
      ]);
      const enriched = mergeListingEnrichment(
        listings,
        covers,
        agents,
        coAgents,
      );
      return attachMatchCounts(client, accountId, enriched, {
        includeSuggestions: true,
      });
    },

    async listListingsPage(input: {
      accountId: string;
      status?: ListingStatus;
      statuses?: ListingStatus[];
      search?: string | null;
      accountBranchId?: string | null;
      actingAgentUserId?: string | null;
      page?: number;
      pageSize?: number;
      /** Suggested fits are expensive; default off for list/SSR. */
      includeSuggestedMatches?: boolean;
    }): Promise<{ data: CommercialListing[]; total: number }> {
      const page = Math.max(1, input.page ?? 1);
      const pageSize = Math.min(500, Math.max(1, input.pageSize ?? 20));
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = client
        .from('commercial_listings')
        .select('*', { count: 'exact' })
        .eq('account_id', input.accountId)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (input.statuses && input.statuses.length > 0) {
        query = query.in('status', input.statuses);
      } else if (input.status) {
        query = query.eq('status', input.status);
      }

      if (input.actingAgentUserId) {
        const { data: agentRows, error: agentError } = await fromTable(
          client,
          'commercial_listing_agents',
        )
          .select('listing_id')
          .eq('account_id', input.accountId)
          .eq('user_id', input.actingAgentUserId);

        if (agentError) {
          console.error(
            '[listings] listListingsPage agent filter:',
            agentError.message,
          );
          return { data: [], total: 0 };
        }

        const listingIds = [
          ...new Set(
            ((agentRows ?? []) as Array<{ listing_id: string }>).map(
              (row) => row.listing_id,
            ),
          ),
        ];
        if (listingIds.length === 0) {
          return { data: [], total: 0 };
        }
        query = query.in('id', listingIds);
      }

      if (input.accountBranchId) {
        const { data: branch, error: branchError } = await client
          .from('account_branches')
          .select('id')
          .eq('id', input.accountBranchId)
          .eq('account_id', input.accountId)
          .maybeSingle();

        if (branchError) {
          console.error(
            '[listings] listListingsPage branch check:',
            branchError.message,
          );
          return { data: [], total: 0 };
        }

        if (!branch) {
          return { data: [], total: 0 };
        }

        query = query.eq('account_branch_id', input.accountBranchId);
      }

      const search = input.search?.trim();
      if (search) {
        const likePattern = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
        // Quote for PostgREST so spaces/commas in the term don't break .or().
        const quotedLike = `"${likePattern.replace(/"/g, '')}"`;
        query = query.or(
          [
            `name.ilike.${quotedLike}`,
            `address_line_1.ilike.${quotedLike}`,
            `address_line_2.ilike.${quotedLike}`,
            `town.ilike.${quotedLike}`,
            `postcode.ilike.${quotedLike}`,
            `county.ilike.${quotedLike}`,
            `sector.ilike.${quotedLike}`,
            `external_id.ilike.${quotedLike}`,
          ].join(','),
        );
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('[listings] listListingsPage error:', error.message);
        return { data: [], total: 0 };
      }

      const listings = ((data ?? []) as ListingRow[]).map(mapListing);
      const [covers, agents, coAgents] = await Promise.all([
        attachCoverUrls(client, listings),
        attachActingAgents(client, input.accountId, listings),
        attachCoAgents(client, input.accountId, listings),
      ]);
      const merged = mergeListingEnrichment(listings, covers, agents, coAgents);
      const enriched = await attachMatchCounts(
        client,
        input.accountId,
        merged,
        {
          includeSuggestions: input.includeSuggestedMatches === true,
        },
      );
      return { data: enriched, total: count ?? 0 };
    },

    async countSuggestedMatchesByListingIds(input: {
      accountId: string;
      listingIds: string[];
    }): Promise<Record<string, number>> {
      if (input.listingIds.length === 0) return {};
      const counts = await createMatchSuggestionsService(
        client,
      ).countSuggestionsByListingIds({
        accountId: input.accountId,
        listingIds: input.listingIds,
      });
      return Object.fromEntries(counts.entries());
    },

    async countUnassignedListings(input: {
      accountId: string;
      status?: ListingStatus;
      statuses?: ListingStatus[];
    }): Promise<number> {
      let query = client
        .from('commercial_listings')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', input.accountId)
        .is('account_branch_id', null);

      if (input.statuses && input.statuses.length > 0) {
        query = query.in('status', input.statuses);
      } else if (input.status) {
        query = query.eq('status', input.status);
      }

      const { count, error } = await query;

      if (error) {
        console.error(
          '[listings] countUnassignedListings error:',
          error.message,
        );
        return 0;
      }

      return count ?? 0;
    },

    async listCompletedDisposals(
      accountId: string,
    ): Promise<CommercialListing[]> {
      const { data, error } = await client
        .from('commercial_listings')
        .select('*')
        .eq('account_id', accountId)
        .in('status', ['sold', 'let'])
        .order('updated_at', { ascending: false });

      if (error) {
        console.error(
          '[listings] listCompletedDisposals error:',
          error.message,
        );
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
      const mapped = mapListing(data as ListingRow);
      const [covers, agents] = await Promise.all([
        attachCoverUrls(client, [mapped]),
        attachActingAgents(client, accountId, [mapped]),
      ]);
      const merged = mergeListingEnrichment([mapped], covers, agents, [mapped]);
      const [enriched] = await attachMatchCounts(client, accountId, merged, {
        includeSuggestions: true,
      });
      return enriched ?? mapped;
    },

    async createListing(
      input: CreateListingInput & { createdBy?: string | null },
    ): Promise<CommercialListing> {
      let latitude = input.latitude ?? null;
      let longitude = input.longitude ?? null;
      if (latitude == null || longitude == null) {
        const geo = await geocodeListingAddress({
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          town: input.town,
          county: input.county,
          postcode: input.postcode,
          country: input.country,
        });
        if (geo) {
          latitude = geo.latitude;
          longitude = geo.longitude;
        }
      }

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
          latitude,
          longitude,
          sector: input.sector ?? null,
          tenure: input.tenure ?? null,
          disposal_type: input.disposalType ?? 'to_let',
          instruction_nature: input.instructionNature ?? 'exclusive',
          status: input.status ?? 'draft',
          asking_rent_pence: input.askingRentPence ?? null,
          asking_rent_to_pence: input.askingRentToPence ?? null,
          asking_price_pence: input.askingPricePence ?? null,
          rent_frequency: input.rentFrequency ?? 'per_annum',
          hide_rent_from_marketing: input.hideRentFromMarketing ?? false,
          hide_price_from_marketing: input.hidePriceFromMarketing ?? false,
          service_charge_per_sqft: input.serviceChargePerSqft ?? null,
          rates_payable_per_sqft: input.ratesPayablePerSqft ?? null,
          estate_charge_per_sqft: input.estateChargePerSqft ?? null,
          size_min_sqft: input.sizeMinSqft ?? null,
          size_max_sqft: input.sizeMaxSqft ?? null,
          measurement_standard: input.measurementStandard ?? 'gia',
          use_class: input.useClass ?? null,
          available_from: input.availableFrom ?? null,
          let_type: input.letType ?? null,
          let_contract_length_months: input.letContractLengthMonths ?? null,
          epc_band: input.epcBand ?? null,
          epc_rating: input.epcRating ?? null,
          possession: input.possession ?? null,
          build_status: input.buildStatus ?? null,
          planning_status: input.planningStatus ?? null,
          fitted_space: input.fittedSpace ?? null,
          land_size_min: input.landSizeMin ?? null,
          land_size_max: input.landSizeMax ?? null,
          land_size_metric: input.landSizeMetric ?? null,
          insurance_type: input.insuranceType ?? null,
          street_view_pano_id: input.streetViewPanoId ?? null,
          street_view_heading: input.streetViewHeading ?? null,
          street_view_pitch: input.streetViewPitch ?? null,
          street_view_zoom: input.streetViewZoom ?? null,
          summary: input.summary ?? null,
          description: input.description ?? null,
          location_copy: input.locationCopy ?? null,
          key_points: input.keyPoints ?? [],
          amenities: input.amenities ?? [],
          parking_available: input.parkingAvailable ?? false,
          parking_spaces: input.parkingSpaces ?? null,
          marketing_sections: input.marketingSections ?? [],
          website_url: input.websiteUrl?.trim()
            ? input.websiteUrl.trim()
            : null,
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
      try {
        await recordListingEvent(client, {
          accountId: input.accountId,
          listingId: listing.id,
          actorUserId: input.createdBy ?? null,
          eventType: 'listing_created',
          summary: `Listing created (${listing.status})`,
          metadata: { status: listing.status },
        });
      } catch {
        /* best-effort */
      }
      return listing;
    },

    async updateListing(
      listingId: string,
      accountId: string,
      input: Omit<UpdateListingInput, 'listingId' | 'accountId'>,
      options?: {
        actorUserId?: string | null;
        statusEventType?: ListingEventType;
        statusSummary?: string;
      },
    ): Promise<CommercialListing> {
      const existing = await this.getListing(listingId, accountId);
      if (!existing) {
        throw new Error('Listing not found');
      }

      const patch = writeColumns(input);

      if (input.status === 'marketing') {
        if (!existing.onMarketAt) {
          Object.assign(patch, { on_market_at: new Date().toISOString() });
        }
      }

      if (
        input.status === 'let' ||
        input.status === 'sold' ||
        input.status === 'withdrawn'
      ) {
        if (!existing.offMarketAt) {
          Object.assign(patch, { off_market_at: new Date().toISOString() });
        }
      }

      const addressChanged =
        (input.addressLine1 !== undefined &&
          input.addressLine1 !== existing.addressLine1) ||
        (input.addressLine2 !== undefined &&
          input.addressLine2 !== existing.addressLine2) ||
        (input.town !== undefined && input.town !== existing.town) ||
        (input.county !== undefined && input.county !== existing.county) ||
        (input.postcode !== undefined &&
          input.postcode !== existing.postcode) ||
        (input.country !== undefined && input.country !== existing.country);

      const coordsProvided =
        input.latitude !== undefined || input.longitude !== undefined;
      const missingCoords = coordsProvided
        ? (input.latitude ?? existing.latitude) == null ||
          (input.longitude ?? existing.longitude) == null
        : existing.latitude == null || existing.longitude == null;

      if (!coordsProvided && (addressChanged || missingCoords)) {
        const geo = await geocodeListingAddress({
          addressLine1:
            input.addressLine1 !== undefined
              ? input.addressLine1
              : existing.addressLine1,
          addressLine2:
            input.addressLine2 !== undefined
              ? input.addressLine2
              : existing.addressLine2,
          town: input.town !== undefined ? input.town : existing.town,
          county: input.county !== undefined ? input.county : existing.county,
          postcode:
            input.postcode !== undefined ? input.postcode : existing.postcode,
          country:
            input.country !== undefined ? input.country : existing.country,
        });
        if (geo) {
          Object.assign(patch, {
            latitude: geo.latitude,
            longitude: geo.longitude,
          });
        }
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
      if (input.status && input.status !== existing.status) {
        try {
          await recordListingEvent(client, {
            accountId,
            listingId,
            actorUserId: options?.actorUserId ?? null,
            eventType: options?.statusEventType ?? 'status_changed',
            summary:
              options?.statusSummary ??
              `Status ${existing.status} → ${input.status}`,
            metadata: {
              previousStatus: existing.status,
              status: input.status,
              name: existing.name,
            },
          });
        } catch {
          /* best-effort */
        }
      }
      return listing;
    },

    async backfillListingLocations(
      accountId: string,
      opts?: { limit?: number },
    ): Promise<{ attempted: number; updated: number }> {
      const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
      const { data, error } = await client
        .from('commercial_listings')
        .select('*')
        .eq('account_id', accountId)
        .or('latitude.is.null,longitude.is.null')
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? []) as ListingRow[];
      let updated = 0;

      for (const row of rows) {
        const listing = mapListing(row);
        const geo = await geocodeListingAddress({
          addressLine1: listing.addressLine1,
          addressLine2: listing.addressLine2,
          town: listing.town,
          county: listing.county,
          postcode: listing.postcode,
          country: listing.country,
        });
        if (!geo) continue;

        const { error: updateError } = await client
          .from('commercial_listings')
          .update({
            latitude: geo.latitude,
            longitude: geo.longitude,
          })
          .eq('id', listing.id)
          .eq('account_id', accountId);

        if (!updateError) updated += 1;
        // Soft rate-limit Mapbox forward geocoding.
        await new Promise((r) => setTimeout(r, 120));
      }

      return { attempted: rows.length, updated };
    },

    async deleteListing(
      listingId: string,
      accountId: string,
      options?: { actorUserId?: string | null },
    ): Promise<void> {
      const existing = await this.getListing(listingId, accountId);
      if (!existing) {
        throw new Error('Listing not found');
      }

      // Audit before delete — listing_events cascade away with the row;
      // account audit feed keeps the record via dual-write.
      try {
        await recordListingEvent(client, {
          accountId,
          listingId,
          actorUserId: options?.actorUserId ?? null,
          eventType: 'listing_deleted',
          summary: `Deleted “${existing.name}”`,
          metadata: {
            name: existing.name,
            previousStatus: existing.status,
          },
        });
      } catch {
        /* best-effort */
      }

      const { error } = await client
        .from('commercial_listings')
        .delete()
        .eq('id', listingId)
        .eq('account_id', accountId);

      if (error) {
        console.error(
          '[listings] delete failed after audit write:',
          error.message,
          { listingId, accountId },
        );
        throw new Error(error.message);
      }
    },

    /**
     * Clone a disposal into a new draft (copy core fields, units, and media).
     * Does not copy portal publications, share tokens, or interest.
     */
    async duplicateListing(input: {
      listingId: string;
      accountId: string;
      accountSlug: string;
      createdBy?: string | null;
    }): Promise<CommercialListing> {
      const source = await this.getListing(input.listingId, input.accountId);
      if (!source) {
        throw new Error('Listing not found');
      }

      const copyName = source.name.trim().endsWith('(copy)')
        ? `${source.name.trim()} 2`
        : `${source.name.trim()} (copy)`;

      const created = await this.createListing({
        accountId: input.accountId,
        name: copyName,
        addressLine1: source.addressLine1,
        addressLine2: source.addressLine2,
        town: source.town,
        postcode: source.postcode,
        country: source.country,
        county: source.county,
        latitude: source.latitude,
        longitude: source.longitude,
        sector: source.sector,
        tenure: source.tenure,
        disposalType: source.disposalType,
        instructionNature: source.instructionNature,
        isInstructed: false,
        termsOfEngagement: source.termsOfEngagement,
        restrictAccessToAssigned: source.restrictAccessToAssigned,
        hideLandlordFromMarketing: source.hideLandlordFromMarketing,
        referenceNumber: null,
        projectCode: source.projectCode,
        accountBranchId: source.accountBranchId,
        averageFloorPlateSqft: source.averageFloorPlateSqft,
        sizeBreakdown:
          source.sizeBreakdown as CreateListingInput['sizeBreakdown'],
        controlledBy: source.controlledBy as CreateListingInput['controlledBy'],
        sizeAccuracy: source.sizeAccuracy as CreateListingInput['sizeAccuracy'],
        termsInternal: source.termsInternal,
        breeamRating: source.breeamRating as CreateListingInput['breeamRating'],
        conditionDescription: source.conditionDescription,
        status: 'draft',
        askingRentPence: source.askingRentPence,
        askingRentToPence: source.askingRentToPence,
        askingPricePence: source.askingPricePence,
        rentFrequency: source.rentFrequency,
        hideRentFromMarketing: source.hideRentFromMarketing,
        hidePriceFromMarketing: source.hidePriceFromMarketing,
        serviceChargePerSqft: source.serviceChargePerSqft,
        ratesPayablePerSqft: source.ratesPayablePerSqft,
        estateChargePerSqft: source.estateChargePerSqft,
        sizeMinSqft: source.sizeMinSqft,
        sizeMaxSqft: source.sizeMaxSqft,
        measurementStandard: source.measurementStandard,
        useClass: source.useClass,
        availableFrom: source.availableFrom,
        letType: source.letType,
        letContractLengthMonths: source.letContractLengthMonths,
        epcBand: source.epcBand,
        epcRating: source.epcRating,
        possession: source.possession,
        buildStatus: source.buildStatus,
        planningStatus: source.planningStatus,
        fittedSpace: source.fittedSpace,
        landSizeMin: source.landSizeMin,
        landSizeMax: source.landSizeMax,
        landSizeMetric:
          source.landSizeMetric as CreateListingInput['landSizeMetric'],
        insuranceType: source.insuranceType,
        streetViewPanoId: source.streetViewPanoId,
        streetViewHeading: source.streetViewHeading,
        streetViewPitch: source.streetViewPitch,
        streetViewZoom: source.streetViewZoom,
        summary: source.summary,
        description: source.description,
        locationCopy: source.locationCopy,
        keyPoints: source.keyPoints,
        amenities: source.amenities,
        parkingAvailable: source.parkingAvailable,
        parkingSpaces: source.parkingSpaces,
        marketingSections: source.marketingSections,
        websiteUrl: null,
        notes: source.notes,
        externalId: null,
        instructingClientId: source.instructingClientId,
        createdBy: input.createdBy ?? null,
      });

      const [units, media, assignment] = await Promise.all([
        this.listUnits(source.id, { accountId: input.accountId }),
        this.listMedia(source.id, {
          privacy: 'all',
          accountId: input.accountId,
        }),
        this.getListingAssignment(
          source.id,
          input.accountId,
          input.accountSlug,
        ),
      ]);

      for (const unit of units) {
        await this.createUnit({
          accountId: input.accountId,
          listingId: created.id,
          label: unit.label,
          floorOrUnit: unit.floorOrUnit,
          description: unit.description,
          partFloor: unit.partFloor,
          sector: unit.sector,
          tenure: unit.tenure,
          status: unit.status,
          sizeSqft: unit.sizeSqft,
          measurementStandard: unit.measurementStandard,
          askingRentPence: unit.askingRentPence,
          rentPerSqft: unit.rentPerSqft,
          serviceChargePerSqft: unit.serviceChargePerSqft,
          ratesPayablePerSqft: unit.ratesPayablePerSqft,
          estateChargePerSqft: unit.estateChargePerSqft,
          epcBand: unit.epcBand,
          possession: unit.possession,
          buildStatus: unit.buildStatus,
          planningStatus: unit.planningStatus,
          fittedSpace: unit.fittedSpace,
          sizeAccuracy:
            unit.sizeAccuracy as CreateListingUnitInput['sizeAccuracy'],
          notes: unit.notes,
          sortOrder: unit.sortOrder,
          externalId: null,
        });
      }

      for (const item of media) {
        if (!item.storagePath && !item.externalUrl) continue;
        await this.createMedia({
          accountId: input.accountId,
          listingId: created.id,
          mediaType: item.mediaType as CreateListingMediaInput['mediaType'],
          storagePath: item.storagePath,
          externalUrl: item.externalUrl,
          fileName: item.fileName,
          mimeType: item.mimeType,
          sortOrder: item.sortOrder,
          isCover: item.isCover,
          isPrivate: item.isPrivate,
        });
      }

      if (
        assignment.actingAgents.length > 0 ||
        assignment.paUserId ||
        assignment.recordOwnerUserId ||
        assignment.teamId ||
        assignment.accountBranchId
      ) {
        await this.updateListingAssignment({
          listingId: created.id,
          accountId: input.accountId,
          accountSlug: input.accountSlug,
          actingAgentUserIds: assignment.actingAgents.map(
            (agent) => agent.userId,
          ),
          paUserId: assignment.paUserId,
          recordOwnerUserId: assignment.recordOwnerUserId,
          teamId: assignment.teamId,
          accountBranchId: assignment.accountBranchId,
          restrictAccessToAssigned: assignment.restrictAccessToAssigned,
        });
      }

      try {
        await recordListingEvent(client, {
          accountId: input.accountId,
          listingId: created.id,
          actorUserId: input.createdBy ?? null,
          eventType: 'listing_created',
          summary: `Duplicated from ${source.name}`,
          metadata: { sourceListingId: source.id },
        });
      } catch {
        /* best-effort */
      }

      return (await this.getListing(created.id, input.accountId)) ?? created;
    },

    async archiveListing(input: {
      listingId: string;
      accountId: string;
      actorUserId?: string | null;
    }): Promise<CommercialListing> {
      const existing = await this.getListing(input.listingId, input.accountId);
      if (!existing) {
        throw new Error('Listing not found');
      }
      if (existing.status === 'withdrawn') {
        return existing;
      }
      return this.updateListing(
        input.listingId,
        input.accountId,
        { status: 'withdrawn' },
        {
          actorUserId: input.actorUserId ?? null,
          statusEventType: 'listing_archived',
          statusSummary: `Archived “${existing.name}”`,
        },
      );
    },

    async listUnits(
      listingId: string,
      options?: { accountId?: string },
    ): Promise<CommercialListingUnit[]> {
      let query = client
        .from('commercial_listing_units')
        .select('*')
        .eq('listing_id', listingId)
        .order('sort_order');

      if (options?.accountId) {
        query = query.eq('account_id', options.accountId);
      }

      const { data, error } = await query;

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
          description: input.description ?? null,
          part_floor: input.partFloor ?? false,
          sector: input.sector ?? null,
          tenure: input.tenure ?? null,
          status: input.status ?? null,
          size_sqft: input.sizeSqft ?? null,
          measurement_standard: input.measurementStandard ?? 'gia',
          asking_rent_pence: input.askingRentPence ?? null,
          rent_per_sqft: input.rentPerSqft ?? null,
          service_charge_per_sqft: input.serviceChargePerSqft ?? null,
          rates_payable_per_sqft: input.ratesPayablePerSqft ?? null,
          estate_charge_per_sqft: input.estateChargePerSqft ?? null,
          epc_band: input.epcBand ?? null,
          possession: input.possession ?? null,
          build_status: input.buildStatus ?? null,
          planning_status: input.planningStatus ?? null,
          fitted_space: input.fittedSpace ?? null,
          size_accuracy: input.sizeAccuracy ?? null,
          notes: input.notes ?? null,
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
      input: Omit<UpdateListingUnitInput, 'unitId' | 'accountId'>,
    ): Promise<CommercialListingUnit> {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.label !== undefined) patch.label = input.label;
      if (input.floorOrUnit !== undefined)
        patch.floor_or_unit = input.floorOrUnit;
      if (input.description !== undefined)
        patch.description = input.description;
      if (input.partFloor !== undefined) patch.part_floor = input.partFloor;
      if (input.sector !== undefined) patch.sector = input.sector;
      if (input.tenure !== undefined) patch.tenure = input.tenure;
      if (input.status !== undefined) patch.status = input.status;
      if (input.sizeSqft !== undefined) patch.size_sqft = input.sizeSqft;
      if (input.measurementStandard !== undefined) {
        patch.measurement_standard = input.measurementStandard;
      }
      if (input.askingRentPence !== undefined) {
        patch.asking_rent_pence = input.askingRentPence;
      }
      if (input.rentPerSqft !== undefined)
        patch.rent_per_sqft = input.rentPerSqft;
      if (input.serviceChargePerSqft !== undefined) {
        patch.service_charge_per_sqft = input.serviceChargePerSqft;
      }
      if (input.ratesPayablePerSqft !== undefined) {
        patch.rates_payable_per_sqft = input.ratesPayablePerSqft;
      }
      if (input.estateChargePerSqft !== undefined) {
        patch.estate_charge_per_sqft = input.estateChargePerSqft;
      }
      if (input.epcBand !== undefined) patch.epc_band = input.epcBand;
      if (input.possession !== undefined) patch.possession = input.possession;
      if (input.buildStatus !== undefined) {
        patch.build_status = input.buildStatus;
      }
      if (input.planningStatus !== undefined) {
        patch.planning_status = input.planningStatus;
      }
      if (input.fittedSpace !== undefined) {
        patch.fitted_space = input.fittedSpace;
      }
      if (input.sizeAccuracy !== undefined) {
        patch.size_accuracy = input.sizeAccuracy;
      }
      if (input.notes !== undefined) patch.notes = input.notes;
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

    async listMedia(
      listingId: string,
      options?: {
        privacy?: 'public' | 'private' | 'all';
        accountId?: string;
      },
    ): Promise<CommercialListingMedia[]> {
      let query = client
        .from('commercial_listing_media')
        .select('*')
        .eq('listing_id', listingId)
        .order('sort_order')
        .order('created_at');

      if (options?.accountId) {
        query = query.eq('account_id', options.accountId);
      }

      const privacy = options?.privacy ?? 'public';
      if (privacy === 'public') {
        query = query.eq('is_private', false);
      } else if (privacy === 'private') {
        query = query.eq('is_private', true);
      }

      const { data, error } = await query;

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
      const isPrivate = Boolean(input.isPrivate);
      const isImage =
        mediaType === 'image' || Boolean(input.mimeType?.startsWith('image/'));

      let isCover = Boolean(input.isCover) && !isPrivate;
      if (isImage && !isCover && !isPrivate) {
        const { count } = await client
          .from('commercial_listing_media')
          .select('id', { count: 'exact', head: true })
          .eq('listing_id', input.listingId)
          .eq('is_cover', true)
          .eq('is_private', false);
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
          is_private: isPrivate,
        })
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create media');
      }

      const media = mapMedia(data as MediaRow);
      try {
        await recordListingEvent(client, {
          accountId: input.accountId,
          listingId: input.listingId,
          eventType: 'media_changed',
          summary: `Media added (${media.mediaType})`,
          metadata: {
            mediaId: media.id,
            mediaType: media.mediaType,
            isCover: media.isCover,
          },
        });
      } catch {
        /* best-effort */
      }
      return media;
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

    async updateMedia(input: {
      mediaId: string;
      listingId: string;
      accountId: string;
      fileName?: string;
      storagePath?: string;
      mimeType?: string | null;
      mediaType?: MediaType;
    }): Promise<CommercialListingMedia> {
      const { data: existing, error: fetchError } = await client
        .from('commercial_listing_media')
        .select('storage_path')
        .eq('id', input.mediaId)
        .eq('listing_id', input.listingId)
        .eq('account_id', input.accountId)
        .maybeSingle();

      if (fetchError) throw new Error(fetchError.message);
      if (!existing) throw new Error('Media not found');

      const previousPath = (existing as { storage_path?: string | null } | null)
        ?.storage_path;

      const patch: Record<string, unknown> = {};
      if (input.fileName !== undefined) {
        patch.file_name = input.fileName.trim() || null;
      }
      if (input.storagePath !== undefined) {
        patch.storage_path = input.storagePath;
        patch.external_url = null;
      }
      if (input.mimeType !== undefined) {
        patch.mime_type = input.mimeType;
      }
      if (input.mediaType !== undefined) {
        patch.media_type = input.mediaType;
      }

      const { data, error } = await client
        .from('commercial_listing_media')
        .update(patch)
        .eq('id', input.mediaId)
        .eq('listing_id', input.listingId)
        .eq('account_id', input.accountId)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update media');
      }

      if (
        input.storagePath &&
        previousPath &&
        previousPath !== input.storagePath
      ) {
        const { error: storageError } = await client.storage
          .from('commercial-listing-media')
          .remove([previousPath]);
        if (storageError) {
          console.error(
            '[listings] updateMedia storage cleanup:',
            storageError.message,
          );
        }
      }

      return mapMedia(data as MediaRow);
    },

    async deleteMedia(
      mediaId: string,
      accountId: string,
      listingId?: string,
    ): Promise<void> {
      let fetchQuery = client
        .from('commercial_listing_media')
        .select('storage_path')
        .eq('id', mediaId)
        .eq('account_id', accountId);

      if (listingId) {
        fetchQuery = fetchQuery.eq('listing_id', listingId);
      }

      const { data: existing, error: fetchError } =
        await fetchQuery.maybeSingle();

      if (fetchError) throw new Error(fetchError.message);
      if (!existing) throw new Error('Media not found');

      const storagePath = (existing as { storage_path?: string | null } | null)
        ?.storage_path;

      let deleteQuery = client
        .from('commercial_listing_media')
        .delete()
        .eq('id', mediaId)
        .eq('account_id', accountId);

      if (listingId) {
        deleteQuery = deleteQuery.eq('listing_id', listingId);
      }

      const { error } = await deleteQuery;

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

    async getEnquiry(
      enquiryId: string,
      accountId: string,
    ): Promise<CommercialEnquiry | null> {
      const { data, error } = await client
        .from('commercial_enquiries')
        .select('*')
        .eq('id', enquiryId)
        .eq('account_id', accountId)
        .maybeSingle();

      if (error) {
        console.error('[listings] getEnquiry error:', error.message);
        return null;
      }
      if (!data) return null;
      return mapEnquiry(data as EnquiryRow);
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

      // Enquiries stay on Interest; WIP Instructions are landlord mandates —
      // do not dual-write a pipeline_deals row from enquiry intake.
      try {
        await recordListingEvent(client, {
          accountId: input.accountId,
          listingId: input.listingId,
          eventType: 'enquiry_created',
          summary: `Enquiry from ${enquiry.contactName?.trim() || 'Unknown'}`,
          metadata: {
            enquiryId: enquiry.id,
            source: enquiry.source,
            status: enquiry.status,
          },
        });
      } catch {
        /* best-effort */
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
      if (input.requirementId !== undefined) {
        patch.requirement_id = input.requirementId || null;
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

      const enquiry = mapEnquiry(data as EnquiryRow);

      if (enquiry.listingId && enquiry.requirementId) {
        try {
          const { createMatchesService } = await import('./matches.service');
          await createMatchesService(client).ensureMatch({
            accountId,
            listingId: enquiry.listingId,
            requirementId: enquiry.requirementId,
            status: 'new',
            notes: 'Auto-linked from enquiry',
          });
        } catch (err) {
          console.error('[listings] ensureMatch from enquiry failed:', err);
        }
      }

      return enquiry;
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

    async setBrochureShare(input: {
      listingId: string;
      accountId: string;
      enabled: boolean;
    }): Promise<CommercialListing> {
      const existing = await this.getListing(input.listingId, input.accountId);
      if (!existing) {
        throw new Error('Listing not found');
      }

      const token =
        input.enabled && !existing.brochureShareToken
          ? generateShareToken()
          : existing.brochureShareToken;

      const { data, error } = await fromTable(client, 'commercial_listings')
        .update({
          brochure_share_enabled: input.enabled,
          brochure_share_token: token,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.listingId)
        .eq('account_id', input.accountId)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update brochure share');
      }

      return mapListing(data as ListingRow);
    },

    async setAutoCirculateMatches(input: {
      listingId: string;
      accountId: string;
      enabled: boolean;
    }): Promise<CommercialListing> {
      const existing = await this.getListing(input.listingId, input.accountId);
      if (!existing) {
        throw new Error('Listing not found');
      }

      const { data, error } = await fromTable(client, 'commercial_listings')
        .update({
          auto_circulate_matches: input.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.listingId)
        .eq('account_id', input.accountId)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(
          error?.message ?? 'Failed to update auto-circulate setting',
        );
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
      const { data, error } = await fromTable(
        client,
        'commercial_workspace_teams',
      )
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

      const { data: existing } = await fromTable(
        client,
        'commercial_workspace_teams',
      )
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

      const { data, error } = await fromTable(
        client,
        'commercial_workspace_teams',
      )
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

      const { data: agentRows, error: agentError } = await fromTable(
        client,
        'commercial_listing_agents',
      )
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
        const { data: team } = await fromTable(
          client,
          'commercial_workspace_teams',
        )
          .select('name')
          .eq('id', listing.teamId)
          .eq('account_id', accountId)
          .maybeSingle();
        teamName = (team?.name as string | null | undefined)?.trim() || null;
      }

      let accountBranchName: string | null = null;
      if (listing.accountBranchId) {
        const { data: branch } = await fromTable(client, 'account_branches')
          .select('name')
          .eq('id', listing.accountBranchId)
          .eq('account_id', accountId)
          .maybeSingle();
        accountBranchName =
          (branch?.name as string | null | undefined)?.trim() || null;
      }

      return {
        listingId,
        accountId,
        actingAgents,
        paUserId: listing.paUserId,
        recordOwnerUserId: listing.recordOwnerUserId ?? listing.assignedTo,
        teamId: listing.teamId,
        teamName,
        accountBranchId: listing.accountBranchId,
        accountBranchName,
        restrictAccessToAssigned: listing.restrictAccessToAssigned,
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
      accountBranchId?: string | null;
      restrictAccessToAssigned?: boolean;
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
      if (input.accountBranchId !== undefined) {
        if (input.accountBranchId) {
          const { data: branch, error: branchError } = await fromTable(
            client,
            'account_branches',
          )
            .select('id')
            .eq('id', input.accountBranchId)
            .eq('account_id', input.accountId)
            .maybeSingle();
          if (branchError) throw new Error(branchError.message);
          if (!branch) throw new Error('Branch not found for this workspace');
        }
        patch.account_branch_id = input.accountBranchId;
      }
      if (input.restrictAccessToAssigned !== undefined) {
        patch.restrict_access_to_assigned = input.restrictAccessToAssigned;
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

        const { error: deleteError } = await fromTable(
          client,
          'commercial_listing_agents',
        )
          .delete()
          .eq('listing_id', input.listingId)
          .eq('account_id', input.accountId);
        if (deleteError) throw new Error(deleteError.message);

        if (uniqueIds.length > 0) {
          const { error: insertError } = await fromTable(
            client,
            'commercial_listing_agents',
          ).insert(
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

    async listCoAgents(
      listingId: string,
      accountId: string,
    ): Promise<ListingCoAgent[]> {
      const { data: rows, error } = await fromTable(
        client,
        'commercial_listing_co_agents',
      )
        .select(
          'id, listing_id, client_id, contact_name, contact_email, contact_phone, external_id, sort_order, clients(display_name, company_name, first_name, last_name)',
        )
        .eq('listing_id', listingId)
        .eq('account_id', accountId)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('[listings] listCoAgents:', error.message);
        return [];
      }

      return ((rows ?? []) as Array<Record<string, unknown>>).map(
        (row, index) => {
          const clientRow = row.clients as Record<string, unknown> | null;
          const clientName =
            (clientRow?.display_name as string | null)?.trim() ||
            (clientRow?.company_name as string | null)?.trim() ||
            [clientRow?.first_name, clientRow?.last_name]
              .filter(Boolean)
              .join(' ')
              .trim() ||
            'Co-marketing agent';
          return {
            id: row.id as string,
            listingId: row.listing_id as string,
            clientId: row.client_id as string,
            clientName,
            contactName: (row.contact_name as string | null) ?? null,
            contactEmail: (row.contact_email as string | null) ?? null,
            contactPhone: (row.contact_phone as string | null) ?? null,
            externalId: (row.external_id as string | null) ?? null,
            sortOrder: Number(row.sort_order ?? index),
          };
        },
      );
    },

    async searchCoAgentClients(input: {
      accountId: string;
      query?: string;
      excludeListingId?: string;
    }): Promise<CoAgentClientOption[]> {
      let excludeIds: string[] = [];
      if (input.excludeListingId) {
        const { data: linked } = await fromTable(
          client,
          'commercial_listing_co_agents',
        )
          .select('client_id')
          .eq('listing_id', input.excludeListingId)
          .eq('account_id', input.accountId);
        excludeIds = ((linked ?? []) as Array<{ client_id: string }>).map(
          (r) => r.client_id,
        );
      }

      let query = client
        .from('clients')
        .select(
          'id, display_name, company_name, first_name, last_name, email, phone, commercial_role',
        )
        .eq('account_id', input.accountId)
        .is('deleted_at', null)
        .order('display_name', { ascending: true })
        .limit(40);

      const q = input.query?.trim().replace(/[%_,]/g, ' ');
      if (q) {
        query = query.or(
          `display_name.ilike.%${q}%,company_name.ilike.%${q}%,email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const results: CoAgentClientOption[] = (
        (data ?? []) as Array<Record<string, unknown>>
      )
        .filter((row) => !excludeIds.includes(row.id as string))
        .map((row) => {
          const name =
            (row.display_name as string | null)?.trim() ||
            (row.company_name as string | null)?.trim() ||
            [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
            'Contact';
          return {
            id: row.id as string,
            name,
            email: (row.email as string | null) ?? null,
            phone: (row.phone as string | null) ?? null,
            commercialRole: (row.commercial_role as string | null) ?? null,
          };
        });

      if (q && q.length >= 2) {
        const { data: people } = await client
          .from('contacts')
          .select(
            'id, full_name, first_name, last_name, email, phone, client_contacts!inner(client_id, clients!inner(id, display_name, company_name, account_id))',
          )
          .eq('account_id', input.accountId)
          .or(
            `full_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`,
          )
          .limit(20);

        for (const person of (people ?? []) as Array<Record<string, unknown>>) {
          const links = person.client_contacts as unknown as Array<{
            clients:
              | {
                  id: string;
                  display_name: string | null;
                  company_name: string | null;
                  account_id: string;
                }
              | Array<{
                  id: string;
                  display_name: string | null;
                  company_name: string | null;
                  account_id: string;
                }>;
          }>;
          for (const link of links ?? []) {
            const company = Array.isArray(link.clients)
              ? link.clients[0]
              : link.clients;
            if (!company || company.account_id !== input.accountId) continue;
            if (excludeIds.includes(company.id)) continue;
            const personName =
              (person.full_name as string | null)?.trim() ||
              [person.first_name, person.last_name]
                .filter(Boolean)
                .join(' ')
                .trim() ||
              'Person';
            const companyName =
              company.display_name?.trim() ||
              company.company_name?.trim() ||
              'Company';
            results.push({
              id: company.id,
              name: `${personName} @ ${companyName}`,
              email: (person.email as string | null) ?? null,
              phone: (person.phone as string | null) ?? null,
              commercialRole: null,
              contactId: person.id as string,
              contactName: personName,
              subtitle: companyName,
            });
          }
        }
      }

      const seen = new Set<string>();
      return results
        .filter((row) => {
          const key = `${row.id}:${row.contactId ?? ''}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 20);
    },

    async addCoAgent(input: {
      listingId: string;
      accountId: string;
      clientId?: string;
      companyName?: string;
      contactName?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      externalId?: string | null;
    }): Promise<ListingCoAgent[]> {
      const listing = await this.getListing(input.listingId, input.accountId);
      if (!listing) throw new Error('Listing not found');

      let clientId = input.clientId ?? null;
      const contactName = input.contactName?.trim() || null;
      const contactEmail = input.contactEmail?.trim() || null;
      const contactPhone = input.contactPhone?.trim() || null;

      if (!clientId) {
        const companyName = input.companyName?.trim();
        if (!companyName) throw new Error('Company name is required');

        const { data: created, error: createError } = await client
          .from('clients')
          .insert({
            account_id: input.accountId,
            client_type: 'business',
            company_name: companyName,
            display_name: companyName,
            email: contactEmail,
            phone: contactPhone,
            commercial_role: 'agent',
          })
          .select('id')
          .single();

        if (createError || !created) {
          throw new Error(createError?.message ?? 'Failed to create client');
        }
        clientId = created.id as string;
      } else {
        const { data: existing, error: existingError } = await client
          .from('clients')
          .select('id')
          .eq('id', clientId)
          .eq('account_id', input.accountId)
          .is('deleted_at', null)
          .maybeSingle();
        if (existingError) throw new Error(existingError.message);
        if (!existing) throw new Error('Client not found in this workspace');
      }

      const { count } = await fromTable(client, 'commercial_listing_co_agents')
        .select('id', { count: 'exact', head: true })
        .eq('listing_id', input.listingId)
        .eq('account_id', input.accountId);

      const { error: insertError } = await fromTable(
        client,
        'commercial_listing_co_agents',
      ).insert({
        listing_id: input.listingId,
        account_id: input.accountId,
        client_id: clientId,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        external_id: input.externalId ?? null,
        sort_order: count ?? 0,
      });

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('That agent is already linked to this disposal');
        }
        throw new Error(insertError.message);
      }

      if (listing.instructionNature !== 'joint') {
        await client
          .from('commercial_listings')
          .update({
            instruction_nature: 'joint',
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.listingId)
          .eq('account_id', input.accountId);
      }

      return this.listCoAgents(input.listingId, input.accountId);
    },

    async removeCoAgent(input: {
      listingId: string;
      accountId: string;
      coAgentId: string;
    }): Promise<ListingCoAgent[]> {
      const { error } = await fromTable(client, 'commercial_listing_co_agents')
        .delete()
        .eq('id', input.coAgentId)
        .eq('listing_id', input.listingId)
        .eq('account_id', input.accountId);

      if (error) throw new Error(error.message);

      const remaining = await this.listCoAgents(
        input.listingId,
        input.accountId,
      );

      if (remaining.length === 0) {
        await client
          .from('commercial_listings')
          .update({
            instruction_nature: 'exclusive',
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.listingId)
          .eq('account_id', input.accountId);
      }

      return remaining;
    },

    /**
     * Upsert co-marketing agents from Agents Society / PH joint_agents.
     * Skips own-agency marketing contacts — those are not joint agents.
     */
    async syncCoAgentsFromFeed(input: {
      listingId: string;
      accountId: string;
      agents: Array<{
        externalId?: string | null;
        firmName: string;
        contactName?: string | null;
        contactEmail?: string | null;
        contactPhone?: string | null;
      }>;
      /** Offices treated as “own desk” (not co-marketing). */
      ownOfficeNames?: string[];
    }): Promise<ListingCoAgent[]> {
      const own = new Set(
        (input.ownOfficeNames ?? []).map((n) => n.trim().toLowerCase()),
      );

      for (const agent of input.agents) {
        const firm = agent.firmName.trim();
        if (!firm) continue;
        if (own.has(firm.toLowerCase())) continue;

        let clientId: string | null = null;
        const { data: byEmail } = agent.contactEmail
          ? await client
              .from('clients')
              .select('id')
              .eq('account_id', input.accountId)
              .ilike('email', agent.contactEmail.trim())
              .is('deleted_at', null)
              .limit(1)
              .maybeSingle()
          : { data: null };

        if (byEmail?.id) {
          clientId = byEmail.id as string;
        } else {
          const { data: byName } = await client
            .from('clients')
            .select('id')
            .eq('account_id', input.accountId)
            .ilike('company_name', firm)
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle();
          clientId = (byName?.id as string | undefined) ?? null;
        }

        await this.addCoAgent({
          listingId: input.listingId,
          accountId: input.accountId,
          clientId: clientId ?? undefined,
          companyName: clientId ? undefined : firm,
          contactName: agent.contactName,
          contactEmail: agent.contactEmail,
          contactPhone: agent.contactPhone,
          externalId: agent.externalId ?? null,
        }).catch((err) => {
          if (err instanceof Error && err.message.includes('already linked')) {
            return;
          }
          throw err;
        });
      }

      return this.listCoAgents(input.listingId, input.accountId);
    },

    async listParties(
      listingId: string,
      accountId: string,
      role?: ListingPartyRole,
    ): Promise<ListingParty[]> {
      let query = fromTable(client, 'commercial_listing_parties')
        .select(
          'id, listing_id, client_id, contact_id, role, contact_name, contact_email, contact_phone, is_private, sort_order, clients(display_name, company_name, first_name, last_name, phone, email), contacts(full_name, first_name, last_name, phone, email)',
        )
        .eq('listing_id', listingId)
        .eq('account_id', accountId)
        .order('sort_order', { ascending: true });

      if (role) {
        query = query.eq('role', role);
      }

      const { data: rows, error } = await query;
      if (error) {
        console.error('[listings] listParties:', error.message);
        return [];
      }

      return Promise.all(
        ((rows ?? []) as Array<Record<string, unknown>>).map(
          async (row, index) => {
            const clientRow = row.clients as Record<string, unknown> | null;
            const contactRow = row.contacts as Record<string, unknown> | null;
            const clientName =
              (clientRow?.display_name as string | null)?.trim() ||
              (clientRow?.company_name as string | null)?.trim() ||
              [clientRow?.first_name, clientRow?.last_name]
                .filter(Boolean)
                .join(' ')
                .trim() ||
              (row.role === 'landlord' ? 'Landlord' : 'Contact');
            const contactName =
              (row.contact_name as string | null)?.trim() ||
              (contactRow?.full_name as string | null)?.trim() ||
              [contactRow?.first_name, contactRow?.last_name]
                .filter(Boolean)
                .join(' ')
                .trim() ||
              null;
            const contactPhone =
              (row.contact_phone as string | null)?.trim() ||
              (contactRow?.phone as string | null)?.trim() ||
              null;
            const contactEmail =
              (row.contact_email as string | null)?.trim() ||
              (contactRow?.email as string | null)?.trim() ||
              null;

            let displayPhone = contactPhone;
            if (!displayPhone) {
              displayPhone =
                (clientRow?.phone as string | null)?.trim() || null;
            }
            if (!displayPhone) {
              const { data: primaryLinks } = await client
                .from('client_contacts')
                .select('contacts(phone)')
                .eq('client_id', row.client_id as string)
                .order('is_primary', { ascending: false })
                .limit(3);
              for (const link of primaryLinks ?? []) {
                const c = link.contacts as unknown as {
                  phone?: string | null;
                } | null;
                const phone = c?.phone?.trim();
                if (phone) {
                  displayPhone = phone;
                  break;
                }
              }
            }

            return {
              id: row.id as string,
              listingId: row.listing_id as string,
              clientId: row.client_id as string,
              contactId: (row.contact_id as string | null) ?? null,
              role: row.role as ListingPartyRole,
              clientName,
              contactName,
              contactEmail:
                contactEmail || ((clientRow?.email as string | null) ?? null),
              contactPhone,
              displayPhone,
              isPrivate: Boolean(row.is_private),
              sortOrder: Number(row.sort_order ?? index),
            };
          },
        ),
      );
    },

    async searchPartyClients(input: {
      accountId: string;
      query?: string;
      excludeListingId?: string;
      role?: ListingPartyRole;
    }): Promise<CoAgentClientOption[]> {
      let excludeIds: string[] = [];
      if (input.excludeListingId) {
        let linkedQuery = fromTable(client, 'commercial_listing_parties')
          .select('client_id')
          .eq('listing_id', input.excludeListingId)
          .eq('account_id', input.accountId);
        if (input.role) {
          linkedQuery = linkedQuery.eq('role', input.role);
        }
        const { data: linked } = await linkedQuery;
        excludeIds = ((linked ?? []) as Array<{ client_id: string }>).map(
          (r) => r.client_id,
        );
      }

      const q = input.query?.trim().replace(/[%_,]/g, ' ');
      const results: CoAgentClientOption[] = [];

      let query = client
        .from('clients')
        .select(
          'id, display_name, company_name, first_name, last_name, email, phone, commercial_role',
        )
        .eq('account_id', input.accountId)
        .is('deleted_at', null)
        .order('display_name', { ascending: true })
        .limit(30);

      if (q) {
        query = query.or(
          `display_name.ilike.%${q}%,company_name.ilike.%${q}%,email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        if (excludeIds.includes(row.id as string)) continue;
        const name =
          (row.display_name as string | null)?.trim() ||
          (row.company_name as string | null)?.trim() ||
          [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
          'Contact';
        results.push({
          id: row.id as string,
          name,
          email: (row.email as string | null) ?? null,
          phone: (row.phone as string | null) ?? null,
          commercialRole: (row.commercial_role as string | null) ?? null,
        });
      }

      if (q && q.length >= 2) {
        const { data: people } = await client
          .from('contacts')
          .select(
            'id, full_name, first_name, last_name, email, phone, client_contacts!inner(client_id, clients!inner(id, display_name, company_name, account_id))',
          )
          .eq('account_id', input.accountId)
          .or(
            `full_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`,
          )
          .limit(20);

        for (const person of (people ?? []) as Array<Record<string, unknown>>) {
          const links = person.client_contacts as unknown as Array<{
            client_id: string;
            clients:
              | {
                  id: string;
                  display_name: string | null;
                  company_name: string | null;
                  account_id: string;
                }
              | Array<{
                  id: string;
                  display_name: string | null;
                  company_name: string | null;
                  account_id: string;
                }>;
          }>;

          for (const link of links ?? []) {
            const company = Array.isArray(link.clients)
              ? link.clients[0]
              : link.clients;
            if (!company || company.account_id !== input.accountId) continue;
            if (excludeIds.includes(company.id)) continue;

            const personName =
              (person.full_name as string | null)?.trim() ||
              [person.first_name, person.last_name]
                .filter(Boolean)
                .join(' ')
                .trim() ||
              'Person';
            const companyName =
              company.display_name?.trim() ||
              company.company_name?.trim() ||
              'Company';

            results.push({
              id: company.id,
              name: `${personName} @ ${companyName}`,
              email: (person.email as string | null) ?? null,
              phone: (person.phone as string | null) ?? null,
              commercialRole: null,
              contactId: person.id as string,
              contactName: personName,
              subtitle: companyName,
            });
          }
        }
      }

      const seen = new Set<string>();
      return results
        .filter((row) => {
          const key = `${row.id}:${row.contactId ?? ''}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 20);
    },

    async addParty(input: {
      listingId: string;
      accountId: string;
      role: ListingPartyRole;
      clientId?: string;
      contactId?: string | null;
      companyName?: string;
      contactName?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      isPrivate?: boolean;
    }): Promise<ListingParty[]> {
      const listing = await this.getListing(input.listingId, input.accountId);
      if (!listing) throw new Error('Listing not found');

      let clientId = input.clientId ?? null;
      const contactName = input.contactName?.trim() || null;
      const contactEmail = input.contactEmail?.trim() || null;
      const contactPhone = input.contactPhone?.trim() || null;
      const commercialRole =
        input.role === 'landlord' || input.role === 'tenant'
          ? input.role
          : 'other';

      if (!clientId) {
        const companyName = input.companyName?.trim();
        if (!companyName) throw new Error('Company name is required');

        const { data: created, error: createError } = await client
          .from('clients')
          .insert({
            account_id: input.accountId,
            client_type: 'business',
            company_name: companyName,
            display_name: companyName,
            email: contactEmail,
            phone: contactPhone,
            commercial_role: commercialRole,
          })
          .select('id')
          .single();

        if (createError || !created) {
          throw new Error(createError?.message ?? 'Failed to create client');
        }
        clientId = created.id as string;
      } else {
        const { data: existing, error: existingError } = await client
          .from('clients')
          .select('id')
          .eq('id', clientId)
          .eq('account_id', input.accountId)
          .is('deleted_at', null)
          .maybeSingle();
        if (existingError) throw new Error(existingError.message);
        if (!existing) throw new Error('Client not found in this workspace');
      }

      const { count } = await fromTable(client, 'commercial_listing_parties')
        .select('id', { count: 'exact', head: true })
        .eq('listing_id', input.listingId)
        .eq('account_id', input.accountId)
        .eq('role', input.role);

      const { error: insertError } = await fromTable(
        client,
        'commercial_listing_parties',
      ).insert({
        listing_id: input.listingId,
        account_id: input.accountId,
        client_id: clientId,
        contact_id: input.contactId ?? null,
        role: input.role,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        is_private: Boolean(input.isPrivate),
        sort_order: count ?? 0,
      });

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('That party is already linked to this disposal');
        }
        throw new Error(insertError.message);
      }

      if (input.role === 'landlord' && !listing.instructingClientId) {
        await client
          .from('commercial_listings')
          .update({
            instructing_client_id: clientId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.listingId)
          .eq('account_id', input.accountId);
      }

      return this.listParties(input.listingId, input.accountId, input.role);
    },

    async removeParty(input: {
      listingId: string;
      accountId: string;
      partyId: string;
    }): Promise<ListingParty[]> {
      const { data: existing, error: findError } = await fromTable(
        client,
        'commercial_listing_parties',
      )
        .select('id, client_id, role')
        .eq('id', input.partyId)
        .eq('listing_id', input.listingId)
        .eq('account_id', input.accountId)
        .maybeSingle();

      if (findError) throw new Error(findError.message);
      if (!existing) throw new Error('Party not found');

      const role = existing.role as 'landlord' | 'other';
      const clientId = existing.client_id as string;

      const { error } = await fromTable(client, 'commercial_listing_parties')
        .delete()
        .eq('id', input.partyId)
        .eq('listing_id', input.listingId)
        .eq('account_id', input.accountId);

      if (error) throw new Error(error.message);

      if (role === 'landlord') {
        const listing = await this.getListing(input.listingId, input.accountId);
        if (listing?.instructingClientId === clientId) {
          const remaining = await this.listParties(
            input.listingId,
            input.accountId,
            'landlord',
          );
          await client
            .from('commercial_listings')
            .update({
              instructing_client_id: remaining[0]?.clientId ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', input.listingId)
            .eq('account_id', input.accountId);
        }
      }

      return this.listParties(input.listingId, input.accountId, role);
    },

    async updateParty(input: {
      listingId: string;
      accountId: string;
      partyId: string;
      isPrivate?: boolean;
    }): Promise<ListingParty[]> {
      const patch: Record<string, unknown> = {};
      if (input.isPrivate !== undefined) {
        patch.is_private = input.isPrivate;
      }

      const { data: existing, error: findError } = await fromTable(
        client,
        'commercial_listing_parties',
      )
        .select('role')
        .eq('id', input.partyId)
        .eq('listing_id', input.listingId)
        .eq('account_id', input.accountId)
        .maybeSingle();

      if (findError) throw new Error(findError.message);
      if (!existing) throw new Error('Party not found');

      if (Object.keys(patch).length > 0) {
        const { error } = await fromTable(client, 'commercial_listing_parties')
          .update(patch)
          .eq('id', input.partyId)
          .eq('listing_id', input.listingId)
          .eq('account_id', input.accountId);
        if (error) throw new Error(error.message);
      }

      return this.listParties(input.listingId, input.accountId);
    },
  };
}
