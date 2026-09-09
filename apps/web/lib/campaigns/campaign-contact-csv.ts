/**
 * Client-safe CSV mapping + row validation for Campaigns contacts.
 * Email is required; name/first/last/phone/company are optional.
 */
import { z } from 'zod';

import {
  CSV_SKIP_FIELD,
  type CsvFieldMapping,
  applyCsvColumnMapping,
} from '~/lib/csv/rows-to-records';

export const CAMPAIGN_CONTACT_CSV_FIELDS = [
  'email',
  'first_name',
  'last_name',
  'full_name',
  'phone',
  'company_name',
] as const;

export type CampaignContactCsvField =
  (typeof CAMPAIGN_CONTACT_CSV_FIELDS)[number];

export const CAMPAIGN_CONTACT_CSV_FIELD_OPTIONS: Array<{
  value: CampaignContactCsvField | typeof CSV_SKIP_FIELD;
  label: string;
}> = [
  { value: CSV_SKIP_FIELD, label: "Don't import" },
  { value: 'email', label: 'Email (required)' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'full_name', label: 'Full name' },
  { value: 'phone', label: 'Phone' },
  { value: 'company_name', label: 'Company' },
];

const FIELD_SET = new Set<string>(CAMPAIGN_CONTACT_CSV_FIELDS);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CampaignContactCsvDraft = {
  rowIndex: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  phone: string | null;
  companyName: string | null;
  errors: string[];
};

export function normalizeCampaignContactCsvMapping(
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

export function heuristicCampaignContactMapping(headers: string[]): {
  mapping: CsvFieldMapping;
  notes?: string;
  aiUsed: boolean;
} {
  const lower = headers.map((header) => header.toLowerCase().trim());
  const mapping: CsvFieldMapping = Object.fromEntries(
    headers.map((header) => [header, CSV_SKIP_FIELD]),
  );
  const used = new Set<string>();

  const assign = (field: CampaignContactCsvField, ...candidates: string[]) => {
    if (used.has(field)) return;
    for (const candidate of candidates) {
      const index = lower.findIndex(
        (header) => header === candidate || header.includes(candidate),
      );
      if (index >= 0 && mapping[headers[index]!] === CSV_SKIP_FIELD) {
        mapping[headers[index]!] = field;
        used.add(field);
        return;
      }
    }
  };

  assign('email', 'e-mail', 'email address', 'email');
  assign('first_name', 'first name', 'firstname', 'given name', 'forename');
  assign('last_name', 'last name', 'lastname', 'surname', 'family name');
  assign('full_name', 'full name', 'display name', 'name');
  assign('phone', 'mobile', 'telephone', 'phone', 'tel');
  assign(
    'company_name',
    'company name',
    'company',
    'organisation',
    'organization',
    'business',
  );

  return {
    mapping,
    notes: used.has('email')
      ? 'Mapped email and any matching name/phone/company columns.'
      : 'No email column detected — map Email before preview.',
    aiUsed: false,
  };
}

export function composeCampaignContactName(input: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
}): {
  firstName: string | null;
  lastName: string | null;
  fullName: string;
} {
  const firstName = input.firstName?.trim() || null;
  const lastName = input.lastName?.trim() || null;
  const explicit = input.fullName?.trim() || null;
  const joined = [firstName, lastName].filter(Boolean).join(' ').trim();
  const fullName =
    explicit || joined || input.email?.trim() || 'Unnamed contact';

  if (firstName) {
    return { firstName, lastName, fullName };
  }

  if (explicit) {
    const space = explicit.indexOf(' ');
    if (space <= 0) {
      return { firstName: explicit, lastName: null, fullName: explicit };
    }
    return {
      firstName: explicit.slice(0, space).trim(),
      lastName: explicit.slice(space + 1).trim() || null,
      fullName: explicit,
    };
  }

  return { firstName, lastName, fullName };
}

export function parseCampaignContactCsvRows(
  headers: string[],
  rows: string[][],
  mapping: CsvFieldMapping,
): CampaignContactCsvDraft[] {
  const records = applyCsvColumnMapping(
    headers,
    rows,
    normalizeCampaignContactCsvMapping(headers, mapping),
  );

  return records.map((record, index) => {
    const email = (record.email ?? '').trim().toLowerCase();
    const names = composeCampaignContactName({
      firstName: record.first_name,
      lastName: record.last_name,
      fullName: record.full_name,
      email,
    });
    const phone = record.phone?.trim() || null;
    const companyName = record.company_name?.trim() || null;
    const errors: string[] = [];

    if (!email) {
      errors.push('Email is required');
    } else if (!EMAIL_RE.test(email) || email.length > 320) {
      errors.push('Email is not valid');
    }

    return {
      rowIndex: index,
      email,
      firstName: names.firstName,
      lastName: names.lastName,
      fullName: names.fullName,
      phone,
      companyName,
      errors,
    };
  });
}

export function summarizeCampaignContactCsvDrafts(
  drafts: CampaignContactCsvDraft[],
) {
  const valid = drafts.filter((draft) => draft.errors.length === 0);
  const invalid = drafts.filter((draft) => draft.errors.length > 0);
  return {
    validCount: valid.length,
    errorCount: invalid.length,
    valid,
    invalid,
  };
}

export const CampaignContactCsvMappingSchema = z.record(z.string(), z.string());

export function buildCampaignContactImportTemplateCsv() {
  return [
    'email,first_name,last_name,phone,company_name',
    'ada@example.com,Ada,Lovelace,+44 20 0000 0000,Analytical Engines',
    'bob@example.com,Bob,Martin,,',
  ].join('\n');
}
