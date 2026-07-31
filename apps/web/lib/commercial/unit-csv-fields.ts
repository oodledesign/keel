import { buildCsvDocument } from '~/lib/csv/build-csv';
import {
  CSV_SKIP_FIELD,
  type CsvFieldMapping,
} from '~/lib/csv/rows-to-records';

/** Target fields for commercial listing unit (floor unit) CSV import. */
export const UNIT_CSV_FIELDS = [
  'external_id',
  'listing_address',
  'label',
  'floor_or_unit',
  'description',
  'part_floor',
  'size_sqft',
  'sector',
  'status',
  'asking_rent',
  'rent_per_sqft',
  'epc_band',
  'notes',
] as const;

export type UnitCsvField = (typeof UNIT_CSV_FIELDS)[number];

export const UNIT_CSV_FIELD_OPTIONS: Array<{
  value: UnitCsvField | typeof CSV_SKIP_FIELD;
  label: string;
}> = [
  { value: CSV_SKIP_FIELD, label: "Don't import" },
  { value: 'external_id', label: 'External ID (Kato ID)' },
  { value: 'listing_address', label: 'Parent listing address' },
  { value: 'label', label: 'Unit label' },
  { value: 'floor_or_unit', label: 'Level / floor' },
  { value: 'description', label: 'Description' },
  { value: 'part_floor', label: 'Part floor' },
  { value: 'size_sqft', label: 'Size (sq ft)' },
  { value: 'sector', label: 'Property type' },
  { value: 'status', label: 'Status' },
  { value: 'asking_rent', label: 'Rent (annum)' },
  { value: 'rent_per_sqft', label: 'Rent (sq ft)' },
  { value: 'epc_band', label: 'EPC rating' },
  { value: 'notes', label: 'Notes' },
];

export type UnitCsvMapResult = {
  mapping: CsvFieldMapping;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
  aiUsed: boolean;
};

const FIELD_SET = new Set<string>(UNIT_CSV_FIELDS);

export function normalizeUnitCsvMapping(
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

export function heuristicUnitMapping(
  headers: string[],
): Omit<UnitCsvMapResult, 'aiUsed'> {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const mapping: CsvFieldMapping = Object.fromEntries(
    headers.map((h) => [h, CSV_SKIP_FIELD]),
  );
  const used = new Set<string>();

  const assignExact = (field: UnitCsvField, ...exact: string[]) => {
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

  assignExact('external_id', 'id');
  assignExact('listing_address', 'address');
  assignExact('floor_or_unit', 'level');
  assignExact('description', 'description');
  assignExact('part_floor', 'part floor');
  assignExact('size_sqft', 'size (sq ft)', 'size');
  assignExact('sector', 'property type');
  assignExact('status', 'status');
  assignExact('asking_rent', 'rent (annum)');
  assignExact('rent_per_sqft', 'rent (sq ft)');
  assignExact('epc_band', 'epc rating');

  return {
    mapping,
    confidence: 'high',
    notes: 'Mapped using Kato floor-units column names',
  };
}

export const UNIT_CSV_TEMPLATE_HEADERS = [
  'ID',
  'Address',
  'Level',
  'Description',
  'Part floor',
  'Size (sq ft)',
  'Property Type',
  'Status',
  'Rent (annum)',
  'EPC Rating',
] as const;

export function buildUnitImportTemplateCsv(): string {
  return buildCsvDocument(
    [...UNIT_CSV_TEMPLATE_HEADERS],
    [
      [
        '1001',
        '10 Example Street',
        'Ground',
        'Retail unit',
        'No',
        '2500',
        'Retail',
        'Available',
        '£30,000.00',
        'C',
      ],
    ],
  );
}
