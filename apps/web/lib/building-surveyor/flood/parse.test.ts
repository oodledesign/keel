import { describe, expect, it } from 'vitest';

import {
  bandToPlanningZone,
  buildFloodAssessment,
  floodBbox,
  floodPlanningZoneLabel,
  floodRiskBandLabel,
  isEnglandCountry,
  isNonEnglandUkCountry,
  mapSurveyFloodRow,
  parseFloodMonitoringWarnings,
  parseFloodZoneCode,
  parseOgcFloodZoneFeatures,
  planningZoneToBand,
  resolvePlanningZone,
  summarisePlanningFloodAssessment,
} from './parse';

describe('flood Map for Planning parse', () => {
  it('builds a tight bbox around a point', () => {
    expect(floodBbox(-2.361, 51.378)).toBe('-2.3614,51.3776,-2.3606,51.3784');
  });

  it('parses EA flood_zone property values', () => {
    expect(parseFloodZoneCode('FZ3')).toBe('zone_3');
    expect(parseFloodZoneCode('Flood Zone 2')).toBe('zone_2');
    expect(parseFloodZoneCode('zone_1')).toBe('zone_1');
    expect(parseFloodZoneCode(3)).toBe('zone_3');
    expect(parseFloodZoneCode('unknown')).toBeNull();
  });

  it('maps planning zones onto the stored band column', () => {
    expect(planningZoneToBand('zone_1')).toBe('very_low');
    expect(planningZoneToBand('zone_2')).toBe('medium');
    expect(planningZoneToBand('zone_3')).toBe('high');
    expect(bandToPlanningZone('very_low')).toBe('zone_1');
    expect(bandToPlanningZone('medium')).toBe('zone_2');
    expect(bandToPlanningZone('high')).toBe('zone_3');
    expect(bandToPlanningZone('low')).toBe('zone_1');
    expect(floodPlanningZoneLabel('zone_3')).toBe('Zone 3');
    expect(floodRiskBandLabel('high')).toBe('Zone 3');
    expect(floodRiskBandLabel('low')).toBe('Low (legacy)');
  });

  it('treats Zone 3 as higher than Zone 2 and ignores Zone 1 polygons', () => {
    expect(
      parseOgcFloodZoneFeatures({
        features: [
          { properties: { flood_zone: 'FZ2', flood_source: 'river' } },
          {
            properties: {
              flood_zone: 'FZ3',
              flood_source: 'river and sea',
            },
          },
          { properties: { flood_zone: 'FZ1', flood_source: 'river' } },
        ],
      }),
    ).toEqual({
      hits: [
        { zone: 'zone_2', floodSource: 'river', origin: null },
        { zone: 'zone_3', floodSource: 'river and sea', origin: null },
      ],
      highestZone: 'zone_3',
    });
    expect(
      parseOgcFloodZoneFeatures({ features: [], numberMatched: 0 }),
    ).toEqual({ hits: [], highestZone: null });
  });

  it('resolves Zone 1 only when the point is confirmed in England', () => {
    expect(
      resolvePlanningZone({
        highestIntersectedZone: 'zone_3',
        country: 'England',
      }),
    ).toEqual({ planningZone: 'zone_3', coverage: 'england' });
    expect(
      resolvePlanningZone({
        highestIntersectedZone: null,
        country: 'England',
      }),
    ).toEqual({ planningZone: 'zone_1', coverage: 'england' });
    expect(
      resolvePlanningZone({
        highestIntersectedZone: null,
        country: 'Wales',
      }),
    ).toEqual({ planningZone: null, coverage: 'not_england' });
    expect(
      resolvePlanningZone({
        highestIntersectedZone: 'zone_2',
        country: 'Scotland',
      }),
    ).toEqual({ planningZone: null, coverage: 'not_england' });
    expect(
      resolvePlanningZone({
        highestIntersectedZone: null,
        country: null,
      }),
    ).toEqual({ planningZone: null, coverage: 'unknown' });
    expect(isEnglandCountry('England')).toBe(true);
    expect(isNonEnglandUkCountry('Northern Ireland')).toBe(true);
  });

  it('summarises auto-pulled copy in British English', () => {
    expect(
      summarisePlanningFloodAssessment({
        planningZone: 'zone_1',
        coverage: 'england',
        country: 'England',
        floodSource: null,
        liveWarnings: [],
      }),
    ).toMatch(/Zone 1/);
    expect(
      summarisePlanningFloodAssessment({
        planningZone: 'zone_2',
        coverage: 'england',
        country: 'England',
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
    expect(
      summarisePlanningFloodAssessment({
        planningZone: null,
        coverage: 'not_england',
        country: 'Wales',
        floodSource: null,
        liveWarnings: [],
      }),
    ).toMatch(/England only/);
  });

  it('builds an assessment from Zone 2/3 hits', () => {
    const assessment = buildFloodAssessment({
      latitude: 53.961573,
      longitude: -1.08191,
      postcode: 'YO1 7HH',
      country: 'England',
      zoneHits: [
        {
          zone: 'zone_3',
          floodSource: 'river',
          origin: 'modelled',
        },
      ],
      highestIntersectedZone: 'zone_3',
      liveWarnings: [],
      endpoint: 'https://example.test',
    });
    expect(assessment.planningZone).toBe('zone_3');
    expect(assessment.band).toBe('high');
    expect(assessment.coverage).toBe('england');
    expect(assessment.disclaimer).toMatch(/not a property-specific/);
    expect(floodRiskBandLabel(assessment.band)).toBe('Zone 3');
  });

  it('does not invent Zone 1 for Wales', () => {
    const assessment = buildFloodAssessment({
      latitude: 51.479,
      longitude: -3.178,
      postcode: 'CF10 1AA',
      country: 'Wales',
      zoneHits: [],
      highestIntersectedZone: null,
      liveWarnings: [],
      endpoint: 'https://example.test',
    });
    expect(assessment.planningZone).toBeNull();
    expect(assessment.band).toBeNull();
    expect(assessment.coverage).toBe('not_england');
    expect(assessment.summary).toMatch(/Wales/);
  });

  it('maps stored survey rows including pulled planning zones', () => {
    const record = mapSurveyFloodRow({
      survey_flood_risk_band: 'high',
      survey_flood_risk_summary: 'Zone 3 at this point.',
      survey_flood_source: 'gov_uk',
      survey_flood_fetched_at: '2026-09-17T12:00:00.000Z',
      survey_flood_raw_json: {
        pulled: {
          band: 'high',
          planningZone: 'zone_3',
          coverage: 'england',
          country: 'England',
        },
      },
    });
    expect(record.planningZone).toBe('zone_3');
    expect(record.coverage).toBe('england');
    expect(record.pulledBand).toBe('high');
    expect(record.overridden).toBe(false);
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
