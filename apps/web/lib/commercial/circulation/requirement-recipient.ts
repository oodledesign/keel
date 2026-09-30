import { normalizeCirculationEmail } from '~/lib/commercial/circulation/circulation-eligibility';

export type RecipientPerson = {
  email: string | null;
  firstName: string | null;
  fullName: string | null;
};

export type RequirementRecipientInput = {
  contactEmail: string | null;
  contactName: string | null;
  /** The linked person on the contact (contacts row), if any. */
  person: RecipientPerson | null;
  /** The linked contact record (clients row), if any. */
  client: RecipientPerson | null;
};

export type RequirementRecipientSource = 'person' | 'client' | 'requirement';

export type RequirementRecipient = {
  email: string;
  name: string | null;
  source: RequirementRecipientSource;
};

function cleanName(person: RecipientPerson | null): string | null {
  if (!person) return null;
  return person.firstName?.trim() || person.fullName?.trim() || null;
}

/**
 * Who a requirement's circulation email goes to. The linked person wins, then
 * the linked contact, then the address typed on the requirement, so editing a
 * contact changes where circulation goes.
 */
export function resolveRequirementRecipient(
  input: RequirementRecipientInput,
): RequirementRecipient | null {
  const candidates: Array<{
    email: string | null | undefined;
    name: string | null;
    source: RequirementRecipientSource;
  }> = [
    {
      email: input.person?.email,
      name: cleanName(input.person),
      source: 'person',
    },
    {
      email: input.client?.email,
      name: cleanName(input.client),
      source: 'client',
    },
    {
      email: input.contactEmail,
      name: input.contactName?.trim() || null,
      source: 'requirement',
    },
  ];

  for (const candidate of candidates) {
    const email = normalizeCirculationEmail(candidate.email ?? '');
    if (!email.includes('@')) continue;
    return {
      email,
      name:
        candidate.name ??
        cleanName(input.person) ??
        cleanName(input.client) ??
        (input.contactName?.trim() || null),
      source: candidate.source,
    };
  }

  return null;
}
