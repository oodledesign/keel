import { describe, expect, it } from 'vitest';

import { resolveRequirementRecipient } from '../requirement-recipient';

const person = (email: string | null, firstName: string | null = null) => ({
  email,
  firstName,
  fullName: null,
});

describe('resolveRequirementRecipient', () => {
  it('prefers the linked person over the contact and the requirement copy', () => {
    expect(
      resolveRequirementRecipient({
        contactEmail: 'old@agency.co.uk',
        contactName: 'Old',
        person: person(' Sarah@Firm.co.uk ', 'Sarah'),
        client: person('office@firm.co.uk', 'Firm'),
      }),
    ).toEqual({ email: 'sarah@firm.co.uk', name: 'Sarah', source: 'person' });
  });

  it('falls back to the contact record when the person has no email', () => {
    expect(
      resolveRequirementRecipient({
        contactEmail: 'old@agency.co.uk',
        contactName: null,
        person: person(null, 'Sarah'),
        client: person('office@firm.co.uk'),
      }),
    ).toEqual({
      email: 'office@firm.co.uk',
      name: 'Sarah',
      source: 'client',
    });
  });

  it('uses the address typed on the requirement as a last resort', () => {
    expect(
      resolveRequirementRecipient({
        contactEmail: 'Typed@Example.com',
        contactName: 'Typed',
        person: null,
        client: null,
      }),
    ).toEqual({
      email: 'typed@example.com',
      name: 'Typed',
      source: 'requirement',
    });
  });

  it('ignores values that are not email addresses', () => {
    expect(
      resolveRequirementRecipient({
        contactEmail: 'n/a',
        contactName: null,
        person: person('  '),
        client: null,
      }),
    ).toBeNull();
  });
});
