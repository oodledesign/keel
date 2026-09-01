import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchNearbyBrochureAmenities } from '../nearby-amenities';
import {
  buildFallbackNearbyAmenities,
  formatNearbyAmenityLabel,
  isDummyLocalAreaAmenity,
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

    expect(amenities[0]?.label).toMatch(/Crowborough station · \d+\.\d mi/);
    expect(amenities.some((item) => item.label.includes('Local area'))).toBe(
      false,
    );
  });
});
