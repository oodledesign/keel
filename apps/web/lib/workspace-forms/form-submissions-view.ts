import { formatFormFieldValue } from '~/lib/workspace-forms/form-email';
import {
  type WorkspaceFormField,
  publicVisibleFields,
} from '~/lib/workspace-forms/form-fields';

export const SUBMISSION_COLUMN_STORAGE_PREFIX =
  'ozer.form-submissions.columns.';

export const BUILTIN_SUBMISSION_COLUMNS = [
  'received',
  'name',
  'email',
  'phone',
  'record',
] as const;

export type BuiltinSubmissionColumn =
  (typeof BUILTIN_SUBMISSION_COLUMNS)[number];

export type SubmissionColumnId = BuiltinSubmissionColumn | `field:${string}`;

const RSVP_FIELD_RE = /attend|rsvp|coming/;
const GUEST_FIELD_RE = /guest|\+1|plus[_\s-]*one/;
const GUEST_KEY_EXACT_RE =
  /^(guests?|guest_count|number_of_guests|plus_?ones?)$/i;
const ATTENDING_VALUE_RE = /^(yes|y|true|attending|coming)\b/;
const GUEST_COUNT_RE = /(\d+(?:\.\d+)?)/;
const NON_GUEST_FIELD_TYPES = new Set<WorkspaceFormField['type']>([
  'name',
  'email',
  'phone',
  'message',
  'hidden',
  'file',
  'date',
  'yes_no',
]);

export type RsvpAttendeeTotals = {
  invitees: number;
  guests: number;
  totalAttendees: number;
};

export type SubmissionColumnOption = {
  id: SubmissionColumnId;
  label: string;
  builtin: boolean;
};

export type SubmissionViewRecord = {
  id: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  payload: Record<string, unknown>;
};

export function normalizeSubmissionEmail(
  email: string | null | undefined,
): string | null {
  const trimmed = email?.trim().toLowerCase() ?? '';
  return trimmed || null;
}

export function submissionUniqueKey(submission: {
  id: string;
  contactEmail: string | null;
}): string {
  return normalizeSubmissionEmail(submission.contactEmail) ?? submission.id;
}

export function countSubmissionStats(
  submissions: Array<{ id: string; contactEmail: string | null }>,
): { total: number; unique: number } {
  const uniqueKeys = new Set<string>();
  for (const submission of submissions) {
    uniqueKeys.add(submissionUniqueKey(submission));
  }
  return { total: submissions.length, unique: uniqueKeys.size };
}

/**
 * Unique by email when present (same key as RSVP unique count); otherwise
 * each row. When an email repeats, the latest `createdAt` wins.
 */
export function selectUniqueSubmissions<
  T extends { id: string; contactEmail: string | null; createdAt: string },
>(submissions: T[]): T[] {
  const latestFirst = [...submissions].sort((left, right) => {
    const delta =
      Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
      right.id.localeCompare(left.id);
    return delta;
  });

  const seen = new Set<string>();
  const selected: T[] = [];
  for (const submission of latestFirst) {
    const key = submissionUniqueKey(submission);
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(submission);
  }
  return selected;
}

export function submissionRecordLabel(
  submission: {
    commercialEnquiryId?: string | null;
    clientId?: string | null;
    requirementId?: string | null;
    pipelineDealId?: string | null;
  },
  submissionsOnly: boolean,
): string {
  if (submission.commercialEnquiryId) return 'Listing enquiry';
  if (submission.clientId) return 'Mailing-list contact';
  if (submission.requirementId) return 'Requirement';
  if (submission.pipelineDealId) return 'Pipeline enquiry';
  return submissionsOnly ? 'Submission' : 'Stored only';
}

export function groupSubmissionIdsByEmail(
  submissions: Array<{ id: string; contactEmail: string | null }>,
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const submission of submissions) {
    const email = normalizeSubmissionEmail(submission.contactEmail);
    if (!email) continue;
    const existing = groups.get(email);
    if (existing) {
      existing.push(submission.id);
    } else {
      groups.set(email, [submission.id]);
    }
  }
  return groups;
}

export function findAttendanceField(
  fields: WorkspaceFormField[],
): WorkspaceFormField | null {
  return (
    publicVisibleFields(fields).find(
      (field) =>
        (field.type === 'yes_no' ||
          field.type === 'select' ||
          field.type === 'radio') &&
        RSVP_FIELD_RE.test(`${field.key} ${field.label}`.toLowerCase()),
    ) ?? null
  );
}

export function findGuestField(
  fields: WorkspaceFormField[],
): WorkspaceFormField | null {
  const attendanceKey = findAttendanceField(fields)?.key;
  const candidates = publicVisibleFields(fields).filter((field) => {
    if (field.key === attendanceKey) return false;
    if (NON_GUEST_FIELD_TYPES.has(field.type)) return false;
    return GUEST_FIELD_RE.test(`${field.key} ${field.label}`.toLowerCase());
  });

  if (candidates.length === 0) return null;

  return (
    candidates.find((field) => GUEST_KEY_EXACT_RE.test(field.key)) ??
    candidates[0] ??
    null
  );
}

export function isAttendingResponse(value: string): boolean {
  return ATTENDING_VALUE_RE.test(value.trim().toLowerCase());
}

export function parseGuestCount(value: string): number {
  const match = value.trim().match(GUEST_COUNT_RE);
  if (!match) return 0;
  const count = Number(match[1]);
  if (!Number.isFinite(count) || count < 0) return 0;
  return Math.floor(count);
}

/**
 * Attending counts from the latest RSVP per email (same unique set as
 * the unique-submissions export). Invitees are Yes responses; guests are
 * the sum of the guest-count field on those Yes rows only.
 */
export function countRsvpAttendeeTotals(
  fields: WorkspaceFormField[],
  submissions: Array<SubmissionViewRecord & { createdAt: string }>,
): RsvpAttendeeTotals | null {
  const attendance = findAttendanceField(fields);
  if (!attendance) return null;

  const guestField = findGuestField(fields);
  let invitees = 0;
  let guests = 0;

  for (const submission of selectUniqueSubmissions(submissions)) {
    if (!isAttendingResponse(submissionFieldValue(submission, attendance))) {
      continue;
    }
    invitees += 1;
    if (guestField) {
      guests += parseGuestCount(submissionFieldValue(submission, guestField));
    }
  }

  return {
    invitees,
    guests,
    totalAttendees: invitees + guests,
  };
}

export function listSubmissionColumnOptions(
  fields: WorkspaceFormField[],
): SubmissionColumnOption[] {
  const builtins: SubmissionColumnOption[] = [
    { id: 'received', label: 'Submitted at', builtin: true },
    { id: 'name', label: 'Name', builtin: true },
    { id: 'email', label: 'Email', builtin: true },
    { id: 'phone', label: 'Phone', builtin: true },
    { id: 'record', label: 'Record', builtin: true },
  ];

  const fieldOptions = publicVisibleFields(fields)
    .filter(
      (field) =>
        field.type !== 'name' &&
        field.type !== 'email' &&
        field.type !== 'phone',
    )
    .map((field) => ({
      id: `field:${field.key}` as const,
      label: field.label,
      builtin: false,
    }));

  return [...builtins, ...fieldOptions];
}

export function defaultSubmissionColumnIds(
  fields: WorkspaceFormField[],
): SubmissionColumnId[] {
  const columns: SubmissionColumnId[] = ['received', 'name', 'email'];
  const attendance = findAttendanceField(fields);
  if (attendance) {
    columns.push(`field:${attendance.key}`);
  }
  columns.push('record');
  return columns;
}

export function sanitizeSubmissionColumnIds(
  ids: unknown,
  allowed: ReadonlySet<string>,
): SubmissionColumnId[] | null {
  if (!Array.isArray(ids)) return null;
  const next = ids.filter(
    (id): id is SubmissionColumnId => typeof id === 'string' && allowed.has(id),
  );
  return next.length > 0 ? next : null;
}

export function parseStoredSubmissionColumns(
  raw: string | null | undefined,
  allowed: ReadonlySet<string>,
): SubmissionColumnId[] | null {
  if (!raw?.trim()) return null;
  try {
    return sanitizeSubmissionColumnIds(JSON.parse(raw), allowed);
  } catch {
    return null;
  }
}

export function submissionColumnStorageKey(formId: string): string {
  return `${SUBMISSION_COLUMN_STORAGE_PREFIX}${formId}`;
}

export function submissionBuiltinValue(
  submission: SubmissionViewRecord,
  column: Exclude<BuiltinSubmissionColumn, 'received' | 'record'>,
): string {
  if (column === 'name') {
    return (
      submission.contactName?.trim() ||
      formatFormFieldValue(submission.payload.name) ||
      ''
    );
  }
  if (column === 'email') {
    return (
      submission.contactEmail?.trim() ||
      formatFormFieldValue(submission.payload.email) ||
      ''
    );
  }
  return (
    submission.contactPhone?.trim() ||
    formatFormFieldValue(submission.payload.phone) ||
    ''
  );
}

export function submissionFieldValue(
  submission: SubmissionViewRecord,
  field: WorkspaceFormField,
): string {
  if (field.type === 'name') {
    return submissionBuiltinValue(submission, 'name');
  }
  if (field.type === 'email') {
    return submissionBuiltinValue(submission, 'email');
  }
  if (field.type === 'phone') {
    return submissionBuiltinValue(submission, 'phone');
  }
  return formatFormFieldValue(
    submission.payload[field.key] ?? submission.payload[field.id],
  );
}

export function listFilledSubmissionAnswers(
  fields: WorkspaceFormField[],
  submission: SubmissionViewRecord,
): Array<{ key: string; label: string; value: string }> {
  return publicVisibleFields(fields)
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: submissionFieldValue(submission, field),
    }))
    .filter((item) => item.value);
}
