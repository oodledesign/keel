import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  COMMERCIAL_FEATURE_TOUR_BLOCKS,
  COMMERCIAL_HOME_FAQ_QUESTIONS,
} from './commercial-home-content';
import type { getCommercialHomePricing as GetPricing } from './commercial-home-pricing';
import { FEATURE_TOUR_BLOCKS } from './feature-tour-content';
import { parseLaunchInterestSource } from './launch-interest';
import type { getSegmentLandingConfig as GetSegmentConfig } from './segment-landing-pages';

let getCommercialHomePricing: typeof GetPricing;
let getSegmentLandingConfig: typeof GetSegmentConfig;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_BILLING_PROVIDER', 'stripe');
  ({ getCommercialHomePricing } = await import('./commercial-home-pricing'));
  ({ getSegmentLandingConfig } = await import('./segment-landing-pages'));
});

describe('getCommercialHomePricing', () => {
  it('derives labels from the graduated tiers', () => {
    const pricing = getCommercialHomePricing();

    expect(pricing.fromLabel).toBe('£89');
    expect(pricing.bands.map((band) => band.unitLabel)).toEqual([
      '£89',
      '£55',
      '£39',
    ]);
  });

  it('uses the highlighted team tier as the worked example', () => {
    const { example } = getCommercialHomePricing();

    expect(example.seats).toBe(4);
    expect(example.totalLabel).toBe('£254');
    expect(example.supportSeats).toBe(2);
    expect(example.workedLabel).toContain('£89 + 3 × £55');
  });
});

describe('COMMERCIAL_FEATURE_TOUR_BLOCKS', () => {
  it('has unique ids that do not clash with the studio tour', () => {
    const commercialIds = COMMERCIAL_FEATURE_TOUR_BLOCKS.map((b) => b.id);
    const studioIds = new Set(FEATURE_TOUR_BLOCKS.map((b) => b.id));

    expect(new Set(commercialIds).size).toBe(commercialIds.length);
    expect(commercialIds.filter((id) => studioIds.has(id))).toEqual([]);
  });
});

describe('COMMERCIAL_HOME_FAQ_QUESTIONS', () => {
  it('only references questions that exist on the commercial page', () => {
    const questions = new Set(
      getSegmentLandingConfig('commercial-property')?.faqs.map(
        (faq) => faq.question,
      ),
    );

    for (const question of COMMERCIAL_HOME_FAQ_QUESTIONS) {
      expect(questions.has(question), question).toBe(true);
    }
  });
});

describe('parseLaunchInterestSource', () => {
  it('accepts known sources', () => {
    expect(parseLaunchInterestSource('home-hero')).toBe('home-hero');
    expect(parseLaunchInterestSource('home-final')).toBe('home-final');
  });

  it('falls back to coming-soon for anything else', () => {
    expect(parseLaunchInterestSource(undefined)).toBe('coming-soon');
    expect(parseLaunchInterestSource('admin')).toBe('coming-soon');
    expect(parseLaunchInterestSource(42)).toBe('coming-soon');
  });
});
