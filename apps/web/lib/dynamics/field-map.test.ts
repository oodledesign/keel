import { describe, expect, it } from 'vitest';

import {
  buildDataverseAttributes,
  consentAttributes,
  defaultDynamicsFieldMapping,
  escapeODataString,
  normalizeDynamicsEnvironmentUrl,
  normalizeDynamicsFieldMapping,
  parseDataverseEntityId,
  splitPersonName,
  validateDynamicsFieldMapping,
} from './field-map';

describe('dynamics field map', () => {
  it('splits a person name for first/last Dataverse fields', () => {
    expect(splitPersonName('Ada Lovelace')).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    expect(splitPersonName('Prince')).toEqual({
      firstName: 'Prince',
      lastName: null,
    });
    expect(splitPersonName('  ')).toEqual({
      firstName: 'Contact',
      lastName: null,
    });
  });

  it('inverts donotemail flags when the Ozer preference is subscribed', () => {
    const mapping = defaultDynamicsFieldMapping('contact');
    expect(consentAttributes(mapping, true)).toEqual({
      donotemail: false,
      donotbulkemail: false,
    });
    expect(consentAttributes(mapping, false)).toEqual({
      donotemail: true,
      donotbulkemail: true,
    });
  });

  it('writes an extra boolean consent field as opted-in', () => {
    const mapping = {
      ...defaultDynamicsFieldMapping('contact'),
      extraConsentField: 'new_ozerconsent',
    };
    expect(consentAttributes(mapping, true).new_ozerconsent).toBe(true);
    expect(consentAttributes(mapping, false).new_ozerconsent).toBe(false);
  });

  it('maps company onto Lead companyname and Contact account lookup separately', () => {
    const lead = buildDataverseAttributes(defaultDynamicsFieldMapping('lead'), {
      email: 'dan@arcanum.test',
      firstName: 'Dan',
      lastName: 'Potter',
      companyName: 'Arcanum',
      marketingOptedIn: true,
    });
    expect(lead).toMatchObject({
      emailaddress1: 'dan@arcanum.test',
      firstname: 'Dan',
      lastname: 'Potter',
      companyname: 'Arcanum',
      donotemail: false,
    });

    const contact = buildDataverseAttributes(
      defaultDynamicsFieldMapping('contact'),
      {
        email: 'dan@arcanum.test',
        firstName: 'Dan',
        lastName: 'Potter',
        companyName: 'Arcanum',
        marketingOptedIn: true,
      },
    );
    expect(contact.companyname).toBeUndefined();
    expect(contact.emailaddress1).toBe('dan@arcanum.test');
  });

  it('rejects invalid logical names', () => {
    expect(() =>
      validateDynamicsFieldMapping({
        ...defaultDynamicsFieldMapping('contact'),
        email: 'email address',
      }),
    ).toThrow(/logical name/);
  });

  it('normalizes environment URLs and OData quotes', () => {
    expect(
      normalizeDynamicsEnvironmentUrl(
        'https://arcanum.crm11.dynamics.com/api/data/v9.2/',
      ),
    ).toBe('https://arcanum.crm11.dynamics.com');
    expect(escapeODataString("O'Brien")).toBe("O''Brien");
    expect(
      parseDataverseEntityId(
        "https://org.crm.dynamics.com/api/data/v9.2/contacts(11111111-1111-4111-8111-111111111111)",
      ),
    ).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('drops unknown mapping keys and keeps defaults', () => {
    const mapping = normalizeDynamicsFieldMapping(
      { email: 'not a field', companyStrategy: 'none' },
      'contact',
    );
    expect(mapping.email).toBe('emailaddress1');
    expect(mapping.companyStrategy).toBe('none');
  });
});
