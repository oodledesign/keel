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

const OTFORD = { latitude: 51.3129, longitude: 0.1903 };

type FakePoi = [name: string, lng: number, lat: number, brand?: string];

/** Trimmed from a real Search Box response around Otford, Kent. */
const OTFORD_CATEGORIES: Record<string, FakePoi[]> = {
  supermarket: [
    ['JK SuperMarket Inc.', 0.1905, 51.313],
    ['Budgens', 0.2108, 51.3135],
    ["Sainsbury's", 0.1897, 51.2963, "Sainsbury's"],
    ["Sainsbury's Bank Travel Money", 0.1898, 51.2962, "Sainsbury's"],
    ["Sainsbury's Local", 0.1931, 51.288, "Sainsbury's"],
  ],
  school: [
    ['Little Treacles Nursery', 0.1915, 51.3135],
    ['Academy Of Freelance Makeup London', 0.1906, 51.313],
    ['Bozdag Taekwondo Academy', 0.1907, 51.3131],
    ['Russell House School', 0.1874, 51.3155],
    ["St Michael's Preparatory School", 0.2022, 51.3191],
    ['Oaks Driving School', 0.185, 51.296],
  ],
  park: [
    ['Roundabout Bird Pond', 0.1904, 51.3129],
    ['Otford Recreation Ground', 0.1925, 51.3115],
    ['Knole Park Duchess Walk Entrance', 0.199, 51.271],
  ],
  hospital: [
    ['League of Friends of Sevenoaks Hospital', 0.185, 51.295],
    ["Sevenoaks Hospital Children's Emergency Department", 0.186, 51.29],
    ['Sevenoaks Hospital', 0.1881, 51.2878],
    ['sevenoaks hospital', 0.205, 51.278],
  ],
};

function categoryFetch(categories: Record<string, FakePoi[]>) {
  return async (url: string | URL) => {
    const category = new URL(String(url)).pathname.split('/').pop() ?? '';
    const features = (categories[category] ?? []).map(
      ([name, lng, lat, brand]) => ({
        geometry: { coordinates: [lng, lat] },
        properties: { name, brand: brand ? [brand] : undefined },
      }),
    );
    return { ok: true, status: 200, json: async () => ({ features }) };
  };
}

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

  it('keeps real places from noisy category results', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'pk.test');
    vi.stubGlobal('fetch', categoryFetch(OTFORD_CATEGORIES));

    const amenities = await fetchNearbyBrochureAmenities({
      ...OTFORD,
      town: 'Sevenoaks',
    });
    const names = amenities.map((item) => item.label.split(' · ')[0]);

    expect(names).toEqual([
      'Sevenoaks town centre',
      'Budgens',
      'Russell House School',
      'Otford Recreation Ground',
      'Sevenoaks Hospital',
      "Sainsbury's",
      "St Michael's Preparatory School",
    ]);
    expect(amenities[1]).toEqual(
      expect.objectContaining({
        icon: 'grocery',
        latitude: 51.3135,
        longitude: 0.2108,
      }),
    );
    expect(amenities.map((item) => item.icon)).toEqual([
      'town',
      'grocery',
      'school',
      'park',
      'hospital',
      'grocery',
      'school',
    ]);
  });

  it('queries Search Box categories near the property, excluding nurseries', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'pk.test');
    const fetchMock = vi.fn(categoryFetch({}));
    vi.stubGlobal('fetch', fetchMock);

    await fetchNearbyBrochureAmenities({ ...OTFORD, town: 'Sevenoaks' });

    const urls = fetchMock.mock.calls.map(([url]) => new URL(String(url)));
    expect(urls.map((url) => url.pathname.split('/').pop())).toEqual([
      'supermarket',
      'school',
      'park',
      'hospital',
    ]);
    for (const url of urls) {
      expect(url.pathname).toContain('/search/searchbox/v1/category/');
      expect(url.searchParams.get('country')).toBe('GB');
      expect(url.searchParams.get('proximity')).toBe('0.1903,51.3129');
      expect(url.searchParams.get('bbox')).toBeTruthy();
    }
    expect(urls[1]?.searchParams.get('poi_category_exclusions')).toContain(
      'kindergarten',
    );
  });

  it('keeps other categories when one request throws', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'pk.test');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ok = categoryFetch(OTFORD_CATEGORIES);
    vi.stubGlobal('fetch', async (url: string | URL) => {
      if (String(url).includes('/category/school')) {
        throw new Error('timeout');
      }
      return ok(url);
    });

    const amenities = await fetchNearbyBrochureAmenities({
      ...OTFORD,
      town: 'Sevenoaks',
    });

    expect(amenities.some((item) => item.icon === 'grocery')).toBe(true);
    expect(amenities.some((item) => item.icon === 'school')).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      '[brochure-pdf] nearby amenities failed:',
      'category=school',
      'timeout',
    );
    errorSpy.mockRestore();
  });

  it('falls back to town centre when Mapbox returns an empty feature list', async () => {
    vi.stubEnv('MAPBOX_SECRET_TOKEN', 'sk.test');
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', '');
    vi.stubGlobal('fetch', categoryFetch({}));

    const amenities = await fetchNearbyBrochureAmenities({
      ...OTFORD,
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
    const fetchMock = vi.fn(categoryFetch(OTFORD_CATEGORIES));
    vi.stubGlobal('fetch', fetchMock);

    const amenities = await fetchNearbyBrochureAmenities({
      ...OTFORD,
      town: 'Sevenoaks',
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    expect(
      fetchMock.mock.calls.every(([url]) => String(url).includes('sk.server')),
    ).toBe(true);
    expect(amenities.length).toBeGreaterThan(1);
  });

  it('retries with the next token when the preferred token is rejected', async () => {
    vi.stubEnv('MAPBOX_SECRET_TOKEN', 'sk.restricted');
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'pk.unrestricted');
    const ok = categoryFetch(OTFORD_CATEGORIES);
    const fetchMock = vi.fn(async (url: string | URL) => {
      if (String(url).includes('sk.restricted')) {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      return ok(url);
    });
    vi.stubGlobal('fetch', fetchMock);

    const amenities = await fetchNearbyBrochureAmenities({
      ...OTFORD,
      town: 'Sevenoaks',
    });

    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('pk.unrestricted'),
      ),
    ).toBe(true);
    expect(amenities.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        'Sevenoaks town centre',
        expect.stringMatching(/^Budgens · /),
      ]),
    );
    expect(isThinNearbyAmenityList(amenities)).toBe(false);
  });

  it('falls back to town centre and logs when every token is rejected', async () => {
    vi.stubEnv('MAPBOX_SECRET_TOKEN', '');
    vi.stubEnv('MAPBOX_ACCESS_TOKEN', '');
    vi.stubEnv('MAPBOX_TOKEN', '');
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'pk.restricted');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })),
    );

    const amenities = await fetchNearbyBrochureAmenities({
      latitude: 51.132,
      longitude: 0.264,
      town: 'Tunbridge Wells',
    });

    expect(amenities.map((item) => item.label)).toEqual([
      'Tunbridge Wells town centre',
    ]);
    expect(
      errorSpy.mock.calls.some((args) =>
        args.some(
          (arg) =>
            typeof arg === 'string' &&
            arg.includes('tokenSource=NEXT_PUBLIC_MAPBOX_TOKEN'),
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
