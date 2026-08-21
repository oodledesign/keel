import { describe, expect, it } from 'vitest';

import { parseMapboxAddressFeature } from '../address-suggest';

describe('parseMapboxAddressFeature', () => {
  it('parses a street address with house number', () => {
    const result = parseMapboxAddressFeature({
      id: 'address.1',
      place_type: ['address'],
      address: '4B',
      text: 'Valley Industries',
      place_name: '4B Valley Industries, Tonbridge, TN11 0AG, United Kingdom',
      center: [0.31167, 51.217228],
      context: [
        { id: 'postcode.1', text: 'TN11 0AG' },
        { id: 'place.1', text: 'Tonbridge' },
        { id: 'district.1', text: 'Tonbridge and Malling' },
        { id: 'region.1', text: 'Kent' },
      ],
    });

    expect(result).toMatchObject({
      addressLine1: '4B Valley Industries',
      town: 'Tonbridge',
      postcode: 'TN11 0AG',
      county: 'Tonbridge and Malling',
      country: 'GB',
      latitude: 51.217228,
      longitude: 0.31167,
      nameHint: '4B Valley Industries',
    });
  });

  it('parses a POI with street as address line 2', () => {
    const result = parseMapboxAddressFeature({
      id: 'poi.1',
      place_type: ['poi'],
      text: 'Pickhill Business Centre',
      place_name:
        'Pickhill Business Centre, Smallhythe Road, Tenterden, TN30 7LZ, United Kingdom',
      center: [0.69, 51.07],
      context: [
        { id: 'postcode.1', text: 'TN30 7LZ' },
        { id: 'place.1', text: 'Tenterden' },
        { id: 'region.1', text: 'Kent' },
      ],
    });

    expect(result).toMatchObject({
      nameHint: 'Pickhill Business Centre',
      addressLine1: 'Pickhill Business Centre',
      addressLine2: 'Smallhythe Road',
      town: 'Tenterden',
      postcode: 'TN30 7LZ',
    });
  });

  it('parses a bare postcode', () => {
    const result = parseMapboxAddressFeature({
      id: 'postcode.1',
      place_type: ['postcode'],
      text: 'TN11 0AG',
      place_name: 'TN11 0AG, Tonbridge, Kent, England, United Kingdom',
      center: [0.31, 51.21],
      context: [
        { id: 'place.1', text: 'Tonbridge' },
        { id: 'region.1', text: 'Kent' },
      ],
    });

    expect(result).toMatchObject({
      postcode: 'TN11 0AG',
      town: 'Tonbridge',
      addressLine1: null,
      nameHint: null,
    });
  });
});
