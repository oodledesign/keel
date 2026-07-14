import { describe, expect, it } from 'vitest';

import {
  emptyWebsiteSeoPageSeo,
  normalizeWebsiteSeoPageSeo,
  seoCompleteness,
} from './seo-types';

describe('normalizeWebsiteSeoPageSeo', () => {
  it('migrates legacy flat fields', () => {
    const seo = normalizeWebsiteSeoPageSeo({
      primaryKeyword: 'church near me',
      secondaryKeywords: 'sunday, gospel',
      title: 'Welcome',
      metaDescription: 'Desc',
      h1: 'Hello',
      headingOutline: 'H2: Times',
      internalLinks: 'about — Visit',
      schemaTypes: ['Organization'],
      answerBlocks: [{ question: 'When?', answer: 'Sunday' }],
      entityNotes: 'Parish',
    });

    expect(seo.keywords.primary).toBe('church near me');
    expect(seo.keywords.secondary).toEqual(['sunday', 'gospel']);
    expect(seo.meta.title).toBe('Welcome');
    expect(seo.headingOutline[0]).toMatchObject({ level: 1, text: 'Hello' });
    expect(seo.internalLinks[0]?.toSlug).toBe('about');
    expect(seo.aeo.answerBlocks[0]?.draftAnswer).toBe('Sunday');
  });

  it('keeps nested E1 shape', () => {
    const empty = emptyWebsiteSeoPageSeo();
    empty.keywords.primary = 'x';
    expect(normalizeWebsiteSeoPageSeo(empty).keywords.primary).toBe('x');
  });
});

describe('seoCompleteness', () => {
  it('scores empty as low and filled as higher', () => {
    expect(seoCompleteness(emptyWebsiteSeoPageSeo())).toBe(0);
    const filled = emptyWebsiteSeoPageSeo();
    filled.keywords.primary = 'a';
    filled.keywords.secondary = ['b'];
    filled.meta.title = 't';
    filled.meta.description = 'd';
    filled.headingOutline = [{ level: 1, text: 'H' }];
    filled.internalLinks = [{ toSlug: 'about', anchorSuggestion: 'About' }];
    filled.schemaTypes = ['Organization'];
    filled.aeo.answerBlocks = [{ question: 'Q', draftAnswer: 'A' }];
    filled.aeo.entityNotes = 'e';
    filled.slugRule = '/about';
    expect(seoCompleteness(filled)).toBe(100);
  });
});
