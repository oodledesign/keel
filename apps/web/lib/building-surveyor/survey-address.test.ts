import { describe, expect, it } from 'vitest';

import {
  formatSurveyAddress,
  suggestionToSurveyLookup,
} from './survey-address';

describe('formatSurveyAddress', () => {
  it('joins address parts and drops a duplicated county', () => {
    expect(
      formatSurveyAddress({
        addressLine1: '12 Example Street',
        addressLine2: null,
        town: 'Manchester',
        county: 'Manchester',
        postcode: 'M20 4AP',
        label: '12 Example Street, Manchester, M20 4AP, United Kingdom',
      }),
    ).toBe('12 Example Street, Manchester, M20 4AP');
  });

  it('falls back to the Mapbox label without United Kingdom', () => {
    expect(
      formatSurveyAddress({
        addressLine1: null,
        addressLine2: null,
        town: null,
        county: null,
        postcode: null,
        label: 'M20 4AP, Manchester, United Kingdom',
      }),
    ).toBe('M20 4AP, Manchester');
  });
});

describe('suggestionToSurveyLookup', () => {
  it('maps a suggestion and leaves UPRN empty (Mapbox does not supply it)', () => {
    const lookup = suggestionToSurveyLookup({
      id: 'address.1',
      label: '12 Example Street, Manchester, M20 4AP, United Kingdom',
      nameHint: '12 Example Street',
      addressLine1: '12 Example Street',
      addressLine2: null,
      town: 'Manchester',
      county: 'Greater Manchester',
      postcode: 'M20 4AP',
      country: 'GB',
      latitude: 53.43,
      longitude: -2.23,
    });

    expect(lookup).toEqual({
      address: '12 Example Street, Manchester, Greater Manchester, M20 4AP',
      postcode: 'M20 4AP',
      latitude: 53.43,
      longitude: -2.23,
      uprn: null,
    });
  });
});
