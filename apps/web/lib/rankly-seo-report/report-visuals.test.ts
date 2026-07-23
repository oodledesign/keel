import { describe, expect, it } from 'vitest';

import {
  buildOverallPotential,
  buildPillarPotentials,
  estimatePotentialScore,
} from './report-visuals';
import type { SeoReportSnapshot } from './types';

function baseSnapshot(
  overrides: Partial<SeoReportSnapshot> = {},
): SeoReportSnapshot {
  return {
    version: 1,
    generatedAt: '2026-07-23T00:00:00.000Z',
    targetDomain: 'example.com',
    title: 'SEO Report',
    overallScore: 42,
    executiveSummary: null,
    pillars: [
      {
        id: 'entity',
        label: 'Entity',
        score: 40,
        available: true,
      },
      {
        id: 'techFoundation',
        label: 'Technical foundation',
        score: 35,
        available: true,
      },
      {
        id: 'content',
        label: 'Content',
        score: 80,
        available: true,
      },
    ],
    recommendations: [
      {
        dimension: 'entity',
        priority: 'high',
        isQuickWin: true,
        title: 'Add Organization schema',
        description: '…',
        outcome: 'Clearer brand recognition',
      },
      {
        dimension: 'tech',
        priority: 'high',
        isQuickWin: false,
        title: 'Fix sitemap',
        description: '…',
        outcome: null,
      },
    ],
    appendix: {
      crawlIssues: [],
      keywords: [],
      pagespeed: { mobile: null, desktop: null, available: false },
      authority: {
        domainPower: null,
        linkTrust: null,
        referringDomains: null,
        brandSignal: null,
        available: false,
      },
      pages: { pageCount: 0, avgOverall: null, available: false },
    },
    sources: {
      aiAudit: true,
      siteExplorer: false,
      pagespeed: false,
      siteCrawl: false,
      pages: false,
      keywords: false,
    },
    ...overrides,
  };
}

describe('estimatePotentialScore', () => {
  it('returns null when current is null', () => {
    expect(estimatePotentialScore(null, 20)).toBeNull();
  });

  it('caps uplift and never exceeds 95', () => {
    expect(estimatePotentialScore(80, 50)).toBe(95);
  });

  it('keeps strong scores stable when boost is 0', () => {
    expect(estimatePotentialScore(82, 0)).toBe(82);
  });
});

describe('buildPillarPotentials', () => {
  it('lifts pillars tied to recommendations', () => {
    const pillars = buildPillarPotentials(baseSnapshot());
    const entity = pillars.find((p) => p.id === 'entity');
    const tech = pillars.find((p) => p.id === 'techFoundation');
    const content = pillars.find((p) => p.id === 'content');

    expect(entity?.current).toBe(40);
    expect(entity?.potential).toBeGreaterThan(40);
    expect(tech?.potential).toBeGreaterThan(35);
    expect(content?.potential).toBe(80);
  });
});

describe('buildOverallPotential', () => {
  it('shows uplift above the current overall score', () => {
    const snapshot = baseSnapshot();
    const pillars = buildPillarPotentials(snapshot);
    const overall = buildOverallPotential(snapshot, pillars);

    expect(overall.current).toBe(42);
    expect(overall.potential).toBeGreaterThan(42);
    expect(overall.uplift).toBeGreaterThan(0);
  });
});
