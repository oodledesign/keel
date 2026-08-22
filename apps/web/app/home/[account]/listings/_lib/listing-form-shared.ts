import {
  type DisposalType,
  type ListingLetType,
  type ListingStatus,
  disposalIncludesToLet,
} from '~/lib/commercial/commercial-constants';

import type { CreateListingInput } from './schema/listings.schema';
import type { CommercialListing } from './server/listings.service';

export const listingEmptyForm = {
  name: '',
  addressLine1: '',
  addressLine2: '',
  town: '',
  county: '',
  postcode: '',
  country: 'GB',
  latitude: '',
  longitude: '',
  sector: '',
  tenure: '',
  disposalType: 'to_let' as DisposalType,
  instructionNature: 'exclusive' as 'exclusive' | 'joint',
  status: 'draft' as ListingStatus,
  askingRent: '',
  askingRentTo: '',
  askingPrice: '',
  rentFrequency: 'per_annum',
  hideRentFromMarketing: false,
  hidePriceFromMarketing: false,
  serviceChargePerSqft: '',
  ratesPayablePerSqft: '',
  estateChargePerSqft: '',
  sizeMinSqft: '',
  sizeMaxSqft: '',
  measurementStandard: 'gia',
  useClass: '',
  availableFrom: '',
  letType: '' as '' | ListingLetType,
  letContractLengthMonths: '',
  epcBand: '',
  epcRating: '',
  possession: '',
  buildStatus: '',
  planningStatus: '',
  fittedSpace: '' as '' | 'yes' | 'no',
  landSizeMin: '',
  landSizeMax: '',
  landSizeMetric: '' as '' | 'hectare' | 'acres' | 'sqft' | 'sqm',
  insuranceType: '',
  summary: '',
  description: '',
  locationCopy: '',
  keyPoints: '',
  notes: '',
  externalId: '',
};

export type ListingFormState = typeof listingEmptyForm;

export function listingToFormState(
  listing: CommercialListing,
  marketingOverrides?: {
    summary?: string;
    description?: string;
    locationCopy?: string;
    keyPoints?: string[];
  } | null,
): ListingFormState {
  const base: ListingFormState = {
    name: listing.name,
    addressLine1: listing.addressLine1 ?? '',
    addressLine2: listing.addressLine2 ?? '',
    town: listing.town ?? '',
    county: listing.county ?? '',
    postcode: listing.postcode ?? '',
    country: listing.country ?? 'GB',
    latitude: listing.latitude != null ? String(listing.latitude) : '',
    longitude: listing.longitude != null ? String(listing.longitude) : '',
    sector: listing.sector ?? '',
    tenure: listing.tenure ?? '',
    disposalType: listing.disposalType,
    instructionNature: listing.instructionNature,
    status: listing.status,
    askingRent:
      listing.askingRentPence != null
        ? String(listing.askingRentPence / 100)
        : '',
    askingRentTo:
      listing.askingRentToPence != null
        ? String(listing.askingRentToPence / 100)
        : '',
    askingPrice:
      listing.askingPricePence != null
        ? String(listing.askingPricePence / 100)
        : '',
    rentFrequency: listing.rentFrequency ?? 'per_annum',
    hideRentFromMarketing: listing.hideRentFromMarketing,
    hidePriceFromMarketing: listing.hidePriceFromMarketing,
    serviceChargePerSqft:
      listing.serviceChargePerSqft != null
        ? String(listing.serviceChargePerSqft)
        : '',
    ratesPayablePerSqft:
      listing.ratesPayablePerSqft != null
        ? String(listing.ratesPayablePerSqft)
        : '',
    estateChargePerSqft:
      listing.estateChargePerSqft != null
        ? String(listing.estateChargePerSqft)
        : '',
    sizeMinSqft: listing.sizeMinSqft != null ? String(listing.sizeMinSqft) : '',
    sizeMaxSqft: listing.sizeMaxSqft != null ? String(listing.sizeMaxSqft) : '',
    measurementStandard: listing.measurementStandard ?? 'gia',
    useClass: listing.useClass ?? '',
    availableFrom: listing.availableFrom ?? '',
    letType: listing.letType ?? '',
    letContractLengthMonths:
      listing.letContractLengthMonths != null
        ? String(listing.letContractLengthMonths)
        : '',
    epcBand: listing.epcBand ?? '',
    epcRating: listing.epcRating != null ? String(listing.epcRating) : '',
    possession: listing.possession ?? '',
    buildStatus: listing.buildStatus ?? '',
    planningStatus: listing.planningStatus ?? '',
    fittedSpace:
      listing.fittedSpace == null ? '' : listing.fittedSpace ? 'yes' : 'no',
    landSizeMin: listing.landSizeMin != null ? String(listing.landSizeMin) : '',
    landSizeMax: listing.landSizeMax != null ? String(listing.landSizeMax) : '',
    landSizeMetric:
      (listing.landSizeMetric as ListingFormState['landSizeMetric']) ?? '',
    insuranceType: listing.insuranceType ?? '',
    summary: listing.summary ?? '',
    description: listing.description ?? '',
    locationCopy: listing.locationCopy ?? '',
    keyPoints: listing.keyPoints.join('\n'),
    notes: listing.notes ?? '',
    externalId: listing.externalId ?? '',
  };

  if (!marketingOverrides) return base;

  return {
    ...base,
    summary: marketingOverrides.summary ?? base.summary,
    description: marketingOverrides.description ?? base.description,
    locationCopy: marketingOverrides.locationCopy ?? base.locationCopy,
    keyPoints: marketingOverrides.keyPoints
      ? marketingOverrides.keyPoints.join('\n')
      : base.keyPoints,
  };
}

export function formStateToListingPayload(
  form: ListingFormState,
): Omit<CreateListingInput, 'accountId'> {
  return {
    name: form.name.trim() || 'Untitled disposal',
    addressLine1: form.addressLine1.trim() || null,
    addressLine2: form.addressLine2.trim() || null,
    town: form.town.trim() || null,
    county: form.county.trim() || null,
    postcode: form.postcode.trim() || null,
    country: form.country.trim() || null,
    latitude: form.latitude ? parseFloat(form.latitude) : null,
    longitude: form.longitude ? parseFloat(form.longitude) : null,
    sector: form.sector.trim() || null,
    tenure: form.tenure.trim() || null,
    disposalType: form.disposalType,
    instructionNature: form.instructionNature,
    status: form.status,
    askingRentPence: form.askingRent
      ? Math.round(parseFloat(form.askingRent) * 100)
      : null,
    askingRentToPence: form.askingRentTo
      ? Math.round(parseFloat(form.askingRentTo) * 100)
      : null,
    askingPricePence: form.askingPrice
      ? Math.round(parseFloat(form.askingPrice) * 100)
      : null,
    rentFrequency: form.rentFrequency || null,
    hideRentFromMarketing: form.hideRentFromMarketing,
    hidePriceFromMarketing: form.hidePriceFromMarketing,
    serviceChargePerSqft: form.serviceChargePerSqft
      ? parseFloat(form.serviceChargePerSqft)
      : null,
    ratesPayablePerSqft: form.ratesPayablePerSqft
      ? parseFloat(form.ratesPayablePerSqft)
      : null,
    estateChargePerSqft: form.estateChargePerSqft
      ? parseFloat(form.estateChargePerSqft)
      : null,
    sizeMinSqft: form.sizeMinSqft ? parseFloat(form.sizeMinSqft) : null,
    sizeMaxSqft: form.sizeMaxSqft ? parseFloat(form.sizeMaxSqft) : null,
    measurementStandard: form.measurementStandard || null,
    useClass: form.useClass.trim() || null,
    availableFrom: form.availableFrom.trim() || null,
    letType: disposalIncludesToLet(form.disposalType)
      ? form.letType || null
      : null,
    letContractLengthMonths: disposalIncludesToLet(form.disposalType)
      ? form.letContractLengthMonths
        ? parseInt(form.letContractLengthMonths, 10)
        : null
      : null,
    epcBand: form.epcBand.trim() || null,
    epcRating: form.epcRating ? parseInt(form.epcRating, 10) : null,
    possession: form.possession.trim() || null,
    buildStatus: form.buildStatus.trim() || null,
    planningStatus: form.planningStatus.trim() || null,
    fittedSpace: form.fittedSpace === '' ? null : form.fittedSpace === 'yes',
    landSizeMin: form.landSizeMin ? parseFloat(form.landSizeMin) : null,
    landSizeMax: form.landSizeMax ? parseFloat(form.landSizeMax) : null,
    landSizeMetric: form.landSizeMetric || null,
    insuranceType: form.insuranceType.trim() || null,
    summary: form.summary.trim() || null,
    description: form.description.trim() || null,
    locationCopy: form.locationCopy.trim() || null,
    keyPoints: form.keyPoints
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    notes: form.notes.trim() || null,
    externalId: form.externalId.trim() || null,
  };
}
