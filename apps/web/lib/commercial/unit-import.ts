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
  sizeSqft: number | null;
  sector: string | null;
  status: string | null;
  askingRentPence: number | null;
  epcBand: string | null;
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

export function recordToUnitDraft(
  rowIndex: number,
  record: Record<string, string>,
): UnitImportDraft {
  const floorOrUnit = emptyToNull(record.floor_or_unit);
  const description = emptyToNull(record.description);
  const partFloor = emptyToNull(record.part_floor);
  const label =
    emptyToNull(record.label) ||
    description ||
    [floorOrUnit, partFloor].filter(Boolean).join(' · ') ||
    'Unit';

  const noteParts: string[] = [];
  const notes = emptyToNull(record.notes);
  if (notes) noteParts.push(notes);
  const rentPsf = emptyToNull(record.rent_per_sqft);
  if (rentPsf) noteParts.push(`Rent (sq ft): ${rentPsf}`);
  const sector = emptyToNull(record.sector);
  const status = emptyToNull(record.status);
  if (status) noteParts.push(`Status: ${status}`);

  const base: Omit<UnitImportDraft, 'errors'> = {
    rowIndex,
    externalId: emptyToNull(record.external_id),
    listingAddress: emptyToNull(record.listing_address),
    label,
    floorOrUnit,
    sizeSqft: parseNumber(record.size_sqft),
    sector,
    status,
    askingRentPence: parseGbpToPence(record.asking_rent),
    epcBand: emptyToNull(record.epc_band),
    notes: noteParts.length ? noteParts.join('\n') : null,
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
