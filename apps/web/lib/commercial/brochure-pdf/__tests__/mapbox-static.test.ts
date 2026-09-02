import { describe, expect, it } from 'vitest';

import {
  brochureMapPinColor,
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
