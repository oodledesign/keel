import { afterEach, describe, expect, it, vi } from 'vitest';

import { listMapboxTokens } from '../mapbox-token';
import { fetchNearbyBrochureAmenities } from '../nearby-amenities';
import {
  amenityDedupeKey,
  buildFallbackNearbyAmenities,
  formatNearbyAmenityLabel,
  isDummyLocalAreaAmenity,
  isThinNearbyAmenityList,
  mergeBrochureAmenities,
  resolveAmenityIcon,
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

  it('dedupes railway/train station wording and distance suffixes', () => {
    expect(amenityDedupeKey('Tonbridge Railway Station · 0.4 mi')).toBe(
      amenityDedupeKey('Tonbridge station · 0.4 mi'),
    );
    expect(
      buildFallbackNearbyAmenities('Tonbridge', [
        'Tonbridge Railway Station · 0.4 mi',
        'Tonbridge station · 0.4 mi',
        'Lidl · 0.2 mi',
      ]).map((item) => item.label),
    ).toEqual([
      'Tonbridge town centre',
      'Tonbridge Railway Station · 0.4 mi',
      'Lidl · 0.2 mi',
    ]);
  });

  it('falls back to town centre only — never Local area (outward postcode)', () => {
    expect(buildFallbackNearbyAmenities('Crowborough')).toEqual([
      { label: 'Crowborough town centre', index: 1, icon: 'town' },
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

  it('lists MAPBOX_SECRET_TOKEN before the public map token', () => {
    vi.stubEnv('MAPBOX_SECRET_TOKEN', 'sk.server');
    vi.stubEnv('MAPBOX_ACCESS_TOKEN', '');
    vi.stubEnv('MAPBOX_TOKEN', '');
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'pk.public');

    expect(listMapboxTokens().map((item) => item.source)).toEqual([
      'MAPBOX_SECRET_TOKEN',
      'NEXT_PUBLIC_MAPBOX_TOKEN',
    ]);
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
    expect(amenities.find((item) => item.label.startsWith('Lidl'))).toEqual(
      expect.objectContaining({
        icon: 'grocery',
        latitude: 51.059,
        longitude: 0.164,
      }),
    );
    expect(
      amenities.find((item) => item.label.includes('Hospital'))?.icon,
    ).toBe('hospital');
  });

  it('normalises railway station names and skips car-park hits', async () => {
    vi.stubEnv('MAPBOX_SECRET_TOKEN', 'sk.test');
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', '');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        if (
          href.includes('railway%20station') ||
          href.includes('train%20station')
        ) {
          return {
            ok: true,
            json: async () => ({
              features: [
                {
                  text: 'Tonbridge Railway Station',
                  center: [0.271, 51.164],
                },
              ],
            }),
          };
        }
        if (href.includes('park')) {
          return {
            ok: true,
            json: async () => ({
              features: [
                { text: 'Station car park', center: [0.27, 51.195] },
                { text: 'Calverley Grounds', center: [0.265, 51.133] },
              ],
            }),
          };
        }
        return { ok: true, json: async () => ({ features: [] }) };
      }),
    );

    const amenities = await fetchNearbyBrochureAmenities({
      latitude: 51.195,
      longitude: 0.275,
      town: 'Tonbridge',
    });

    expect(
      amenities.some((item) => /^Tonbridge station · /.test(item.label)),
    ).toBe(true);
    expect(amenities.some((item) => /car park/i.test(item.label))).toBe(false);
    expect(
      amenities.some((item) => /^Calverley Grounds · /.test(item.label)),
    ).toBe(true);
    expect(amenities.length).toBeGreaterThanOrEqual(3);
  });

  it('falls back to town centre when Mapbox returns an empty feature list', async () => {
    vi.stubEnv('MAPBOX_SECRET_TOKEN', 'sk.test');
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', '');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ features: [] }),
      })),
    );

    const amenities = await fetchNearbyBrochureAmenities({
      latitude: 51.195,
      longitude: 0.275,
      town: 'Tonbridge',
    });

    expect(amenities.map((item) => item.label)).toEqual([
      'Tonbridge town centre',
    ]);
    expect(isThinNearbyAmenityList(amenities)).toBe(true);
  });

  it('prefers MAPBOX_SECRET_TOKEN over the public map token', async () => {
    vi.stubEnv('MAPBOX_SECRET_TOKEN', 'sk.server');
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'pk.public');
    const fetchMock = vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.includes('sk.server') && href.includes('railway%20station')) {
        return {
          ok: true,
          json: async () => ({
            features: [{ text: 'Tonbridge', center: [0.271, 51.164] }],
          }),
        };
      }
      return { ok: true, json: async () => ({ features: [] }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    const amenities = await fetchNearbyBrochureAmenities({
      latitude: 51.195,
      longitude: 0.275,
      town: 'Tonbridge',
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    expect(
      fetchMock.mock.calls.every(([url]) => String(url).includes('sk.server')),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('pk.public')),
    ).toBe(false);
    expect(
      amenities.some((item) => /Tonbridge station · /.test(item.label)),
    ).toBe(true);
    expect(amenities[0]?.label).toBe('Tonbridge town centre');
    expect(amenities.length).toBeGreaterThanOrEqual(2);
  });

  it('retries with the next token when the preferred token is rejected', async () => {
    vi.stubEnv('MAPBOX_SECRET_TOKEN', 'sk.restricted');
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'pk.unrestricted');
    const fetchMock = vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.includes('sk.restricted')) {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      if (href.includes('supermarket')) {
        return {
          ok: true,
          json: async () => ({
            features: [
              { text: 'Waitrose', center: [0.272, 51.194] },
              { text: 'Lidl', center: [0.27, 51.196] },
            ],
          }),
        };
      }
      if (href.includes('railway%20station')) {
        return {
          ok: true,
          json: async () => ({
            features: [{ text: 'Tonbridge', center: [0.271, 51.164] }],
          }),
        };
      }
      return { ok: true, json: async () => ({ features: [] }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    const amenities = await fetchNearbyBrochureAmenities({
      latitude: 51.195,
      longitude: 0.275,
      town: 'Tonbridge',
    });

    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('sk.restricted'),
      ),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('pk.unrestricted'),
      ),
    ).toBe(true);
    expect(amenities.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        'Tonbridge town centre',
        expect.stringMatching(/^Tonbridge station · /),
        expect.stringMatching(/^Waitrose · /),
        expect.stringMatching(/^Lidl · /),
      ]),
    );
    expect(amenities.length).toBeGreaterThanOrEqual(4);
    expect(isThinNearbyAmenityList(amenities)).toBe(false);
  });

  it('constrains geocoding to nearby POIs and logs auth failures', async () => {
    vi.stubEnv('MAPBOX_SECRET_TOKEN', '');
    vi.stubEnv('MAPBOX_ACCESS_TOKEN', '');
    vi.stubEnv('MAPBOX_TOKEN', '');
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'pk.restricted');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        expect(href).toContain('autocomplete=false');
        expect(href).toContain('bbox=');
        expect(href).toContain('types=poi');
        expect(href).toContain('country=GB');
        return { ok: false, status: 401, json: async () => ({}) };
      }),
    );

    const amenities = await fetchNearbyBrochureAmenities({
      latitude: 51.132,
      longitude: 0.264,
      town: 'Tunbridge Wells',
    });

    expect(amenities.map((item) => item.label)).toEqual([
      'Tunbridge Wells town centre',
    ]);
    expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(0);
    expect(
      errorSpy.mock.calls.some((args) =>
        args.some(
          (arg) =>
            typeof arg === 'string' &&
            arg.includes('tokenSource=NEXT_PUBLIC_MAPBOX_TOKEN'),
        ),
      ),
    ).toBe(true);
    expect(
      errorSpy.mock.calls.some((args) =>
        args.some(
          (arg) =>
            typeof arg === 'string' && arg.includes('MAPBOX_SECRET_TOKEN'),
        ),
      ),
    ).toBe(true);
    errorSpy.mockRestore();
  });
});

describe('resolveAmenityIcon', () => {
  it('prefers the stored icon and infers one for older saved rows', () => {
    expect(
      resolveAmenityIcon({ label: 'Calverley Grounds', icon: 'park' }),
    ).toBe('park');
    expect(
      resolveAmenityIcon({ label: 'Otford station · 0.3 mi · 6 min walk' }),
    ).toBe('rail');
    expect(resolveAmenityIcon({ label: 'M25 Junction 5 · 3.1 mi' })).toBe(
      'car',
    );
    expect(resolveAmenityIcon({ label: 'Sevenoaks town centre' })).toBe('town');
    expect(resolveAmenityIcon({ label: 'Gatwick Airport · 31 mi' })).toBe(
      'airport',
    );
    expect(resolveAmenityIcon({ label: 'Waitrose · 0.4 mi' })).toBe('grocery');
    expect(
      resolveAmenityIcon({ label: 'Otford Recreation Ground · 0.1 mi' }),
    ).toBe('park');
    expect(resolveAmenityIcon({ label: 'Station Road car park' })).toBeNull();
    expect(resolveAmenityIcon({ label: 'Park Road · 0.2 mi' })).toBeNull();
    expect(resolveAmenityIcon({ label: 'Hospital Lane' })).toBeNull();
    expect(resolveAmenityIcon({ label: 'Park and Ride · 1.2 mi' })).toBeNull();
    expect(resolveAmenityIcon({ label: 'Bakery · 0.1 mi' })).toBeNull();
  });
});

describe('mergeBrochureAmenities', () => {
  it('keeps dataset places first and adds only new Mapbox POIs', () => {
    const merged = mergeBrochureAmenities(
      [
        {
          label: 'Otford station · 0.3 mi',
          index: 1,
          latitude: 51.31,
          longitude: 0.19,
        },
        {
          label: 'Sevenoaks town centre · 2.8 mi',
          index: 2,
          latitude: 51.27,
          longitude: 0.19,
        },
      ],
      [
        { label: 'Shoreham station · 1.3 mi', index: 1 },
        { label: 'Otford town centre', index: 2 },
        { label: 'Otford station · 0.3 mi', index: 3 },
        { label: 'Co-op · 0.1 mi', index: 4 },
      ],
    );
    expect(merged.map((item) => [item.index, item.label])).toEqual([
      [1, 'Otford station · 0.3 mi'],
      [2, 'Sevenoaks town centre · 2.8 mi'],
      [3, 'Co-op · 0.1 mi'],
    ]);
  });

  it('caps the merged list', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      label: `Place ${i}`,
      index: i + 1,
    }));
    expect(
      mergeBrochureAmenities(many.slice(0, 5), many.slice(5), 6),
    ).toHaveLength(6);
  });
});
