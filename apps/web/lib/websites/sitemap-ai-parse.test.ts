import { describe, expect, it } from 'vitest';

import {
  AiSitemapPagesSchema,
  AiWireframeSectionsSchema,
  materialiseAiSitemapPages,
  materialiseAiWireframeSections,
} from './sitemap-ai-parse';

describe('AiSitemapPagesSchema', () => {
  it('accepts a minimal page tree', () => {
    const parsed = AiSitemapPagesSchema.parse([
      {
        title: 'Home',
        slug: 'home',
        pageType: 'home',
        sections: [
          {
            title: 'Hero',
            sectionType: 'hero',
            description: 'Value prop',
          },
        ],
      },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.title).toBe('Home');
  });

  it('rejects an empty array', () => {
    expect(() => AiSitemapPagesSchema.parse([])).toThrow();
  });
});

describe('materialiseAiSitemapPages', () => {
  it('resolves parentSlug within proposal', () => {
    const pages = materialiseAiSitemapPages([
      {
        title: 'Services',
        slug: 'services',
        description: '',
        pageType: 'service',
        seoIntent: 'services',
        sections: [],
      },
      {
        title: 'SEO',
        slug: 'seo',
        description: '',
        pageType: 'service',
        seoIntent: 'seo agency',
        parentSlug: 'services',
        sections: [],
      },
    ]);

    const services = pages.find((page) => page.slug === 'services');
    const seo = pages.find((page) => page.slug === 'seo');
    expect(services).toBeTruthy();
    expect(seo?.parentId).toBe(services?.id);
  });

  it('shares symbol section titles via componentKey', () => {
    const pages = materialiseAiSitemapPages([
      {
        title: 'Home',
        slug: 'home',
        description: '',
        sections: [
          {
            title: 'Header',
            description: 'Shared nav',
            sectionType: 'nav',
            componentKey: 'site-header',
          },
        ],
      },
      {
        title: 'About',
        slug: 'about',
        description: '',
        sections: [
          {
            title: 'Should become Header',
            description: 'ignored after first',
            sectionType: 'nav',
            componentKey: 'site-header',
          },
        ],
      },
    ]);

    expect(pages[0]?.sections[0]?.title).toBe('Header');
    expect(pages[1]?.sections[0]?.title).toBe('Header');
    expect(pages[0]?.sections[0]?.id).not.toBe(pages[1]?.sections[0]?.id);
  });
});

describe('materialiseAiWireframeSections', () => {
  it('keeps contentNotes separate from copy outline', () => {
    const sections = materialiseAiWireframeSections({
      sitemapSections: [
        { id: 'sec-1', title: 'Hero', description: 'sitemap desc' },
      ],
      rawSections: [
        {
          sitemapSectionTitle: 'Hero',
          title: 'Hero',
          layoutPreset: 'split',
          libraryKey: 'hero-split',
          copyOutline: {
            headline: 'Build faster',
            subhead: 'Ship sites in days',
            ctaLabel: 'Book a call',
          },
          contentNotes: 'Need product screenshot',
          copy: { slots: { headline: 'Build faster' } },
        },
      ],
    });

    expect(sections[0]?.copyOutline).toContain('Build faster');
    expect(sections[0]?.copyOutline).toContain('CTA: Book a call');
    expect(sections[0]?.contentNotes).toBe('Need product screenshot');
    expect(sections[0]?.copy?.slots.headline).toBe('Build faster');
    expect(sections[0]?.layout).toBe('split');
  });

  it('validates wireframe AI schema', () => {
    const parsed = AiWireframeSectionsSchema.parse([
      {
        title: 'Hero',
        layoutPreset: 'full',
        copyOutline: { headline: 'Hi' },
        contentNotes: 'internal',
      },
    ]);
    expect(parsed[0]?.copyOutline).toEqual({ headline: 'Hi' });
  });
});
