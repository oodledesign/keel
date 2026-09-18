const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export function normalizeRecipientEmail(email: string) {
  return email.trim().toLowerCase();
}

function looksLikeEmail(value: string) {
  return value.includes('@') && !value.includes(' ');
}

/**
 * A stored name is usable when it is not empty, not just punctuation, and not
 * the recipient's own email (calendar often stores displayName = email).
 */
export function usableRecipientName(
  name: string | null | undefined,
  email: string,
): string | null {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return null;
  if (!HAS_LETTER_OR_DIGIT.test(trimmed)) return null;
  if (looksLikeEmail(trimmed)) return null;
  if (normalizeRecipientEmail(trimmed) === normalizeRecipientEmail(email)) {
    return null;
  }
  return trimmed;
}

export function formatMeetingNotesRecipientLabel(input: {
  name?: string | null;
  email: string;
}): { label: string; name: string | null; email: string } {
  const email = normalizeRecipientEmail(input.email);
  const name = usableRecipientName(input.name, email);
  return {
    name,
    email,
    label: name ? `${name} - ${email}` : email,
  };
}

type NamedEmail = {
  name: string;
  email?: string | null;
};

function nameFromEmailList(rows: NamedEmail[] | undefined, email: string) {
  const match = rows?.find(
    (row) =>
      Boolean(row.email) && normalizeRecipientEmail(row.email ?? '') === email,
  );
  return usableRecipientName(match?.name, email);
}

/**
 * Prefer a real display name from contacts, calendar attendees, then people
 * (workspace members / clients).
 */
export function resolveMeetingNotesRecipientName(input: {
  email: string;
  contacts?: NamedEmail[];
  attendees?: Array<{ name?: string | null; email?: string | null }>;
  members?: NamedEmail[];
  clients?: NamedEmail[];
}): string | null {
  const email = normalizeRecipientEmail(input.email);

  return (
    nameFromEmailList(input.contacts, email) ??
    usableRecipientName(
      input.attendees?.find(
        (row) =>
          Boolean(row.email) &&
          normalizeRecipientEmail(row.email ?? '') === email,
      )?.name,
      email,
    ) ??
    nameFromEmailList(input.members, email) ??
    nameFromEmailList(input.clients, email)
  );
}
