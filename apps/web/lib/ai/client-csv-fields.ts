import {
  CSV_SKIP_FIELD,
  type CsvFieldMapping,
} from '~/lib/csv/rows-to-records';

export const CLIENT_CSV_FIELDS = [
  'client_type',
  'company_name',
  'first_name',
  'last_name',
  'email',
  'phone',
  'address_line_1',
  'address_line_2',
  'city',
  'postcode',
  'country',
  'contact_first_name',
  'contact_last_name',
  'contact_email',
  'contact_phone',
  'contact_role',
] as const;

export type ClientCsvField = (typeof CLIENT_CSV_FIELDS)[number];

export const CLIENT_CSV_FIELD_OPTIONS: Array<{
  value: ClientCsvField | typeof CSV_SKIP_FIELD;
  label: string;
}> = [
  { value: CSV_SKIP_FIELD, label: "Don't import" },
  { value: 'client_type', label: 'Client type (individual/business)' },
  { value: 'company_name', label: 'Company name' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'address_line_1', label: 'Address line 1' },
  { value: 'address_line_2', label: 'Address line 2' },
  { value: 'city', label: 'City' },
  { value: 'postcode', label: 'Postcode' },
  { value: 'country', label: 'Country' },
  { value: 'contact_first_name', label: 'Contact first name' },
  { value: 'contact_last_name', label: 'Contact last name' },
  { value: 'contact_email', label: 'Contact email' },
  { value: 'contact_phone', label: 'Contact phone' },
  { value: 'contact_role', label: 'Contact role' },
];

export type ClientCsvMapResult = {
  mapping: CsvFieldMapping;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
  aiUsed: boolean;
};

const FIELD_SET = new Set<string>(CLIENT_CSV_FIELDS);

export function normalizeClientCsvMapping(
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

export function heuristicClientMapping(
  headers: string[],
): Omit<ClientCsvMapResult, 'aiUsed'> {
  const lower = headers.map((h) => h.toLowerCase());
  const mapping: CsvFieldMapping = Object.fromEntries(
    headers.map((h) => [h, CSV_SKIP_FIELD]),
  );
  const used = new Set<string>();

  const assign = (field: ClientCsvField, ...candidates: string[]) => {
    if (used.has(field)) return;
    for (const c of candidates) {
      const i = lower.findIndex((h) => h.includes(c));
      if (i >= 0 && mapping[headers[i]!] === CSV_SKIP_FIELD) {
        mapping[headers[i]!] = field;
        used.add(field);
        return;
      }
    }
  };

  assign('company_name', 'company', 'organisation', 'organization', 'business');
  assign('first_name', 'first name', 'firstname', 'given', 'forename');
  assign('last_name', 'last name', 'lastname', 'surname', 'family');
  assign('email', 'e-mail', 'email');
  assign('phone', 'mobile', 'telephone', 'phone', 'tel');
  assign('address_line_1', 'address 1', 'address line 1', 'street', 'address');
  assign('address_line_2', 'address 2', 'address line 2');
  assign('city', 'city', 'town');
  assign('postcode', 'postcode', 'post code', 'zip');
  assign('country', 'country');
  assign('client_type', 'client type', 'type');
  assign('contact_first_name', 'contact first', 'contact given');
  assign('contact_last_name', 'contact last', 'contact surname');
  assign('contact_email', 'contact email');
  assign('contact_phone', 'contact phone', 'contact mobile');
  assign('contact_role', 'contact role', 'job title', 'title');

  return {
    mapping,
    confidence: 'medium',
    notes: 'Heuristic mapping (AI unavailable)',
  };
}
