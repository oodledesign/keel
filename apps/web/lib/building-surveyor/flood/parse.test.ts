import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  combineFloodLookup,
  floodZoneSummary,
  normalizeFloodZone,
  parseFloodWarnings,
  wfsHasIntersectingFeatures,
} from './parse';

const fixturesDir = dirname(fileURLToPath(import.meta.url));

function readFixture(name: string) {
  return JSON.parse(
    readFileSync(join(fixturesDir, 'fixtures', name), 'utf8'),
  ) as unknown;
}

describe('normalizeFloodZone', () => {
  it('accepts digits and layer labels', () => {
    expect(normalizeFloodZone(3)).toBe('3');
    expect(normalizeFloodZone('2')).toBe('2');
    expect(normalizeFloodZone('Flood Zone 3')).toBe('3');
    expect(normalizeFloodZone('floodzone2')).toBe('2');
    expect(normalizeFloodZone('not a zone')).toBeNull();
  });
});

describe('wfsHasIntersectingFeatures', () => {
  it('treats a populated FeatureCollection as a hit', () => {
    expect(wfsHasIntersectingFeatures(readFixture('zone-3.json'))).toBe(true);
    expect(wfsHasIntersectingFeatures(readFixture('empty-zone.json'))).toBe(
      false,
    );
  });
});

describe('parseFloodWarnings', () => {
  it('reads flood-monitoring items', () => {
    const warnings = parseFloodWarnings(readFixture('warnings.json'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      severity: 'Flood Alert',
      severityLevel: 3,
      description: 'Flood alert in force for the River Irwell',
    });
  });
});

describe('combineFloodLookup', () => {
  it('prefers Zone 3 when both layers hit', () => {
    const result = combineFloodLookup({
      zone3: readFixture('zone-3.json'),
      zone2: readFixture('zone-2.json'),
      warnings: { items: [] },
    });
    expect(result.floodZone).toBe('3');
    expect(result.riversAndSea).toBe('High');
    expect(result.summary).toContain('Flood Zone 3');
    expect(result.summary).toContain('No current Environment Agency');
    expect(result.source).toBe('flood-map-for-planning');
  });

  it('returns Zone 2 when only the Zone 2 layer intersects', () => {
    const result = combineFloodLookup({
      zone3: readFixture('empty-zone.json'),
      zone2: readFixture('zone-2.json'),
    });
    expect(result.floodZone).toBe('2');
    expect(result.riversAndSea).toBe('Medium');
  });

  it('returns Zone 1 when neither planning layer intersects', () => {
    const result = combineFloodLookup({
      zone3: readFixture('empty-zone.json'),
      zone2: readFixture('empty-zone.json'),
    });
    expect(result.floodZone).toBe('1');
    expect(result.riversAndSea).toBe('Low');
    expect(result.activeWarnings).toEqual([]);
  });

  it('mentions nearby warnings in the summary', () => {
    const result = combineFloodLookup({
      zone3: readFixture('empty-zone.json'),
      zone2: readFixture('empty-zone.json'),
      warnings: readFixture('warnings.json'),
    });
    expect(result.activeWarnings).toHaveLength(1);
    expect(result.summary).toContain(
      '1 current Environment Agency flood warning',
    );
  });
});

describe('floodZoneSummary', () => {
  it('uses British English planning-zone wording', () => {
    expect(floodZoneSummary('1')).toMatch(/low probability/i);
    expect(floodZoneSummary('2')).toMatch(/medium probability/i);
    expect(floodZoneSummary('3', 2)).toMatch(/2 current/i);
  });
});
