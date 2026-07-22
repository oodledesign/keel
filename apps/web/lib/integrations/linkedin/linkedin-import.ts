import {
  type ClientImportDraft,
  type ExistingClientSnapshot,
  findClientDuplicate,
  inferClientType,
  normalizeImportName,
  validateClientImportDraft,
} from '~/lib/clients/client-import';

export type LinkedInImportDestination = 'clients' | 'pipeline';

export type LinkedInConnectionRecord = {
  firstName: string;
  lastName: string;
  email: string | null;
  company: string | null;
  position: string | null;
  connectedOn: string | null;
  profileUrl: string | null;
};

export type LinkedInPipelineImportDraft = {
  rowIndex: number;
  contactName: string;
  companyName: string;
  position: string | null;
  email: string | null;
  connectedOn: string | null;
  errors: string[];
  warnings: string[];
};

export type LinkedInPipelineDuplicateMatch = {
  rowIndex: number;
  existingId: string;
  existingLabel: string;
  matchReason: 'contact_company';
};

const LINKEDIN_HEADER_ALIASES: Record<
  keyof LinkedInConnectionRecord,
  string[]
> = {
  firstName: ['first name', 'firstname', 'given name'],
  lastName: ['last name', 'lastname', 'surname', 'family name'],
  email: ['email address', 'email', 'e-mail'],
  company: ['company', 'organization', 'organisation'],
  position: ['position', 'title', 'job title'],
  connectedOn: ['connected on', 'connection date', 'date connected'],
  profileUrl: ['url', 'profile url', 'linkedin url', 'public profile url'],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function resolveHeaderIndex(
  headers: string[],
  aliases: string[],
): number | null {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const exact = normalized.findIndex((header) => header === alias);
    if (exact >= 0) return exact;
  }
  for (const alias of aliases) {
    const partial = normalized.findIndex((header) => header.includes(alias));
    if (partial >= 0) return partial;
  }
  return null;
}

export function isLinkedInConnectionsCsv(headers: string[]): boolean {
  if (headers.length < 2) return false;

  const normalized = headers.map(normalizeHeader);
  const hasFirst = normalized.some((header) =>
    LINKEDIN_HEADER_ALIASES.firstName.some(
      (alias) => header === alias || header.includes(alias),
    ),
  );
  const hasLast = normalized.some((header) =>
    LINKEDIN_HEADER_ALIASES.lastName.some(
      (alias) => header === alias || header.includes(alias),
    ),
  );
  const hasLinkedInSignal = normalized.some((header) =>
    ['company', 'position', 'connected on', 'email address'].some((signal) =>
      header.includes(signal),
    ),
  );

  return hasFirst && hasLast && hasLinkedInSignal;
}

export function parseLinkedInConnections(
  headers: string[],
  rows: string[][],
): LinkedInConnectionRecord[] {
  const indexes = Object.fromEntries(
    Object.entries(LINKEDIN_HEADER_ALIASES).map(([field, aliases]) => [
      field,
      resolveHeaderIndex(headers, aliases),
    ]),
  ) as Record<keyof LinkedInConnectionRecord, number | null>;

  const records: LinkedInConnectionRecord[] = [];

  rows.forEach((row) => {
    const read = (field: keyof LinkedInConnectionRecord) => {
      const index = indexes[field];
      if (index == null || index < 0) return null;
      return emptyToNull(row[index]);
    };

    const firstName = read('firstName');
    const lastName = read('lastName');
    if (!firstName && !lastName) return;

    records.push({
      firstName: firstName ?? '',
      lastName: lastName ?? '',
      email: read('email'),
      company: read('company'),
      position: read('position'),
      connectedOn: read('connectedOn'),
      profileUrl: read('profileUrl'),
    });
  });

  return records;
}

function linkedInWarnings(record: LinkedInConnectionRecord): string[] {
  const warnings: string[] = [];
  if (!record.email) {
    warnings.push('No email — LinkedIn only includes emails when shared');
  }
  if (!record.company) {
    warnings.push('No company — will import as an individual');
  }
  return warnings;
}

export function linkedInRecordToClientDraft(
  rowIndex: number,
  record: LinkedInConnectionRecord,
): ClientImportDraft {
  const companyName = record.company;
  const firstName = emptyToNull(record.firstName);
  const lastName = emptyToNull(record.lastName);
  const clientType = inferClientType({
    companyName,
    firstName,
  });

  const contact =
    clientType === 'business'
      ? {
          firstName: firstName ?? 'Contact',
          lastName: lastName ?? undefined,
          email: record.email ?? undefined,
          role: record.position ?? undefined,
        }
      : null;

  const base = {
    rowIndex,
    clientType,
    companyName,
    firstName: clientType === 'individual' ? firstName : null,
    lastName: clientType === 'individual' ? lastName : null,
    email: clientType === 'individual' ? record.email : null,
    phone: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    postcode: null,
    country: null,
    contact,
  };

  return {
    ...base,
    errors: validateClientImportDraft(base),
  };
}

export function linkedInRecordToPipelineDraft(
  rowIndex: number,
  record: LinkedInConnectionRecord,
): LinkedInPipelineImportDraft {
  const contactName = [record.firstName, record.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
  const companyName = record.company?.trim() ?? '';
  const errors: string[] = [];

  if (!contactName) {
    errors.push('Contact name is required');
  }

  const email = record.email?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Invalid email');
  }

  return {
    rowIndex,
    contactName,
    companyName,
    position: record.position,
    email: record.email,
    connectedOn: record.connectedOn,
    errors,
    warnings: linkedInWarnings(record),
  };
}

export function findPipelineDuplicate(
  draft: LinkedInPipelineImportDraft,
  existing: Array<{
    id: string;
    contactName: string | null;
    companyName: string | null;
  }>,
): LinkedInPipelineDuplicateMatch | null {
  const contact = normalizeImportName(draft.contactName);
  const company = normalizeImportName(draft.companyName);

  if (!contact) return null;

  const match = existing.find((row) => {
    const existingContact = normalizeImportName(row.contactName);
    const existingCompany = normalizeImportName(row.companyName);
    if (existingContact !== contact) return false;
    if (company && existingCompany) return company === existingCompany;
    return !company && !existingCompany;
  });

  if (!match) return null;

  return {
    rowIndex: draft.rowIndex,
    existingId: match.id,
    existingLabel:
      [match.contactName, match.companyName].filter(Boolean).join(' · ') ||
      match.id,
    matchReason: 'contact_company',
  };
}

export function buildLinkedInClientDrafts(
  headers: string[],
  rows: string[][],
): ClientImportDraft[] {
  return parseLinkedInConnections(headers, rows).map((record, index) =>
    linkedInRecordToClientDraft(index, record),
  );
}

export function buildLinkedInPipelineDrafts(
  headers: string[],
  rows: string[][],
): LinkedInPipelineImportDraft[] {
  return parseLinkedInConnections(headers, rows).map((record, index) =>
    linkedInRecordToPipelineDraft(index, record),
  );
}

export function findClientDuplicatesForDrafts(
  drafts: ClientImportDraft[],
  existing: ExistingClientSnapshot[],
) {
  const duplicates = [];
  for (const draft of drafts) {
    if (draft.errors.length) continue;
    const match = findClientDuplicate(draft, existing);
    if (match) duplicates.push(match);
  }
  return duplicates;
}
