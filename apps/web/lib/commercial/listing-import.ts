import type {
  DisposalType,
  ListingStatus,
} from '~/lib/commercial/commercial-constants';

export type ListingImportDraft = {
  rowIndex: number;
  externalId: string | null;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  town: string | null;
  postcode: string | null;
  status: ListingStatus;
  disposalType: DisposalType;
  sector: string | null;
  tenure: string | null;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  askingRentPence: number | null;
  askingPricePence: number | null;
  rentFrequency: string | null;
  summary: string | null;
  description: string | null;
  notes: string | null;
  errors: string[];
};

export type ExistingListingSnapshot = {
  id: string;
  name: string;
  addressLine1: string | null;
  town: string | null;
  postcode: string | null;
  externalId: string | null;
};

export type ListingDuplicateMatch = {
  rowIndex: number;
  existing: ExistingListingSnapshot;
  matchReason: 'external_id' | 'address';
};

export function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Parse GBP-ish strings (£34,500.00 / Offers in excess of £200,000) to pence. */
export function parseGbpToPence(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const normalized = raw.replace(/,/g, '');
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const pounds = Number(match[0]);
  if (!Number.isFinite(pounds)) return null;
  return Math.round(pounds * 100);
}

export function parseNumber(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const normalized = raw.replace(/,/g, '').trim();
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

export function sizeToSqft(
  value: number | null,
  metric: string | null | undefined,
): number | null {
  if (value == null) return null;
  const m = (metric ?? 'sq ft').toLowerCase();
  if (m.includes('hectare') || m === 'ha') return value * 107639.104;
  if (m.includes('acre')) return value * 43560;
  if (
    m.includes('sq m') ||
    m.includes('m2') ||
    m.includes('sqm') ||
    m.includes('metre')
  ) {
    return value * 10.7639;
  }
  return value;
}

export function normalizeAddressKey(
  address: string | null | undefined,
  postcode?: string | null,
): string {
  const parts = [address, postcode]
    .map((p) =>
      (p ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
  return parts.join('|');
}

export function mapKatoListingStatus(raw: string | null): ListingStatus {
  if (!raw) return 'draft';
  const s = raw.toLowerCase().trim();
  if (s.includes('under offer') || s.includes('under_offer'))
    return 'under_offer';
  if (s.includes('withdrawn') || s.includes('off market')) return 'withdrawn';
  if (s === 'let' || s.includes('let agreed') || s.includes('lettings agreed'))
    return 'let';
  if (s.includes('sold')) return 'sold';
  if (s.includes('instruct')) return 'instructed';
  if (
    s.includes('available') ||
    s.includes('marketing') ||
    s.includes('on market') ||
    s.includes('to let') ||
    s.includes('for sale')
  ) {
    return 'marketing';
  }
  if (s.includes('draft')) return 'draft';
  return 'draft';
}

export function inferDisposalType(input: {
  disposalTypeRaw?: string | null;
  askingRentPence?: number | null;
  askingPricePence?: number | null;
  defaultDisposalType?: DisposalType;
}): DisposalType {
  const raw = (input.disposalTypeRaw ?? '').toLowerCase().trim();
  if (raw === 'yes' || raw.includes('investment')) return 'investment';
  if (raw.includes('sale') || raw === 'for_sale' || raw === 'for sale')
    return 'for_sale';
  if (raw.includes('let') || raw === 'to_let' || raw === 'to let')
    return 'to_let';
  if (input.askingPricePence != null && input.askingRentPence == null) {
    return 'for_sale';
  }
  if (input.askingRentPence != null && input.askingPricePence == null) {
    return 'to_let';
  }
  return input.defaultDisposalType ?? 'to_let';
}

export function mapRentFrequency(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes('annum') || s.includes('year')) return 'per_annum';
  if (s.includes('month')) return 'per_month';
  if (s.includes('sq ft') || s.includes('sqft') || s.includes('psf'))
    return 'per_sqft';
  return raw;
}

function buildNotes(record: Record<string, string>): string | null {
  const parts: string[] = [];
  const notes = emptyToNull(record.notes);
  if (notes) parts.push(notes);
  const sc = emptyToNull(record.service_charge);
  if (sc) parts.push(`Service charge: ${sc}`);
  const rates = emptyToNull(record.rates_payable);
  if (rates) parts.push(`Rates payable: ${rates}`);
  const instructed = emptyToNull(record.our_instructions);
  if (instructed) parts.push(`Our instructions: ${instructed}`);
  return parts.length ? parts.join('\n') : null;
}

export function recordToListingDraft(
  rowIndex: number,
  record: Record<string, string>,
  defaultDisposalType: DisposalType = 'to_let',
): ListingImportDraft {
  const addressLine1 = emptyToNull(record.address_line_1);
  const town = emptyToNull(record.town);
  const name =
    emptyToNull(record.name) ||
    [addressLine1, town].filter(Boolean).join(', ') ||
    '';

  const metric = emptyToNull(record.size_metric);
  const sizeMin = sizeToSqft(parseNumber(record.size_min_sqft), metric);
  const sizeMax = sizeToSqft(parseNumber(record.size_max_sqft), metric);
  const askingRentPence = parseGbpToPence(record.asking_rent);
  const askingPricePence = parseGbpToPence(record.asking_price);

  const base: Omit<ListingImportDraft, 'errors'> = {
    rowIndex,
    externalId: emptyToNull(record.external_id),
    name,
    addressLine1,
    addressLine2: emptyToNull(record.address_line_2),
    town,
    postcode: emptyToNull(record.postcode),
    status: mapKatoListingStatus(emptyToNull(record.status)),
    disposalType: inferDisposalType({
      disposalTypeRaw: emptyToNull(record.disposal_type),
      askingRentPence,
      askingPricePence,
      defaultDisposalType,
    }),
    sector: emptyToNull(record.sector),
    tenure: emptyToNull(record.tenure),
    sizeMinSqft: sizeMin,
    sizeMaxSqft: sizeMax,
    askingRentPence,
    askingPricePence,
    rentFrequency: mapRentFrequency(emptyToNull(record.rent_frequency)),
    summary: emptyToNull(record.summary),
    description: emptyToNull(record.description),
    notes: buildNotes(record),
  };

  return {
    ...base,
    errors: validateListingImportDraft(base),
  };
}

export function validateListingImportDraft(
  draft: Omit<ListingImportDraft, 'errors'>,
): string[] {
  const errors: string[] = [];
  if (!draft.name.trim() && !draft.addressLine1) {
    errors.push('Address or name is required');
  }
  return errors;
}

export function findListingDuplicate(
  draft: ListingImportDraft,
  existing: ExistingListingSnapshot[],
): ListingDuplicateMatch | null {
  if (draft.externalId) {
    const byExternal = existing.find(
      (e) => e.externalId && e.externalId === draft.externalId,
    );
    if (byExternal) {
      return {
        rowIndex: draft.rowIndex,
        existing: byExternal,
        matchReason: 'external_id',
      };
    }
  }

  const key = normalizeAddressKey(draft.addressLine1, draft.postcode);
  if (!key) return null;

  const byAddress = existing.find(
    (e) => normalizeAddressKey(e.addressLine1, e.postcode) === key,
  );
  if (byAddress) {
    return {
      rowIndex: draft.rowIndex,
      existing: byAddress,
      matchReason: 'address',
    };
  }

  return null;
}
