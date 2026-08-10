import {
  emptyToNull,
  normalizeAddressKey,
  parseGbpToPence,
  parseNumber,
} from '~/lib/commercial/listing-import';

export type UnitImportDraft = {
  rowIndex: number;
  externalId: string | null;
  listingAddress: string | null;
  label: string;
  floorOrUnit: string | null;
  description: string | null;
  partFloor: boolean;
  sizeSqft: number | null;
  sector: string | null;
  tenure: string | null;
  status: string | null;
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
  notes: string | null;
  errors: string[];
};

export type ExistingUnitSnapshot = {
  id: string;
  listingId: string;
  label: string;
  floorOrUnit: string | null;
  externalId: string | null;
};

export type ListingAddressSnapshot = {
  id: string;
  addressLine1: string | null;
  name: string;
};

export type UnitDuplicateMatch = {
  rowIndex: number;
  existing: ExistingUnitSnapshot;
  matchReason: 'external_id' | 'label';
};

function parseBool(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  const s = raw.trim().toLowerCase();
  return s === 'yes' || s === 'y' || s === 'true' || s === '1';
}

function parseOptionalBool(raw: string | null | undefined): boolean | null {
  if (!raw?.trim()) return null;
  const s = raw.trim().toLowerCase();
  if (s === 'yes' || s === 'y' || s === 'true' || s === '1') return true;
  if (s === 'no' || s === 'n' || s === 'false' || s === '0') return false;
  return null;
}

export function recordToUnitDraft(
  rowIndex: number,
  record: Record<string, string>,
): UnitImportDraft {
  const floorOrUnit = emptyToNull(record.floor_or_unit);
  const description = emptyToNull(record.description);
  const partFloor = parseBool(record.part_floor);
  const label =
    emptyToNull(record.label) ||
    description ||
    [floorOrUnit, partFloor ? 'Part floor' : null]
      .filter(Boolean)
      .join(' · ') ||
    'Unit';

  const base: Omit<UnitImportDraft, 'errors'> = {
    rowIndex,
    externalId: emptyToNull(record.external_id),
    listingAddress: emptyToNull(record.listing_address),
    label,
    floorOrUnit,
    description,
    partFloor,
    sizeSqft: parseNumber(record.size_sqft),
    sector: emptyToNull(record.sector),
    tenure: emptyToNull(record.tenure),
    status: emptyToNull(record.status),
    askingRentPence: parseGbpToPence(record.asking_rent),
    rentPerSqft: parseNumber(record.rent_per_sqft),
    serviceChargePerSqft: parseNumber(record.service_charge),
    ratesPayablePerSqft: parseNumber(record.rates_payable),
    estateChargePerSqft: parseNumber(record.estate_charge),
    epcBand: emptyToNull(record.epc_band),
    possession: emptyToNull(record.possession),
    buildStatus: emptyToNull(record.build_status),
    planningStatus: emptyToNull(record.planning_status),
    fittedSpace: parseOptionalBool(record.fitted_space),
    notes: emptyToNull(record.notes),
  };

  return {
    ...base,
    errors: validateUnitImportDraft(base),
  };
}

export function validateUnitImportDraft(
  draft: Omit<UnitImportDraft, 'errors'>,
): string[] {
  const errors: string[] = [];
  if (!draft.listingAddress) {
    errors.push('Parent listing address is required');
  }
  if (!draft.label.trim()) {
    errors.push('Unit label is required');
  }
  return errors;
}

export function findListingIdForUnitAddress(
  address: string | null,
  listings: ListingAddressSnapshot[],
): string | null {
  if (!address) return null;
  const key = normalizeAddressKey(address);
  const match = listings.find(
    (l) =>
      normalizeAddressKey(l.addressLine1) === key ||
      normalizeAddressKey(l.name) === key,
  );
  return match?.id ?? null;
}

export function findUnitDuplicate(
  draft: UnitImportDraft,
  listingId: string,
  existing: ExistingUnitSnapshot[],
): UnitDuplicateMatch | null {
  const onListing = existing.filter((u) => u.listingId === listingId);

  if (draft.externalId) {
    const byExternal = onListing.find(
      (u) => u.externalId && u.externalId === draft.externalId,
    );
    if (byExternal) {
      return {
        rowIndex: draft.rowIndex,
        existing: byExternal,
        matchReason: 'external_id',
      };
    }
  }

  const labelKey = draft.label.toLowerCase().trim();
  const floorKey = (draft.floorOrUnit ?? '').toLowerCase().trim();
  const byLabel = onListing.find((u) => {
    const sameLabel = u.label.toLowerCase().trim() === labelKey;
    const sameFloor = (u.floorOrUnit ?? '').toLowerCase().trim() === floorKey;
    return sameLabel && sameFloor;
  });

  if (byLabel) {
    return {
      rowIndex: draft.rowIndex,
      existing: byLabel,
      matchReason: 'label',
    };
  }

  return null;
}
