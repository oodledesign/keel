import { buildCsvDocument } from '~/lib/csv/build-csv';
import {
  CSV_SKIP_FIELD,
  type CsvFieldMapping,
} from '~/lib/csv/rows-to-records';

/** Target fields for commercial listing (disposal) CSV import. */
export const LISTING_CSV_FIELDS = [
  'external_id',
  'name',
  'address_line_1',
  'address_line_2',
  'town',
  'postcode',
  'status',
  'disposal_type',
  'sector',
  'tenure',
  'size_min_sqft',
  'size_max_sqft',
  'size_metric',
  'asking_rent',
  'asking_price',
  'rent_frequency',
  'summary',
  'description',
  'notes',
  'service_charge',
  'rates_payable',
  'our_instructions',
] as const;

export type ListingCsvField = (typeof LISTING_CSV_FIELDS)[number];

export const LISTING_CSV_FIELD_OPTIONS: Array<{
  value: ListingCsvField | typeof CSV_SKIP_FIELD;
  label: string;
}> = [
  { value: CSV_SKIP_FIELD, label: "Don't import" },
  { value: 'external_id', label: 'External ID (Kato ID)' },
  { value: 'name', label: 'Listing name' },
  { value: 'address_line_1', label: 'Address' },
  { value: 'address_line_2', label: 'Address line 2' },
  { value: 'town', label: 'Town / city' },
  { value: 'postcode', label: 'Postcode' },
  { value: 'status', label: 'Status' },
  { value: 'disposal_type', label: 'Disposal type (to let / for sale)' },
  { value: 'sector', label: 'Property type / sector' },
  { value: 'tenure', label: 'Lease / sale type' },
  { value: 'size_min_sqft', label: 'Size from' },
  { value: 'size_max_sqft', label: 'Size to' },
  { value: 'size_metric', label: 'Size metric (sq ft, hectares…)' },
  { value: 'asking_rent', label: 'Rent / asking rent' },
  { value: 'asking_price', label: 'Sale price' },
  { value: 'rent_frequency', label: 'Rent metric' },
  { value: 'summary', label: 'Summary' },
  { value: 'description', label: 'Terms / description' },
  { value: 'notes', label: 'Notes' },
  { value: 'service_charge', label: 'Service charge' },
  { value: 'rates_payable', label: 'Rates payable' },
  { value: 'our_instructions', label: 'Our instructions?' },
];

export type ListingCsvMapResult = {
  mapping: CsvFieldMapping;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
  aiUsed: boolean;
};

const FIELD_SET = new Set<string>(LISTING_CSV_FIELDS);

export function normalizeListingCsvMapping(
  headers: string[],
  mapping: CsvFieldMapping | undefined,
): CsvFieldMapping {
  const out: CsvFieldMapping = {};
  const used = new Set<string>();

  for (const header of headers) {
    const raw = mapping?.[header]?.trim() || CSV_SKIP_FIELD;
    if (raw === CSV_SKIP_FIELD || !FIELD_SET.has(raw) || used.has(raw)) {
      out[header] = CSV_SKIP_FIELD;
      continue;
    }
    out[header] = raw;
    used.add(raw);
  }

  return out;
}

export function heuristicListingMapping(
  headers: string[],
): Omit<ListingCsvMapResult, 'aiUsed'> {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const mapping: CsvFieldMapping = Object.fromEntries(
    headers.map((h) => [h, CSV_SKIP_FIELD]),
  );
  const used = new Set<string>();

  const assignExact = (field: ListingCsvField, ...exact: string[]) => {
    if (used.has(field)) return;
    for (const candidate of exact) {
      const i = lower.findIndex((h) => h === candidate);
      if (i >= 0 && mapping[headers[i]!] === CSV_SKIP_FIELD) {
        mapping[headers[i]!] = field;
        used.add(field);
        return;
      }
    }
  };

  const assignIncludes = (field: ListingCsvField, ...parts: string[]) => {
    if (used.has(field)) return;
    for (const part of parts) {
      const i = lower.findIndex((h) => h.includes(part));
      if (i >= 0 && mapping[headers[i]!] === CSV_SKIP_FIELD) {
        mapping[headers[i]!] = field;
        used.add(field);
        return;
      }
    }
  };

  // Kato disposals export columns (exact first).
  assignExact('external_id', 'id');
  assignExact('status', 'status');
  assignExact('address_line_1', 'address');
  assignExact('town', 'town');
  assignExact('postcode', 'postcode');
  assignExact('size_min_sqft', 'size from');
  assignExact('size_max_sqft', 'size to');
  assignExact('size_metric', 'size metric');
  assignExact('asking_rent', 'rent from', 'rent to');
  assignExact('asking_price', 'price (sortable)', 'price');
  assignExact('rent_frequency', 'rent metric');
  assignExact('tenure', 'lease type', 'sale type');
  assignExact('sector', 'property type');
  assignExact('summary', 'summary', 'lsummary');
  assignExact('description', 'terms');
  assignExact('service_charge', 'service charge (sq ft)', 'service charge');
  assignExact('rates_payable', 'rates payable (sq ft)', 'rates payable');
  assignExact('our_instructions', 'our instructions?');
  assignExact('disposal_type', 'investment?');

  assignIncludes('name', 'listing name', 'property name', 'name');
  assignIncludes('address_line_2', 'address 2', 'address line 2');
  assignIncludes('notes', 'notes');

  // Prefer sortable price when both Price columns exist.
  const sortableIdx = lower.findIndex((h) => h === 'price (sortable)');
  if (sortableIdx >= 0) {
    mapping[headers[sortableIdx]!] = 'asking_price';
    used.add('asking_price');
    const priceIdx = lower.findIndex((h) => h === 'price');
    if (priceIdx >= 0 && priceIdx !== sortableIdx) {
      mapping[headers[priceIdx]!] = CSV_SKIP_FIELD;
    }
  }

  // Prefer Rent From over Rent To when both map would collide.
  const rentFromIdx = lower.findIndex((h) => h === 'rent from');
  if (rentFromIdx >= 0) {
    mapping[headers[rentFromIdx]!] = 'asking_rent';
    used.add('asking_rent');
    const rentToIdx = lower.findIndex((h) => h === 'rent to');
    if (rentToIdx >= 0 && rentToIdx !== rentFromIdx) {
      mapping[headers[rentToIdx]!] = CSV_SKIP_FIELD;
    }
  }

  return {
    mapping,
    confidence: 'high',
    notes: 'Mapped using Kato / commercial disposal column names',
  };
}

export const LISTING_CSV_TEMPLATE_HEADERS = [
  'ID',
  'Status',
  'Address',
  'Town',
  'Postcode',
  'Size From',
  'Size To',
  'Size Metric',
  'Rent From',
  'Price',
  'Lease Type',
  'Property Type',
  'Summary',
  'Terms',
] as const;

export function buildListingImportTemplateCsv(): string {
  return buildCsvDocument(
    [...LISTING_CSV_TEMPLATE_HEADERS],
    [
      [
        '380376',
        'Available',
        '5 Angel Walk',
        'Tonbridge',
        'TN9 1TJ',
        '3139',
        '3139',
        'sq ft',
        '£34,500.00',
        '',
        'New Lease',
        'Retail',
        'TO LET - Prominent Retail Class E Unit',
        '',
      ],
      [
        '384559',
        'Available',
        'Larchwood, Pillar Box Lane',
        'Sevenoaks',
        'TN15 0EY',
        '1.3',
        '1.3',
        'Hectares',
        '',
        '£200,000.00',
        'Freehold',
        'Land',
        'AGRICULTURAL LAND FOR SALE',
        '',
      ],
    ],
  );
}
