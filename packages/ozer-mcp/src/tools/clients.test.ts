import { describe, expect, it } from 'vitest';

import { buildCrmClientWritePayload, mapCrmClient } from './clients';

describe('buildCrmClientWritePayload', () => {
  it('stores person fields on individuals and company on businesses', () => {
    expect(
      buildCrmClientWritePayload({
        clientType: 'individual',
        firstName: 'Ada',
        lastName: 'Lovelace',
        companyName: 'Should ignore',
        email: 'ada@example.com',
      }),
    ).toMatchObject({
      client_type: 'individual',
      first_name: 'Ada',
      last_name: 'Lovelace',
      company_name: null,
      display_name: 'Ada Lovelace',
      email: 'ada@example.com',
    });

    expect(
      buildCrmClientWritePayload({
        clientType: 'business',
        companyName: 'Bracketts',
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    ).toMatchObject({
      client_type: 'business',
      first_name: null,
      last_name: null,
      company_name: 'Bracketts',
      display_name: 'Bracketts',
    });
  });
});

describe('mapCrmClient', () => {
  it('includes workspace names alongside the client id', () => {
    expect(
      mapCrmClient(
        {
          id: 'c1',
          display_name: 'Bracketts',
          company_name: 'Bracketts',
          client_type: 'business',
          account_id: 'a1',
          email: 'hello@bracketts.com',
        },
        { workspace_name: 'Oodle', workspace_slug: 'oodle' },
      ),
    ).toMatchObject({
      id: 'c1',
      name: 'Bracketts',
      account_id: 'a1',
      workspace_name: 'Oodle',
      workspace_slug: 'oodle',
    });
  });
});
