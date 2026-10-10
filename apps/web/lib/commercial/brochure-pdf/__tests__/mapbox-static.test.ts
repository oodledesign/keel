import { describe, expect, it } from 'vitest';

import {
  brochureAmenityPinOverlays,
  brochureMapPinColor,
  brochureMapZoomForPins,
  buildBrochureMapStaticUrls,
  toMapboxPinHex,
} from '../mapbox-static';

describe('brochureMapPinColor', () => {
  it('uses workspace brand primary, not the coral accent', () => {
    expect(
      brochureMapPinColor({
        primaryColor: '#0D2344',
        accentColor: '#FF5C34',
      }),
    ).toBe('#0D2344');
    expect(
      toMapboxPinHex(
        brochureMapPinColor({
          primaryColor: '#0D2344',
          accentColor: '#C8102E',
        }),
      ),
    ).toBe('0D2344');
  });
});

describe('toMapboxPinHex', () => {
  it('strips # and uppercases a brand hex', () => {
    expect(toMapboxPinHex('#57C87F')).toBe('57C87F');
    expect(toMapboxPinHex('c8102e')).toBe('C8102E');
  });

  it('expands 3-digit hex', () => {
    expect(toMapboxPinHex('#C00')).toBe('CC0000');
  });
});

describe('buildBrochureMapStaticUrls', () => {
  const input = {
    latitude: 51.058,
    longitude: 0.163,
    width: 800,
    height: 500,
    zoom: 14,
    pinColor: '#0D2344',
  };

  it('uses streets-v12 first and a brand pin hex without #', () => {
    const urls = buildBrochureMapStaticUrls(input, 'pk.test');
    expect(urls[0]).toContain('mapbox/streets-v12/static');
    expect(urls[0]).toContain('pin-l+0D2344(0.163,51.058)');
    expect(urls[0]).not.toContain('pin-l+FF5C34');
    expect(urls[0]).not.toContain('mapbox/light-v11');
  });

  it('falls back to light-v11 if streets 422s', () => {
    const urls = buildBrochureMapStaticUrls(input, 'pk.test');
    expect(urls.some((url) => url.includes('mapbox/light-v11'))).toBe(true);
  });
});

describe('amenity map pins', () => {
  const base = {
    latitude: 51.3129,
    longitude: 0.1903,
    pinColor: '#0D2344',
    amenityPinColor: '#C8102E',
  };

  it('pins numbered amenities within range and skips far or unlocated ones', () => {
    const overlays = brochureAmenityPinOverlays({
      ...base,
      amenities: [
        {
          label: 'Otford station',
          index: 1,
          latitude: 51.31316,
          longitude: 0.19678,
        },
        {
          label: 'London City Airport',
          index: 2,
          latitude: 51.505,
          longitude: 0.055,
        },
        { label: 'Waitrose', index: 3, latitude: null, longitude: null },
      ],
    });
    expect(overlays).toEqual(['pin-s-1+C8102E(0.19678,51.31316)']);
  });

  it('zooms to fit pins, capped for close places and floored for far ones', () => {
    const size = { width: 450, height: 500 };
    const near = brochureMapZoomForPins({
      ...base,
      ...size,
      amenities: [
        { label: 'Cafe', index: 1, latitude: 51.3131, longitude: 0.1905 },
      ],
    });
    const far = brochureMapZoomForPins({
      ...base,
      width: 200,
      height: 200,
      amenities: [
        { label: 'Town', index: 1, latitude: 51.35, longitude: 0.245 },
      ],
    });
    expect(near).toBe(15);
    expect(far).toBe(11);
    expect(
      brochureMapZoomForPins({ ...base, ...size, amenities: [] }),
    ).toBeNull();
  });

  it('centres the property with the property pin drawn last', () => {
    const [first] = buildBrochureMapStaticUrls(
      {
        ...base,
        width: 450,
        height: 500,
        amenities: [
          {
            label: 'Otford station',
            index: 1,
            latitude: 51.31316,
            longitude: 0.19678,
          },
        ],
      },
      'pk.test',
    );
    expect(first).toContain(
      'pin-s-1+C8102E(0.19678,51.31316),pin-l+0D2344(0.1903,51.3129)/0.1903,51.3129,14.25,0/450x500@2x?',
    );
  });
});
