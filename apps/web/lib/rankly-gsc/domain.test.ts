import { describe, expect, it } from 'vitest';

import {
  normalizeDomainHost,
  normalizeSearchQuery,
  pickBestGscProperty,
} from './domain';

describe('rankly-gsc domain helpers', () => {
  it('normalizes hosts from urls and sc-domain properties', () => {
    expect(normalizeDomainHost('https://www.Example.com/path')).toBe(
      'example.com',
    );
    expect(normalizeDomainHost('sc-domain:example.com')).toBe('example.com');
    expect(normalizeDomainHost('example.com')).toBe('example.com');
  });

  it('picks domain property over URL property', () => {
    expect(
      pickBestGscProperty(
        [
          'https://www.example.com/',
          'sc-domain:example.com',
          'http://example.com/',
        ],
        'www.example.com',
      ),
    ).toBe('sc-domain:example.com');
  });

  it('falls back to https URL property', () => {
    expect(
      pickBestGscProperty(
        ['http://example.com/', 'https://www.example.com/'],
        'example.com',
      ),
    ).toBe('https://www.example.com/');
  });

  it('normalizes search queries', () => {
    expect(normalizeSearchQuery('  SEO  Agency  ')).toBe('seo agency');
  });
});
