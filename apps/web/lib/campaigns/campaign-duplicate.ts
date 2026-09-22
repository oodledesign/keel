import { normalizeAudienceEmails } from './campaign-audience';
import { normalizeResendEmail, uniqueRecipientEmails } from './campaign-resend';

const COPY_SUFFIX = ' (copy)';
const ADDITIONAL_SUFFIX = ' (additional)';

function suffixedCampaignName(sourceName: string, suffix: string): string {
  const base = sourceName.trim() || 'Campaign';
  const raw = `${base}${suffix}`;
  if (raw.length <= 160) return raw;
  const keep = 160 - suffix.length;
  return `${base.slice(0, Math.max(1, keep)).trimEnd()}${suffix}`;
}

/** Fresh draft title. Does not imply a resend of the original audience. */
export function duplicateCampaignName(sourceName: string): string {
  return suffixedCampaignName(sourceName, COPY_SUFFIX);
}

/** Draft that only targets people added after the original send. */
export function additionalRecipientsCampaignName(sourceName: string): string {
  return suffixedCampaignName(sourceName, ADDITIONAL_SUFFIX);
}

export type AdditionalRecipientPerson = {
  id: string;
  email: string;
};

/**
 * Drop anyone already on the source campaign's recipient log.
 * Manual emails, clients, and contacts stay as separate picker selections
 * so the new draft opens in the same custom-audience editor.
 */
export function filterAdditionalRecipients(input: {
  emails: string[];
  selectedClientIds: string[];
  selectedContactIds: string[];
  clients: AdditionalRecipientPerson[];
  contacts: AdditionalRecipientPerson[];
  alreadySentEmails: string[];
}): {
  emails: string[];
  clientIds: string[];
  contactIds: string[];
  skippedAlreadySent: number;
} {
  const sent = new Set(
    uniqueRecipientEmails(input.alreadySentEmails.map((email) => ({ email }))),
  );
  const skipped = new Set<string>();

  const emails = normalizeAudienceEmails(input.emails).filter((email) => {
    if (!sent.has(email)) return true;
    skipped.add(email);
    return false;
  });

  const clientIds = keepNewPeople({
    selectedIds: input.selectedClientIds,
    people: input.clients,
    sent,
    skipped,
  });
  const contactIds = keepNewPeople({
    selectedIds: input.selectedContactIds,
    people: input.contacts,
    sent,
    skipped,
  });

  return {
    emails,
    clientIds,
    contactIds,
    skippedAlreadySent: skipped.size,
  };
}

function keepNewPeople(input: {
  selectedIds: string[];
  people: AdditionalRecipientPerson[];
  sent: Set<string>;
  skipped: Set<string>;
}): string[] {
  const byId = new Map(
    input.people.map((person) => [
      person.id,
      normalizeResendEmail(person.email),
    ]),
  );
  const kept: string[] = [];
  const seen = new Set<string>();

  for (const id of input.selectedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const email = byId.get(id);
    if (!email) continue;
    if (input.sent.has(email)) {
      input.skipped.add(email);
      continue;
    }
    kept.push(id);
  }

  return kept;
}
