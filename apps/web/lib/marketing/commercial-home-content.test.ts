import { describe, expect, it } from 'vitest';

import {
  COMMERCIAL_SIX_JOBS_PANELS,
  getCommercialHomeFaqs,
  getCommercialPricingData,
} from './commercial-home-content';
import { parseLaunchInterestSource } from './launch-interest';

describe('getCommercialPricingData', () => {
  it('derives labels from the graduated tiers', () => {
    const pricing = getCommercialPricingData();

    expect(pricing.body).toContain('£89 for seat 1');
    expect(pricing.bands.map((band) => band.price)).toEqual([
      '£89/mo',
      '£55/mo each',
      '£39/mo each',
    ]);
  });
});

describe('COMMERCIAL_SIX_JOBS_PANELS', () => {
  it('has exactly six panels with unique ids and labels', () => {
    expect(COMMERCIAL_SIX_JOBS_PANELS).toHaveLength(6);
    const ids = COMMERCIAL_SIX_JOBS_PANELS.map((p) => p.id);
    expect(new Set(ids).size).toBe(6);
  });
});

describe('getCommercialHomeFaqs', () => {
  it('returns exactly six FAQs with concise answers', () => {
    const faqs = getCommercialHomeFaqs();
    expect(faqs).toHaveLength(6);

    for (const faq of faqs) {
      const words = faq.answer.split(/\s+/).filter(Boolean).length;
      expect(words).toBeLessThanOrEqual(45);
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
