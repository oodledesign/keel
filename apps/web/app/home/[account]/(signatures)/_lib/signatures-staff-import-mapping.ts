import type {
  StaffImportFieldKey,
  StaffImportMappingValue,
} from '../schema/signatures-module.schema';

const HEADER_ALIASES: Record<StaffImportFieldKey, string[]> = {
  full_name: ['full name', 'name', 'display name', 'staff name'],
  first_name: ['first name', 'firstname', 'given name', 'forename'],
  last_name: ['last name', 'lastname', 'surname', 'family name'],
  email: ['email', 'email address', 'work email', 'e-mail'],
  job_title: ['job title', 'title', 'role', 'position'],
  department: ['department', 'dept', 'team'],
  phone: ['phone', 'telephone', 'direct phone', 'work phone', 'office phone'],
  phone_direct: ['direct phone', 'direct', 'office phone', 'work phone'],
  mobile: ['mobile', 'mobile phone', 'cell', 'cell phone'],
  phone_mobile: ['mobile phone', 'mobile', 'cell phone'],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function guessStaffImportMapping(
  headers: string[],
): Record<string, StaffImportMappingValue> {
  const mapping: Record<string, StaffImportMappingValue> = {};
  const used = new Set<StaffImportFieldKey>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    let matched: StaffImportFieldKey | null = null;

    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<
      [StaffImportFieldKey, string[]]
    >) {
      if (used.has(field)) continue;
      if (aliases.some((alias) => normalized === alias)) {
        matched = field;
        break;
      }
    }

    mapping[header] = matched ?? '__skip__';
    if (matched) used.add(matched);
  }

  return mapping;
}

export function isStaffImportMappingComplete(
  mapping: Record<string, StaffImportMappingValue>,
): boolean {
  const targets = Object.values(mapping).filter(
    (value) => value !== '__skip__',
  );
  const hasEmail = targets.includes('email');
  const hasName =
    targets.includes('full_name') ||
    (targets.includes('first_name') && targets.includes('last_name'));
  return hasEmail && hasName;
}

export function mappingTargetsDuplicate(
  mapping: Record<string, StaffImportMappingValue>,
): boolean {
  const seen = new Set<StaffImportMappingValue>();
  for (const value of Object.values(mapping)) {
    if (value === '__skip__') continue;
    if (seen.has(value)) return true;
    seen.add(value);
  }
  return false;
}

export type ParsedStaffImportRow = {
  rowNumber: number;
  email: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  phone_direct: string | null;
  phone_mobile: string | null;
  errors: string[];
};

function readMappedValue(
  row: Record<string, string>,
  mapping: Record<string, StaffImportMappingValue>,
  target: StaffImportFieldKey,
): string {
  for (const [header, mapped] of Object.entries(mapping)) {
    if (mapped === target) {
      return row[header]?.trim() ?? '';
    }
  }
  return '';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function applyStaffImportMapping(
  rows: Record<string, string>[],
  mapping: Record<string, StaffImportMappingValue>,
): ParsedStaffImportRow[] {
  return rows.map((row, index) => {
    const errors: string[] = [];
    const email = readMappedValue(row, mapping, 'email').toLowerCase();
    const fullNameFromField = readMappedValue(row, mapping, 'full_name');
    const firstName = readMappedValue(row, mapping, 'first_name');
    const lastName = readMappedValue(row, mapping, 'last_name');
    const full_name =
      fullNameFromField ||
      [firstName, lastName].filter(Boolean).join(' ').trim();

    if (!full_name) {
      errors.push('Name is required');
    }
    if (!email) {
      errors.push('Email is required');
    } else if (!isValidEmail(email)) {
      errors.push('Email format is invalid');
    }

    const phoneDirect =
      readMappedValue(row, mapping, 'phone_direct') ||
      readMappedValue(row, mapping, 'phone');
    const phoneMobile =
      readMappedValue(row, mapping, 'phone_mobile') ||
      readMappedValue(row, mapping, 'mobile');

    return {
      rowNumber: index + 2,
      email,
      full_name,
      job_title: readMappedValue(row, mapping, 'job_title') || null,
      department: readMappedValue(row, mapping, 'department') || null,
      phone_direct: phoneDirect || null,
      phone_mobile: phoneMobile || null,
      errors,
    };
  });
}

export const STAFF_IMPORT_TEMPLATE_HEADERS = [
  'full_name',
  'email',
  'job_title',
  'department',
  'phone',
  'mobile',
] as const;

export function buildStaffImportTemplateCsv(): string {
  const example = [
    'Alex Morgan',
    'alex.morgan@example.com',
    'Account Manager',
    'Sales',
    '01234 567890',
    '07123 456789',
  ];
  return `${STAFF_IMPORT_TEMPLATE_HEADERS.join(',')}\n${example.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')}\n`;
}
