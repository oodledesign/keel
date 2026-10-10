import { beforeAll, describe, expect, it } from 'vitest';

import junctions from '../data/uk-motorway-junctions.json';
import places from '../data/uk-places.json';
import stations from '../data/uk-stations.json';
import { lookupLocalAreaFacts } from '../local-area';
import {
  type LocalAreaFacts,
  buildLocationSummary,
  localAreaAmenities,
  localAreaFactLines,
  motorwayProseName,
  proseDistance,
  shortDistance,
} from '../local-area.shared';

const OTFORD = { latitude: 51.3129, longitude: 0.1903, town: 'Sevenoaks' };

describe('distance wording', () => {
  it('formats list distances', () => {
    expect(shortDistance(0.05)).toBe('< 0.1 mi');
    expect(shortDistance(4.5)).toBe('2.8 mi');
    expect(shortDistance(40)).toBe('25 mi');
  });

  it('formats prose distances the way agents write them', () => {
    expect(proseDistance(0.45)).toBe('500 yards');
    expect(proseDistance(1.6)).toBe('1 mile');
    expect(proseDistance(4.5)).toBe('3 miles');
    expect(proseDistance(6.5)).toBe('4 miles');
  });

  it('turns junction labels into prose', () => {
    expect(motorwayProseName('M25 Junction 4')).toBe('Junction 4 of the M25');
  });
});

describe('lookupLocalAreaFacts (Otford)', () => {
  let facts: LocalAreaFacts;
  beforeAll(async () => {
    facts = (await lookupLocalAreaFacts(OTFORD))!;
  });

  it('finds the nearest station, motorways, town and an airport', () => {
    expect(facts).not.toBeNull();
    const byKind = (kind: string) =>
      facts.places.filter((place) => place.kind === kind).map((p) => p.name);

    expect(byKind('station')[0]).toBe('Otford station');
    expect(byKind('town')).toEqual(['Sevenoaks']);
    expect(byKind('motorway')).toHaveLength(2);
    expect(
      byKind('motorway').every((name) => /^M\d+ Junction /.test(name)),
    ).toBe(true);
    expect(byKind('airport')).toHaveLength(1);
    expect(facts.locality).toBe('Otford');
  });

  it('writes a factual location paragraph', () => {
    const summary = buildLocationSummary(facts, OTFORD.town);
    expect(summary).toMatch(
      /^The property is situated in Otford, approximately 3 miles north of Sevenoaks town centre\./,
    );
    expect(summary).toContain('Otford station is approximately');
    expect(summary).toContain('minute walk');
  });

  it('numbers amenities stations first, with coordinates for map pins', () => {
    const amenities = localAreaAmenities(facts, 6);
    expect(amenities[0]).toMatchObject({ index: 1 });
    expect(amenities[0]!.label).toMatch(
      /^Otford station · 0\.\d mi · \d+ min walk$/,
    );
    for (const item of amenities) {
      expect(Number.isFinite(item.latitude)).toBe(true);
      expect(Number.isFinite(item.longitude)).toBe(true);
    }
  });

  it('labels AI facts as straight-line distances', () => {
    const lines = localAreaFactLines(facts);
    expect(lines[0]).toBe('Locality: Otford');
    expect(
      lines.slice(1).every((line) => line.endsWith('(straight-line)')),
    ).toBe(true);
  });

  it('returns null away from the UK', async () => {
    expect(
      await lookupLocalAreaFacts({ latitude: 48.85, longitude: 2.35 }),
    ).toBeNull();
  });
});

describe('bundled datasets', () => {
  const isLat = (n: unknown) => typeof n === 'number' && n > 49 && n < 61;
  const isLng = (n: unknown) => typeof n === 'number' && n > -9 && n < 2.5;

  it('have the tuple shapes local-area.ts casts them to', () => {
    for (const row of stations as unknown[][]) {
      expect(typeof row[0]).toBe('string');
      expect(isLat(row[1]) && isLng(row[2])).toBe(true);
    }
    for (const row of junctions as unknown[][]) {
      expect(row[0]).toMatch(/^(M\d+( Toll)?|A\d+\(M\))$/);
      expect(typeof row[1]).toBe('string');
      expect(isLat(row[2]) && isLng(row[3])).toBe(true);
    }
    for (const row of places as unknown[][]) {
      expect(typeof row[0]).toBe('string');
      expect(isLat(row[1]) && isLng(row[2])).toBe(true);
      expect(['c', 't', 'v', 's']).toContain(row[3]);
    }
  });
});

describe('buildLocationSummary', () => {
  it('says "in <town>" when the property is in the town centre', () => {
    const facts: LocalAreaFacts = {
      locality: null,
      places: [
        {
          kind: 'town',
          name: 'Tonbridge',
          km: 0.3,
          latitude: 51.19,
          longitude: 0.27,
          bearing: 0,
        },
      ],
    };
    expect(buildLocationSummary(facts, 'Tonbridge')).toBe(
      'The property is situated in Tonbridge town centre.',
    );
  });
});
