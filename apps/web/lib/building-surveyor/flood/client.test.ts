import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchPlanningFloodZones } from './client';
import { floodBbox } from './parse';
import { EA_FLOOD_ZONES_COLLECTION } from './types';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchPlanningFloodZones', () => {
  it('returns Zone 3 when the EA collection intersects FZ3 in England', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('postcodes.io')) {
        return jsonResponse({
          result: [{ country: 'England', postcode: 'YO1 7HH' }],
        });
      }
      if (url.includes(EA_FLOOD_ZONES_COLLECTION)) {
        return jsonResponse({
          features: [
            { properties: { flood_zone: 'FZ2', flood_source: 'river' } },
            { properties: { flood_zone: 'FZ3', flood_source: 'river' } },
          ],
        });
      }
      if (url.includes('/id/floods')) {
        return jsonResponse({ items: [] });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const assessment = await fetchPlanningFloodZones({
      latitude: 53.9615,
      longitude: -1.0819,
    });

    expect(assessment.planningZone).toBe('zone_3');
    expect(assessment.band).toBe('high');
    expect(assessment.coverage).toBe('england');
    expect(assessment.summary).toMatch(/Zone 3/);
    const zoneUrl = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .find((url) => url.includes(EA_FLOOD_ZONES_COLLECTION));
    expect(zoneUrl).toContain(`bbox=${floodBbox(-1.0819, 53.9615)}`);
    expect(zoneUrl).not.toContain('%2C');
  });

  it('returns Zone 1 when England has no Zone 2 or 3 polygon', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('postcodes.io')) {
        return jsonResponse({
          result: {
            country: 'England',
            postcode: 'SN1 3ER',
            latitude: 51.558,
            longitude: -1.785,
          },
        });
      }
      if (url.includes(EA_FLOOD_ZONES_COLLECTION)) {
        return jsonResponse({ features: [], numberMatched: 0 });
      }
      if (url.includes('/id/floods')) {
        return jsonResponse({ items: [] });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const assessment = await fetchPlanningFloodZones({
      postcode: 'SN1 3ER',
    });

    expect(assessment.planningZone).toBe('zone_1');
    expect(assessment.band).toBe('very_low');
    expect(assessment.coverage).toBe('england');
  });

  it('does not query EA or invent Zone 1 for Wales', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('postcodes.io')) {
        return jsonResponse({
          result: {
            country: 'Wales',
            postcode: 'CF10 1AA',
            latitude: 51.479,
            longitude: -3.178,
          },
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const assessment = await fetchPlanningFloodZones({
      postcode: 'CF10 1AA',
    });

    expect(assessment.planningZone).toBeNull();
    expect(assessment.band).toBeNull();
    expect(assessment.coverage).toBe('not_england');
    expect(assessment.summary).toMatch(/Wales/);
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes('environment.data.gov.uk'),
      ),
    ).toBe(false);
  });
});
