import { describe, expect, it } from 'vitest';

import {
  mapContact,
  resolveContactNameParts,
  splitContactName,
} from './contacts';

describe('splitContactName', () => {
  it('splits a full name on the first space', () => {
    expect(splitContactName('Jane Mary Doe')).toEqual({
      firstName: 'Jane',
      lastName: 'Mary Doe',
    });
    expect(splitContactName('Jane')).toEqual({
      firstName: 'Jane',
      lastName: null,
    });
  });
});

describe('resolveContactNameParts', () => {
  it('keeps explicit first/last and otherwise splits full_name', () => {
    expect(
      resolveContactNameParts({
        firstName: 'Jane',
        lastName: 'Doe',
        fullName: 'Ignored',
      }),
    ).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      fullName: 'Jane Doe',
    });
    expect(resolveContactNameParts({ fullName: 'Sam Patel' })).toEqual({
      firstName: 'Sam',
      lastName: 'Patel',
      fullName: 'Sam Patel',
    });
  });
});

describe('mapContact', () => {
  it('returns industry and linked client names from existing columns only', () => {
    expect(
      mapContact(
        {
          id: 'p1',
          full_name: 'Jane Doe',
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane@example.com',
          industry: 'Retail',
          account_id: 'a1',
        },
        {
          workspace_name: 'Oodle',
          workspace_slug: 'oodle',
          clients: [
            {
              client_id: 'c1',
              client_name: 'Bracketts',
              role: 'founder',
              is_primary: true,
            },
          ],
          categories: [{ id: 'cat1', name: 'Landlords' }],
        },
      ),
    ).toMatchObject({
      id: 'p1',
      name: 'Jane Doe',
      industry: 'Retail',
      workspace_name: 'Oodle',
      clients: [
        {
          client_id: 'c1',
          client_name: 'Bracketts',
          role: 'founder',
        },
      ],
      categories: [{ id: 'cat1', name: 'Landlords' }],
    });
  });
});
