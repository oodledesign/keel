import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  bandFromScore,
  extractUkPostcode,
  normalizeCertificateNumber,
  normalizeUkPostcode,
  normalizeUprn,
  parseEpcCertificate,
  parseEpcSearchHits,
  summarizeRecommendations,
} from './parse';

const fixturesDir = dirname(fileURLToPath(import.meta.url));

function readFixture(name: string) {
  return JSON.parse(
    readFileSync(join(fixturesDir, 'fixtures', name), 'utf8'),
  ) as unknown;
}

describe('normalize helpers', () => {
  it('normalises UK postcodes from loose address text', () => {
    expect(extractUkPostcode('12 Example Street, m204ap')).toBe('M20 4AP');
    expect(normalizeUkPostcode('ls1 4ap')).toBe('LS1 4AP');
    expect(extractUkPostcode('No postcode here')).toBeNull();
  });

  it('normalises UPRNs and certificate numbers', () => {
    expect(normalizeUprn('000001234567')).toBe('1234567');
    expect(normalizeUprn(10094703381)).toBe('10094703381');
    expect(normalizeCertificateNumber('11112222333344445555')).toBe(
      '1111-2222-3333-4444-5555',
    );
    expect(normalizeCertificateNumber('not-a-number')).toBeNull();
  });

  it('keeps only the ISO date portion of lodgement timestamps', () => {
    expect(
      parseEpcCertificate({
        data: { registration_date: '2025-08-18 20:54:31.000000' },
      })?.lodgementDate,
    ).toBe('2025-08-18');
  });

  it('maps SAP scores to official bands', () => {
    expect(bandFromScore(92)).toBe('A');
    expect(bandFromScore(72)).toBe('C');
    expect(bandFromScore(50)).toBe('E');
    expect(bandFromScore(0)).toBeNull();
  });
});

describe('parseEpcSearchHits', () => {
  it('reads official camelCase search fixtures', () => {
    const hits = parseEpcSearchHits(readFixture('domestic-search.json'));
    expect(hits).toHaveLength(3);
    expect(hits[0]).toMatchObject({
      certificateNumber: '1111-2222-3333-4444-5555',
      addressLine1: '12 Example Street',
      postcode: 'M20 4AP',
      uprn: '10094703381',
      currentEnergyEfficiencyBand: 'D',
    });
  });

  it('ignores rows without a certificate number', () => {
    const hits = parseEpcSearchHits({
      data: [{ addressLine1: 'Ghost House', postcode: 'M20 4AP' }],
    });
    expect(hits).toEqual([]);
  });
});

describe('parseEpcCertificate', () => {
  it('extracts ratings, floor area, fuel and recommendations from RdSAP JSON', () => {
    const summary = parseEpcCertificate(
      readFixture('rdsap-certificate.json'),
      '0000-1672-0000-1732-0000',
    );

    expect(summary).toMatchObject({
      certificateNumber: '0000-1672-0000-1732-0000',
      uprn: '10094703381',
      currentRating: 'E',
      potentialRating: 'C',
      currentScore: 50,
      potentialScore: 72,
      floorArea: 55,
      fuelType: 'Boiler and radiators, mains gas',
      lodgementDate: '2023-12-01',
    });
    expect(summary?.recommendations).toHaveLength(2);
    expect(summary?.recommendations[0]?.description).toMatch(
      /loft insulation/i,
    );
    expect(summary?.recommendationsSummary).toMatch(/Cavity wall insulation/);
  });

  it('falls back to score-derived bands when the band field is missing', () => {
    const summary = parseEpcCertificate({
      data: {
        energy_rating_current: 81,
        energy_rating_potential: 94,
      },
    });
    expect(summary?.currentRating).toBe('B');
    expect(summary?.potentialRating).toBe('A');
  });

  it('summarises recommendations with savings', () => {
    expect(
      summarizeRecommendations([
        {
          sequence: 1,
          description: 'Loft insulation',
          typicalSaving: '£360',
          indicativeCost: '£100 - £350',
        },
      ]),
    ).toBe('Loft insulation (£100 - £350, typical saving £360)');
  });
});
