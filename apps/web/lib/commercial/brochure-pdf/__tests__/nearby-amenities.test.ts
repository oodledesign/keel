import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchNearbyBrochureAmenities } from '../nearby-amenities';
import {
  buildFallbackNearbyAmenities,
  formatNearbyAmenityLabel,
  isDummyLocalAreaAmenity,
  isThinNearbyAmenityList,
  sanitizeBrochureAmenities,
} from '../nearby-amenities.shared';

describe('nearby amenity labels', () => {
  it('formats a human name with distance', () => {
    expect(formatNearbyAmenityLabel('Crowborough station', '0.4 mi')).toBe(
      'Crowborough station · 0.4 mi',
    );
  });

  it('treats Local area (XX) as dummy copy', () => {
    expect(isDummyLocalAreaAmenity('Local area (TN6)')).toBe(true);
    expect(isDummyLocalAreaAmenity('Crowborough town centre')).toBe(false);
  });

  it('keeps Mapbox POIs when falling back instead of stopping at town centre', () => {
    expect(
      buildFallbackNearbyAmenities('Crowborough', [
        'Lidl · 0.2 mi',
        'Morrisons · 0.3 mi',
        'Waitrose · 0.4 mi',
        { label: 'The Horder Centre · 0.6 mi' },
      ]).map((item) => item.label),
    ).toEqual([
      'Crowborough town centre',
      'Lidl · 0.2 mi',
      'Morrisons · 0.3 mi',
      'Waitrose · 0.4 mi',
      'The Horder Centre · 0.6 mi',
    ]);
  });

  it('treats a town-centre-only list as thin so POIs can be merged', () => {
    expect(
      isThinNearbyAmenityList([{ label: 'Crowborough town centre' }]),
    ).toBe(true);
    expect(
      isThinNearbyAmenityList([
        { label: 'Crowborough town centre' },
        { label: 'Lidl · 0.2 mi' },
      ]),
    ).toBe(false);
  });

  it('falls back to town centre only — never Local area (outward postcode)', () => {
    expect(buildFallbackNearbyAmenities('Crowborough')).toEqual([
      { label: 'Crowborough town centre', index: 1 },
    ]);
    expect(
      sanitizeBrochureAmenities(
        [{ label: 'Local area (TN6)', index: 1 }],
        'Crowborough',
      ).map((item) => item.label),
    ).toEqual(['Crowborough town centre']);
    expect(
      sanitizeBrochureAmenities(
        [{ label: 'Local area (TN6)', index: 1 }],
        'Crowborough',
      ).some((item) => /local area\s*\(/i.test(item.label)),
    ).toBe(false);
  });
});

describe('fetchNearbyBrochureAmenities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('falls back to town centre when Mapbox is unavailable', async () => {
    vi.stubEnv('MAPBOX_SECRET_TOKEN', '');
    vi.stubEnv('MAPBOX_ACCESS_TOKEN', '');
    vi.stubEnv('MAPBOX_TOKEN', '');
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', '');

    const amenities = await fetchNearbyBrochureAmenities({
      latitude: 51.058,
      longitude: 0.163,
      town: 'Crowborough',
    });

    expect(amenities.map((item) => item.label)).toEqual([
      'Crowborough town centre',
    ]);
    expect(amenities.some((item) => item.label.includes('Local area'))).toBe(
      false,
    );
  });

  it('labels the nearest station with a human name and miles', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'pk.test');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        if (href.includes('railway%20station')) {
          return {
            ok: true,
            json: async () => ({
              features: [
                {
                  text: 'Crowborough',
                  center: [0.168, 51.061],
                },
              ],
            }),
          };
        }
        return { ok: true, json: async () => ({ features: [] }) };
      }),
    );

    const amenities = await fetchNearbyBrochureAmenities({
      latitude: 51.058,
      longitude: 0.163,
      town: 'Crowborough',
    });

    expect(amenities[0]?.label).toBe('Crowborough town centre');
    expect(
      amenities.some((item) =>
        /Crowborough station · \d+\.\d mi/.test(item.label),
      ),
    ).toBe(true);
    expect(amenities.some((item) => item.label.includes('Local area'))).toBe(
      false,
    );
  });

  it('numbers several Mapbox POIs into the Nearby list', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'pk.test');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        if (href.includes('supermarket')) {
          return {
            ok: true,
            json: async () => ({
              features: [
                { text: 'Lidl', center: [0.164, 51.059] },
                { text: 'Morrisons', center: [0.165, 51.06] },
                { text: 'Waitrose', center: [0.166, 51.057] },
              ],
            }),
          };
        }
        if (href.includes('hospital')) {
          return {
            ok: true,
            json: async () => ({
              features: [
                {
                  text: 'Crowborough War Memorial Hospital',
                  center: [0.17, 51.055],
                },
              ],
            }),
          };
        }
        return { ok: true, json: async () => ({ features: [] }) };
      }),
    );

    const amenities = await fetchNearbyBrochureAmenities({
      latitude: 51.058,
      longitude: 0.163,
      town: 'Crowborough',
    });

    expect(amenities.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        'Crowborough town centre',
        expect.stringMatching(/^Lidl · /),
        expect.stringMatching(/^Morrisons · /),
        expect.stringMatching(/^Waitrose · /),
        expect.stringMatching(/Hospital · /),
      ]),
    );
    expect(amenities.length).toBeGreaterThanOrEqual(5);
  });
});
