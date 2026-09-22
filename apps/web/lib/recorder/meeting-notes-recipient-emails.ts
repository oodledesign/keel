const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeMeetingNotesEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isMeetingNotesEmail(email: string) {
  return EMAIL_PATTERN.test(email);
}

/**
 * The address the rest of the CRM uses when a contact has several:
 * primary `contact_email_addresses` row, then any address, then `contacts.email`.
 */
export function primaryContactEmail(contact: {
  email?: string | null;
  emails?: Array<{
    email?: string | null;
    is_primary?: boolean | null;
  }> | null;
}): string | null {
  const addresses = contact.emails ?? [];
  const resolved =
    addresses.find((address) => address.is_primary)?.email?.trim() ||
    addresses.find((address) => address.email?.trim())?.email?.trim() ||
    contact.email?.trim() ||
    null;

  return resolved || null;
}

function collectEmails(values: readonly string[]) {
  const emails: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const email = normalizeMeetingNotesEmail(value);
    if (!isMeetingNotesEmail(email) || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }

  return { emails, seen };
}

/**
 * Recipients for "Email meeting notes".
 *
 * Calendar / call participants stay first, in the order already used by the
 * modal. Linked client contacts are appended, deduped by email. The workspace
 * user's own address is not added from client contacts unless it is already a
 * call participant.
 */
export function mergeMeetingNotesRecipientEmails(input: {
  participantEmails: readonly string[];
  clientContactEmails: readonly string[];
  currentUserEmails?: ReadonlyArray<string | null | undefined>;
}): string[] {
  const participants = collectEmails(input.participantEmails);
  const currentUserEmails = new Set(
    (input.currentUserEmails ?? [])
      .filter((email): email is string => Boolean(email?.trim()))
      .map((email) => normalizeMeetingNotesEmail(email))
      .filter(isMeetingNotesEmail),
  );

  const merged = [...participants.emails];

  for (const value of input.clientContactEmails) {
    const email = normalizeMeetingNotesEmail(value);
    if (!isMeetingNotesEmail(email) || participants.seen.has(email)) continue;
    if (currentUserEmails.has(email)) continue;
    participants.seen.add(email);
    merged.push(email);
  }

  return merged;
}
