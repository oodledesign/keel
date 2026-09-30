import { describe, expect, it } from 'vitest';

import {
  type BackfillRequirement,
  planRequirementContactBackfill,
} from './requirement-contact-backfill';

const req = (
  id: string,
  overrides: Partial<BackfillRequirement> = {},
): BackfillRequirement => ({
  id,
  clientId: null,
  contactId: null,
  contactEmail: null,
  contactName: null,
  contactPhone: null,
  companyName: null,
  ...overrides,
});

describe('planRequirementContactBackfill', () => {
  const clients = [
    { id: 'c1', email: 'office@firm.co.uk', displayName: 'Firm Ltd' },
    { id: 'c2', email: null, displayName: 'Sarah Jones' },
  ];
  const people = [
    { id: 'p1', email: 'sarah@firm.co.uk', clientId: null },
    { id: 'p2', email: 'office@firm.co.uk', clientId: 'c1' },
  ];
  const personClientLinks = [{ contactId: 'p1', clientId: 'c1' }];

  it('links website-form requirements to a contact with the same email', () => {
    const plan = planRequirementContactBackfill({
      requirements: [
        req('r1', { contactEmail: 'Office@Firm.co.uk' }),
        req('r2', { contactEmail: 'sarah@firm.co.uk' }),
      ],
      clients,
      people,
      personClientLinks,
    });
    expect(plan.actions).toEqual([
      {
        kind: 'link_existing',
        requirementId: 'r1',
        clientId: 'c1',
        contactId: 'p2',
        matchedOn: 'client_email',
      },
      {
        kind: 'link_existing',
        requirementId: 'r2',
        clientId: 'c1',
        contactId: 'p1',
        matchedOn: 'person_email',
      },
    ]);
  });

  it('plans a new contact and flags same-name contacts as possible duplicates', () => {
    const plan = planRequirementContactBackfill({
      requirements: [
        req('r3', {
          contactEmail: 'sarah@gmail.com',
          contactName: 'Sarah Jones',
        }),
        req('r4', {
          contactEmail: 'sarah@gmail.com',
          contactName: 'Sarah Jones',
        }),
      ],
      clients,
      people,
      personClientLinks,
    });
    expect(plan.counts.create_contact).toBe(2);
    expect(plan.actions[0]).toMatchObject({ possibleDuplicates: ['c2'] });
    expect(plan.actions[1]).toMatchObject({ possibleDuplicates: [] });
  });

  it('fills a missing requirement email and only reports mismatches', () => {
    const plan = planRequirementContactBackfill({
      requirements: [
        req('r5', { clientId: 'c1', contactId: 'p1' }),
        req('r6', {
          clientId: 'c1',
          contactId: 'p1',
          contactEmail: 'old@firm.co.uk',
        }),
        req('r7', {
          clientId: 'c1',
          contactId: 'p1',
          contactEmail: 'sarah@firm.co.uk',
        }),
      ],
      clients,
      people,
      personClientLinks,
    });
    expect(plan.actions).toEqual([
      { kind: 'fill_email', requirementId: 'r5', email: 'sarah@firm.co.uk' },
      {
        kind: 'mismatch',
        requirementId: 'r6',
        requirementEmail: 'old@firm.co.uk',
        contactEmail: 'sarah@firm.co.uk',
      },
    ]);
  });

  it('reports requirements with neither an email nor a name', () => {
    const plan = planRequirementContactBackfill({
      requirements: [req('r8')],
      clients,
      people,
      personClientLinks,
    });
    expect(plan.actions).toEqual([{ kind: 'unlinkable', requirementId: 'r8' }]);
  });
});
