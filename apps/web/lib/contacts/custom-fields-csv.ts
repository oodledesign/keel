import { buildCsvDocument } from '~/lib/csv/build-csv';
import {
  CSV_SKIP_FIELD,
  type CsvFieldMapping,
} from '~/lib/csv/rows-to-records';

import type {
  ContactCustomFieldDefinition,
  ContactCustomFieldValues,
} from './custom-fields';
import { formatContactFieldValue } from './custom-fields';

/** CSV mapping targets for custom fields look like `custom:budget`. */
export const CUSTOM_CSV_PREFIX = 'custom:';

export function customCsvField(key: string): string {
  return `${CUSTOM_CSV_PREFIX}${key}`;
}

export function customCsvFieldOptions(
  definitions: ContactCustomFieldDefinition[],
): Array<{ value: string; label: string }> {
  return definitions.map((definition) => ({
    value: customCsvField(definition.key),
    label: `Custom: ${definition.label}`,
  }));
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Fill still-skipped columns whose header matches a custom field label or key.
 * Each field is assigned to at most one column.
 */
export function suggestCustomFieldMapping(
  headers: string[],
  mapping: CsvFieldMapping,
  definitions: ContactCustomFieldDefinition[],
): CsvFieldMapping {
  const next: CsvFieldMapping = { ...mapping };
  const used = new Set(Object.values(next));

  for (const header of headers) {
    if (next[header] && next[header] !== CSV_SKIP_FIELD) continue;
    const normalized = normalizeHeader(header);
    if (!normalized) continue;

    const match = definitions.find(
      (definition) =>
        !used.has(customCsvField(definition.key)) &&
        (normalizeHeader(definition.label) === normalized ||
          normalizeHeader(definition.key) === normalized),
    );
    if (match) {
      next[header] = customCsvField(match.key);
      used.add(customCsvField(match.key));
    }
  }
  return next;
}

/** Keep only mapped custom columns that exist as definitions. */
export function normalizeCustomMapping(
  mapping: CsvFieldMapping,
  definitions: ContactCustomFieldDefinition[],
): CsvFieldMapping {
  const known = new Set(
    definitions.map((definition) => customCsvField(definition.key)),
  );
  return Object.fromEntries(
    Object.entries(mapping).map(([header, field]) => [
      header,
      field.startsWith(CUSTOM_CSV_PREFIX) && !known.has(field)
        ? CSV_SKIP_FIELD
        : field,
    ]),
  );
}

/** Pull `custom:*` columns out of a mapped CSV record. */
export function extractCustomValues(
  record: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, value] of Object.entries(record)) {
    if (field.startsWith(CUSTOM_CSV_PREFIX)) {
      out[field.slice(CUSTOM_CSV_PREFIX.length)] = value;
    }
  }
  return out;
}

export type ClientExportRow = {
  client_type: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  custom_fields: unknown;
};

const EXPORT_COLUMNS: Array<[string, keyof ClientExportRow]> = [
  ['Client type', 'client_type'],
  ['Company name', 'company_name'],
  ['First name', 'first_name'],
  ['Last name', 'last_name'],
  ['Email', 'email'],
  ['Phone', 'phone'],
  ['Address line 1', 'address_line_1'],
  ['Address line 2', 'address_line_2'],
  ['City', 'city'],
  ['Postcode', 'postcode'],
  ['Country', 'country'],
];

/** Guard against spreadsheet formula injection in exported cells. */
function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function buildClientsExportCsv(
  rows: ClientExportRow[],
  definitions: ContactCustomFieldDefinition[],
): string {
  const headers = [
    ...EXPORT_COLUMNS.map(([label]) => label),
    ...definitions.map((definition) => definition.label),
  ];

  const body = rows.map((row) => {
    const values =
      row.custom_fields &&
      typeof row.custom_fields === 'object' &&
      !Array.isArray(row.custom_fields)
        ? (row.custom_fields as ContactCustomFieldValues)
        : {};
    return [
      ...EXPORT_COLUMNS.map(([, key]) => safeCell(String(row[key] ?? ''))),
      ...definitions.map((definition) => {
        const value = values[definition.key];
        const text = formatContactFieldValue(value);
        return text === '—' ? '' : safeCell(text);
      }),
    ];
  });

  return buildCsvDocument(headers, body);
}
