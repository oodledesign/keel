import {
  LISTING_STATUS_LABELS,
  type ListingStatus,
} from '~/lib/commercial/commercial-constants';

/** Statuses that trigger the “Notify board company?” prompt. */
export const BOARD_NOTIFY_STATUSES = [
  'under_offer',
  'let',
  'sold',
] as const satisfies readonly ListingStatus[];

export type BoardNotifyStatus = (typeof BOARD_NOTIFY_STATUSES)[number];

export function isBoardNotifyStatus(
  status: string,
): status is BoardNotifyStatus {
  return (BOARD_NOTIFY_STATUSES as readonly string[]).includes(status);
}

export type BoardBranchOverride = {
  email: string;
  cc: string;
};

export type CommercialBoardSettings = {
  email: string;
  cc: string;
  subjectTemplate: string;
  bodyTemplate: string;
  /** Optional per-branch To/CC overrides keyed by account_branches.id. */
  byBranch: Record<string, BoardBranchOverride>;
};

export const DEFAULT_BOARD_SUBJECT_TEMPLATE =
  'Boards — {{property_address}} ({{status}})';

export const DEFAULT_BOARD_BODY_TEMPLATE = `Hello,

Please take down / update the boards for the following property:

Property: {{property_address}}
Status: {{status}}
Ref: {{listing_ref}}
Branch: {{branch_name}}
Agent: {{agent_name}}

Thank you.`;

export const DEFAULT_COMMERCIAL_BOARD_SETTINGS: CommercialBoardSettings = {
  email: '',
  cc: '',
  subjectTemplate: DEFAULT_BOARD_SUBJECT_TEMPLATE,
  bodyTemplate: DEFAULT_BOARD_BODY_TEMPLATE,
  byBranch: {},
};

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseCommercialBoardSettings(
  value: unknown,
): CommercialBoardSettings {
  const row =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const byBranchRaw =
    row.byBranch &&
    typeof row.byBranch === 'object' &&
    !Array.isArray(row.byBranch)
      ? (row.byBranch as Record<string, unknown>)
      : {};

  const byBranch: Record<string, BoardBranchOverride> = {};
  for (const [branchId, override] of Object.entries(byBranchRaw)) {
    if (!override || typeof override !== 'object' || Array.isArray(override)) {
      continue;
    }
    const o = override as Record<string, unknown>;
    const email = asTrimmedString(o.email);
    const cc = asTrimmedString(o.cc);
    if (!email && !cc) continue;
    byBranch[branchId] = { email, cc };
  }

  return {
    email: asTrimmedString(row.email),
    cc: asTrimmedString(row.cc),
    subjectTemplate:
      asTrimmedString(row.subjectTemplate) || DEFAULT_BOARD_SUBJECT_TEMPLATE,
    bodyTemplate:
      asTrimmedString(row.bodyTemplate) || DEFAULT_BOARD_BODY_TEMPLATE,
    byBranch,
  };
}

export function serializeCommercialBoardSettings(
  settings: CommercialBoardSettings,
): CommercialBoardSettings {
  const byBranch: Record<string, BoardBranchOverride> = {};
  for (const [branchId, override] of Object.entries(settings.byBranch)) {
    const email = override.email.trim();
    const cc = override.cc.trim();
    if (!email && !cc) continue;
    byBranch[branchId] = { email, cc };
  }

  return {
    email: settings.email.trim(),
    cc: settings.cc.trim(),
    subjectTemplate:
      settings.subjectTemplate.trim() || DEFAULT_BOARD_SUBJECT_TEMPLATE,
    bodyTemplate: settings.bodyTemplate.trim() || DEFAULT_BOARD_BODY_TEMPLATE,
    byBranch,
  };
}

export type BoardMergeFields = {
  propertyAddress: string;
  status: string;
  listingRef: string;
  branchName: string;
  agentName: string;
};

export function applyBoardTemplate(
  template: string,
  fields: BoardMergeFields,
): string {
  return template
    .replaceAll('{{property_address}}', fields.propertyAddress)
    .replaceAll('{{status}}', fields.status)
    .replaceAll('{{listing_ref}}', fields.listingRef)
    .replaceAll('{{branch_name}}', fields.branchName)
    .replaceAll('{{agent_name}}', fields.agentName);
}

export function resolveBoardRecipients(
  settings: CommercialBoardSettings,
  accountBranchId: string | null | undefined,
): { email: string; cc: string } {
  const override =
    accountBranchId && settings.byBranch[accountBranchId]
      ? settings.byBranch[accountBranchId]
      : null;

  return {
    email: (override?.email || settings.email).trim(),
    cc: (override?.cc || settings.cc).trim(),
  };
}

export function formatBoardPropertyAddress(parts: {
  name?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
}): string {
  const line = [
    parts.addressLine1,
    parts.addressLine2,
    parts.town,
    parts.county,
    parts.postcode,
  ]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');

  if (line) return line;
  return parts.name?.trim() || 'Property';
}

export function formatBoardListingRef(parts: {
  referenceNumber?: string | null;
  externalId?: string | null;
  id: string;
}): string {
  return (
    parts.referenceNumber?.trim() ||
    parts.externalId?.trim() ||
    parts.id.slice(0, 8)
  );
}

export function boardStatusLabel(status: BoardNotifyStatus | string): string {
  if (status in LISTING_STATUS_LABELS) {
    return LISTING_STATUS_LABELS[status as ListingStatus];
  }
  return status;
}

export function parseCcList(cc: string): string[] {
  return cc
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

const BOARD_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidBoardEmail(value: string): boolean {
  return BOARD_EMAIL_PATTERN.test(value.trim());
}

/** Case-insensitive unique emails, preserving the first spelling. */
export function dedupeBoardEmails(
  emails: Array<string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const raw of emails) {
    const email = raw?.trim() ?? '';
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(email);
  }

  return unique;
}

export function splitEmailDraft(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Recipients for one notify send: the saved board address (optional),
 * plus any custom addresses. Invalid tokens are returned separately.
 */
export function collectBoardNotifyRecipients(input: {
  savedEmail?: string | null;
  includeSaved: boolean;
  customEmails: string[];
  draft?: string;
}): { recipients: string[]; invalid: string[] } {
  const pending = splitEmailDraft(input.draft ?? '');
  const candidates = [
    ...(input.includeSaved ? [input.savedEmail] : []),
    ...input.customEmails,
    ...pending,
  ];

  const invalid: string[] = [];
  const valid: string[] = [];

  for (const candidate of candidates) {
    const email = candidate?.trim() ?? '';
    if (!email) continue;
    if (!isValidBoardEmail(email)) {
      invalid.push(email);
      continue;
    }
    valid.push(email);
  }

  return {
    recipients: dedupeBoardEmails(valid),
    invalid,
  };
}
