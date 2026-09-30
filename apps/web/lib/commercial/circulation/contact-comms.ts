export type ContactCirculationStatus =
  | 'subscribed'
  | 'paused'
  | 'unsubscribed'
  | 'suppressed'
  | 'none';

export type ContactNewsletterStatus =
  | 'subscribed'
  | 'unsubscribed'
  | 'suppressed'
  | 'none';

export type ContactCirculationFilter =
  | 'subscribed'
  | 'paused'
  | 'not_subscribed'
  | 'unsubscribed';

export type ContactLastEmailKind =
  | 'circulation_digest'
  | 'circulation_listing'
  | 'campaign';

export type ContactLastEmail = {
  kind: ContactLastEmailKind;
  sentAt: string;
  subject: string;
  listingNames: string[];
  listingCount: number;
  automatic: boolean;
};

export type ContactNotEmailedReason =
  | 'no_email'
  | 'unsubscribed'
  | 'suppressed'
  | 'not_subscribed'
  | 'paused'
  | 'recently_emailed'
  | 'last_send_failed';

export type ContactCommsSummary = {
  circulationStatus: ContactCirculationStatus;
  newsletterStatus: ContactNewsletterStatus;
  activeRequirementCount: number;
  lastEmail: ContactLastEmail | null;
  /** Only set when the contact has an active requirement. */
  notEmailedReason: ContactNotEmailedReason | null;
};

export type ConsentRowInput = {
  email: string;
  clientId: string | null;
  marketingStatus: string;
  autoSendEnabled?: boolean | null;
};

const CIRCULATION_RANK: ContactCirculationStatus[] = [
  'subscribed',
  'paused',
  'suppressed',
  'unsubscribed',
];

function circulationStatusOf(row: ConsentRowInput): ContactCirculationStatus {
  if (row.marketingStatus === 'subscribed') {
    return row.autoSendEnabled === false ? 'paused' : 'subscribed';
  }
  if (row.marketingStatus === 'suppressed') return 'suppressed';
  if (row.marketingStatus === 'unsubscribed') return 'unsubscribed';
  return 'none';
}

/**
 * Rows for the addresses the contact is actually emailed at win; rows only
 * linked by client (e.g. an old address kept after an email change) are a
 * fallback, so a stale subscription never masks a current unsubscribe.
 */
function rowsForContact(
  rows: ConsentRowInput[],
  primaryEmails: Set<string>,
): ConsentRowInput[] {
  const primary = rows.filter((row) => primaryEmails.has(row.email));
  return primary.length > 0 ? primary : rows;
}

export function pickCirculationStatus(
  rows: ConsentRowInput[],
  primaryEmails: Set<string>,
): ContactCirculationStatus {
  const statuses = new Set(
    rowsForContact(rows, primaryEmails).map(circulationStatusOf),
  );
  return CIRCULATION_RANK.find((status) => statuses.has(status)) ?? 'none';
}

export function pickNewsletterStatus(
  rows: ConsentRowInput[],
  primaryEmails: Set<string>,
): ContactNewsletterStatus {
  const statuses = new Set(
    rowsForContact(rows, primaryEmails).map((row) => row.marketingStatus),
  );
  if (statuses.has('subscribed')) return 'subscribed';
  if (statuses.has('suppressed')) return 'suppressed';
  if (statuses.has('unsubscribed')) return 'unsubscribed';
  return 'none';
}

export function matchesCirculationFilter(
  status: ContactCirculationStatus,
  filter: ContactCirculationFilter,
): boolean {
  if (filter === 'subscribed') return status === 'subscribed';
  if (filter === 'paused') return status === 'paused';
  if (filter === 'not_subscribed') return status === 'none';
  return status === 'unsubscribed' || status === 'suppressed';
}

export function resolveNotEmailedReason(input: {
  activeRequirementCount: number;
  hasRecipientEmail: boolean;
  circulationStatus: ContactCirculationStatus;
  lastCirculatedAt: string | null;
  lastFailedAt: string | null;
  lastSentAt: string | null;
  minGapDays: number;
  now?: Date;
}): ContactNotEmailedReason | null {
  if (input.activeRequirementCount === 0) return null;
  if (!input.hasRecipientEmail) return 'no_email';
  if (input.circulationStatus === 'unsubscribed') return 'unsubscribed';
  if (input.circulationStatus === 'suppressed') return 'suppressed';
  if (
    input.lastFailedAt &&
    (!input.lastSentAt || input.lastFailedAt > input.lastSentAt)
  ) {
    return 'last_send_failed';
  }
  if (input.circulationStatus === 'none') return 'not_subscribed';
  if (input.circulationStatus === 'paused') return 'paused';
  if (input.lastCirculatedAt && input.minGapDays > 0) {
    const now = (input.now ?? new Date()).getTime();
    const gapMs = input.minGapDays * 24 * 60 * 60 * 1000;
    if (now - new Date(input.lastCirculatedAt).getTime() < gapMs) {
      return 'recently_emailed';
    }
  }
  return null;
}

export function needsAttention(input: {
  activeRequirementCount: number;
  hasRecipientEmail: boolean;
  circulationStatus: ContactCirculationStatus;
  hasUnresolvedFailure: boolean;
}): boolean {
  if (input.activeRequirementCount === 0) return false;
  return (
    !input.hasRecipientEmail ||
    input.circulationStatus === 'unsubscribed' ||
    input.circulationStatus === 'suppressed' ||
    input.hasUnresolvedFailure
  );
}

export const CIRCULATION_STATUS_LABEL: Record<
  ContactCirculationStatus,
  string
> = {
  subscribed: 'Subscribed',
  paused: 'Paused',
  unsubscribed: 'Unsubscribed',
  suppressed: 'Suppressed',
  none: 'Not subscribed',
};

export const NEWSLETTER_STATUS_LABEL: Record<ContactNewsletterStatus, string> =
  {
    subscribed: 'Subscribed',
    unsubscribed: 'Unsubscribed',
    suppressed: 'Suppressed',
    none: 'Not subscribed',
  };

export const NOT_EMAILED_REASON_LABEL: Record<ContactNotEmailedReason, string> =
  {
    no_email: 'No email address',
    unsubscribed: 'Unsubscribed from circulation',
    suppressed: 'Email address suppressed (bounce or complaint)',
    not_subscribed:
      'Not subscribed, so only manual sends reach them. Automatic emails go to subscribers only.',
    paused: 'Automatic emails paused',
    recently_emailed: 'Emailed recently. Waiting for the minimum gap.',
    last_send_failed: 'Last send failed',
  };

const LAST_EMAIL_KIND_LABEL: Record<ContactLastEmailKind, string> = {
  circulation_digest: 'Circulation digest',
  circulation_listing: 'Circulation email',
  campaign: 'Campaign',
};

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Fixed month names so server and browser render the same string. */
export function formatCommsDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const label = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  return date.getUTCFullYear() === now.getUTCFullYear()
    ? label
    : `${label} ${date.getUTCFullYear()}`;
}

/** e.g. "Circulation digest, 3 properties (Unit 4 Riverside Park, +2), 12 Sep, automatic" */
export function describeLastEmail(
  email: ContactLastEmail,
  now = new Date(),
): string {
  const parts: string[] = [LAST_EMAIL_KIND_LABEL[email.kind]];
  if (email.kind === 'campaign') {
    if (email.subject) parts.push(`“${email.subject}”`);
  } else if (email.listingCount > 0) {
    const noun = email.listingCount === 1 ? 'property' : 'properties';
    const first = email.listingNames[0];
    const extra = email.listingCount - 1;
    const names = first ? ` (${first}${extra > 0 ? `, +${extra}` : ''})` : '';
    parts.push(`${email.listingCount} ${noun}${names}`);
  }
  parts.push(formatCommsDate(email.sentAt, now));
  if (email.kind !== 'campaign') {
    parts.push(email.automatic ? 'automatic' : 'manual');
  }
  return parts.join(', ');
}

export function formatRelativeDays(iso: string, now = new Date()): string {
  const days = Math.floor(
    (now.getTime() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
