import { describe, expect, it } from 'vitest';

import {
  buildFloodAssessment,
  classifyRiversAndSeaBand,
  floodBbox,
  floodRiskBandLabel,
  parseFloodMonitoringWarnings,
  parseOgcFeatureCount,
  summariseFloodAssessment,
} from './parse';
import { EA_RIVERS_SEA_COLLECTIONS } from './types';

describe('flood risk parse', () => {
  it('builds a tight bbox around a point', () => {
    expect(floodBbox(-2.361, 51.378)).toBe('-2.3614,51.3776,-2.3606,51.3784');
  });

  it('classifies rivers-and-sea extents into long-term bands', () => {
    expect(
      classifyRiversAndSeaBand({ mediumExtent: true, lowExtent: true }),
    ).toBe('medium');
    expect(
      classifyRiversAndSeaBand({ mediumExtent: false, lowExtent: true }),
    ).toBe('low');
    expect(
      classifyRiversAndSeaBand({ mediumExtent: false, lowExtent: false }),
    ).toBe('very_low');
  });

  it('reads OGC Features hits and flood_source', () => {
    expect(
      parseOgcFeatureCount({
        features: [{ properties: { flood_source: 'river' } }],
        numberMatched: 1,
      }),
    ).toEqual({ hit: true, floodSource: 'river' });
    expect(parseOgcFeatureCount({ features: [], numberMatched: 0 })).toEqual({
      hit: false,
      floodSource: null,
    });
  });

  it('summarises auto-pulled copy in British English', () => {
    expect(
      summariseFloodAssessment({
        band: 'very_low',
        floodSource: null,
        liveWarnings: [],
      }),
    ).toMatch(/Very low long-term flood risk/);
    expect(
      summariseFloodAssessment({
        band: 'medium',
        floodSource: 'river',
        liveWarnings: [
          {
            severity: 'Flood Alert',
            severityLevel: 3,
            label: 'River Avon at Bath',
            description: null,
          },
        ],
      }),
    ).toMatch(/Current Environment Agency warning nearby: River Avon at Bath/);
  });

  it('builds an assessment from layer hits', () => {
    const assessment = buildFloodAssessment({
      latitude: 51.378,
      longitude: -2.361,
      postcode: 'BA1 1UA',
      layers: [
        {
          collection: EA_RIVERS_SEA_COLLECTIONS.medium,
          floodSource: 'river',
        },
      ],
      liveWarnings: [],
      endpoint: 'https://example.test',
    });
    expect(assessment.band).toBe('medium');
    expect(assessment.riversAndSea.mediumExtent).toBe(true);
    expect(floodRiskBandLabel(assessment.band)).toBe('Medium');
  });

  it('parses flood-monitoring warning items', () => {
    const warnings = parseFloodMonitoringWarnings({
      items: [
        {
          severity: 'Flood Alert',
          severityLevel: 3,
          description: 'Upper Bristol Avon Area',
          message: 'River levels are high.',
        },
      ],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.label).toBe('Upper Bristol Avon Area');
  });
});
