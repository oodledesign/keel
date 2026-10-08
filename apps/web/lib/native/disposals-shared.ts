import { z } from 'zod';

import type { CommercialListing } from '~/home/[account]/listings/_lib/server/listings.service';
import {
  ASKING_PRICE_QUALIFIERS,
  ASKING_PRICE_QUALIFIER_LABELS,
  type AskingPriceQualifier,
  DISPOSAL_TYPE_LABELS,
  LISTING_ACTIVE_STATUSES,
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
  type ListingStatus,
  formatCommercialUseClassLabel,
} from '~/lib/commercial/commercial-constants';

import { NativeHttpError } from './http';
import { isUuid } from './workspace-shared';

export function workspaceShowsNativeDisposals(
  profile: string | null | undefined,
) {
  return profile === 'commercial_property';
}

export const NATIVE_DISPOSAL_LIST_FILTERS = [
  'live',
  'marketing',
  'under_offer',
  'completed',
  'withdrawn',
  'all',
] as const;

export type NativeDisposalListFilter =
  (typeof NATIVE_DISPOSAL_LIST_FILTERS)[number];

export function parseNativeDisposalListFilter(
  value: string | null | undefined,
): NativeDisposalListFilter {
  const trimmed = value?.trim().toLowerCase() ?? '';
  if (!trimmed) return 'live';
  if ((NATIVE_DISPOSAL_LIST_FILTERS as readonly string[]).includes(trimmed)) {
    return trimmed as NativeDisposalListFilter;
  }
  throw new NativeHttpError(
    400,
    `status must be one of ${NATIVE_DISPOSAL_LIST_FILTERS.join(', ')}`,
  );
}

/** Empty array means no status filter. */
export function nativeDisposalFilterStatuses(
  filter: NativeDisposalListFilter,
): ListingStatus[] {
  switch (filter) {
    case 'live':
      return [...LISTING_ACTIVE_STATUSES];
    case 'marketing':
      return ['marketing'];
    case 'under_offer':
      return ['under_offer'];
    case 'completed':
      return ['let', 'sold'];
    case 'withdrawn':
      return ['withdrawn'];
    case 'all':
      return [];
  }
}

export function parseNativeDisposalId(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  if (!isUuid(trimmed)) {
    throw new NativeHttpError(404, 'Disposal not found');
  }
  return trimmed;
}

export type NativeDisposal = {
  id: string;
  name: string;
  address: string | null;
  postcode: string | null;
  status: ListingStatus;
  status_label: string;
  disposal_type: string;
  disposal_type_label: string;
  sector: string | null;
  size_label: string | null;
  rent_label: string | null;
  price_label: string | null;
  cover_url: string | null;
  agents: string[];
  updated_at: string;
};

export type NativeDisposalDetail = NativeDisposal & {
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  tenure: string | null;
  use_class_label: string | null;
  available_from: string | null;
  epc_band: string | null;
  epc_rating: number | null;
  service_charge_per_sqft: number | null;
  rates_payable_per_sqft: number | null;
  size_min_sqft: number | null;
  size_max_sqft: number | null;
  asking_rent_pence: number | null;
  asking_rent_to_pence: number | null;
  rent_frequency: string | null;
  asking_price_pence: number | null;
  asking_price_qualifier: AskingPriceQualifier;
  summary: string | null;
  description: string | null;
  notes: string | null;
  key_points: string[];
  on_market_at: string | null;
  can_edit: boolean;
};

export type NativeDisposalsList = {
  items: NativeDisposal[];
  total: number;
  can_edit: boolean;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const sqftFormatter = new Intl.NumberFormat('en-GB', {
  maximumFractionDigits: 0,
});

export function nativeDisposalSizeLabel(
  minSqft: number | null | undefined,
  maxSqft: number | null | undefined,
): string | null {
  const min = typeof minSqft === 'number' && minSqft > 0 ? minSqft : null;
  const max = typeof maxSqft === 'number' && maxSqft > 0 ? maxSqft : null;
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) {
    return `${sqftFormatter.format(min)}–${sqftFormatter.format(max)} sq ft`;
  }
  return `${sqftFormatter.format((min ?? max)!)} sq ft`;
}

function formatPounds(pence: number, withPence: boolean): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: withPence ? 2 : 0,
    maximumFractionDigits: withPence ? 2 : 0,
  }).format(pence / 100);
}

/** Per-sq-ft rents are small (e.g. 1300 = £13.00 psf), so they keep pence. */
export function nativeDisposalRentLabel(
  fromPence: number | null | undefined,
  toPence: number | null | undefined,
  frequency: string | null | undefined,
): string | null {
  const from =
    typeof fromPence === 'number' && fromPence > 0 ? fromPence : null;
  const to = typeof toPence === 'number' && toPence > 0 ? toPence : null;
  if (from == null && to == null) return null;

  const perSqft = frequency === 'per_sqft';
  const amount =
    from != null && to != null && from !== to
      ? `${formatPounds(from, perSqft)}–${formatPounds(to, perSqft)}`
      : formatPounds((from ?? to)!, perSqft);
  if (perSqft) return `${amount} per sq ft`;
  return `${amount} ${frequency === 'per_month' ? 'pcm' : 'pa'}`;
}

export function nativeDisposalPriceLabel(
  pence: number | null | undefined,
  qualifier: AskingPriceQualifier,
): string | null {
  if (typeof pence !== 'number' || pence <= 0) return null;
  const amount = formatPounds(pence, false);
  return qualifier === 'none'
    ? amount
    : `${ASKING_PRICE_QUALIFIER_LABELS[qualifier]} ${amount}`;
}

function oneLineAddress(listing: CommercialListing): string | null {
  const parts = [listing.addressLine1, listing.town, listing.postcode]
    .map(clean)
    .filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(', ') : null;
}

export function mapNativeDisposal(listing: CommercialListing): NativeDisposal {
  return {
    id: listing.id,
    name: clean(listing.name) ?? 'Untitled disposal',
    address: oneLineAddress(listing),
    postcode: clean(listing.postcode),
    status: listing.status,
    status_label: LISTING_STATUS_LABELS[listing.status] ?? listing.status,
    disposal_type: listing.disposalType,
    disposal_type_label:
      DISPOSAL_TYPE_LABELS[listing.disposalType] ?? listing.disposalType,
    sector: clean(listing.sector),
    size_label: nativeDisposalSizeLabel(
      listing.sizeMinSqft,
      listing.sizeMaxSqft,
    ),
    rent_label: nativeDisposalRentLabel(
      listing.askingRentPence,
      listing.askingRentToPence,
      listing.rentFrequency,
    ),
    price_label: nativeDisposalPriceLabel(
      listing.askingPricePence,
      listing.askingPriceQualifier,
    ),
    cover_url: clean(listing.coverUrl ?? null),
    agents: (listing.actingAgents ?? [])
      .map((agent) => clean(agent.name))
      .filter((name): name is string => name !== null),
    updated_at: listing.updatedAt,
  };
}

export function mapNativeDisposalDetail(
  listing: CommercialListing,
  canEdit: boolean,
): NativeDisposalDetail {
  return {
    ...mapNativeDisposal(listing),
    address_line_1: clean(listing.addressLine1),
    address_line_2: clean(listing.addressLine2),
    town: clean(listing.town),
    county: clean(listing.county),
    tenure: clean(listing.tenure),
    use_class_label: formatCommercialUseClassLabel(listing.useClass),
    available_from: clean(listing.availableFrom)?.slice(0, 10) ?? null,
    epc_band: clean(listing.epcBand),
    epc_rating: listing.epcRating,
    service_charge_per_sqft: listing.serviceChargePerSqft,
    rates_payable_per_sqft: listing.ratesPayablePerSqft,
    size_min_sqft: listing.sizeMinSqft,
    size_max_sqft: listing.sizeMaxSqft,
    asking_rent_pence: listing.askingRentPence,
    asking_rent_to_pence: listing.askingRentToPence,
    rent_frequency: clean(listing.rentFrequency),
    asking_price_pence: listing.askingPricePence,
    asking_price_qualifier: listing.askingPriceQualifier,
    summary: clean(listing.summary),
    description: clean(listing.description),
    notes: clean(listing.notes),
    key_points: listing.keyPoints.map((point) => point.trim()).filter(Boolean),
    on_market_at: listing.onMarketAt,
    can_edit: canEdit,
  };
}

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : clean(value)));

const optionalPence = z.number().int().min(0).nullable().optional();
const optionalSqft = z.number().min(0).nullable().optional();

export const NativeDisposalPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    status: z.enum(LISTING_STATUSES).optional(),
    asking_rent_pence: optionalPence,
    asking_rent_to_pence: optionalPence,
    rent_frequency: z
      .enum(['per_annum', 'per_month', 'per_sqft'])
      .nullable()
      .optional(),
    asking_price_pence: optionalPence,
    asking_price_qualifier: z.enum(ASKING_PRICE_QUALIFIERS).optional(),
    size_min_sqft: optionalSqft,
    size_max_sqft: optionalSqft,
    available_from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    summary: optionalText(140),
    description: optionalText(20_000),
    notes: optionalText(20_000),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'No disposal fields to update',
  })
  .refine(
    (value) =>
      value.size_min_sqft == null ||
      value.size_max_sqft == null ||
      value.size_min_sqft <= value.size_max_sqft,
    { message: 'Minimum size must not exceed maximum size' },
  );

export type NativeDisposalPatch = z.infer<typeof NativeDisposalPatchSchema>;

/** Native snake_case patch → listings service input. Undefined keys are left untouched. */
export function toListingUpdateInput(patch: NativeDisposalPatch) {
  return {
    name: patch.name,
    status: patch.status,
    askingRentPence: patch.asking_rent_pence,
    askingRentToPence: patch.asking_rent_to_pence,
    rentFrequency: patch.rent_frequency,
    askingPricePence: patch.asking_price_pence,
    askingPriceQualifier: patch.asking_price_qualifier,
    sizeMinSqft: patch.size_min_sqft,
    sizeMaxSqft: patch.size_max_sqft,
    availableFrom: patch.available_from,
    summary: patch.summary,
    description: patch.description,
    notes: patch.notes,
  };
}
