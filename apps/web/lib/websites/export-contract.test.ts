import { describe, expect, it } from 'vitest';

import { emptyWebsiteBrief } from './brief-types';
import {
  SITE_STUDIO_EXPORT_SCHEMA_VERSION,
  type SiteStudioExportSources,
  assertCompatibleExportSchemaVersion,
  buildExport,
} from './export-contract';
import { emptyWebsiteStyleSystem } from './planning-types';

const GENERATED_AT = '2026-07-14T12:00:00.000Z';
const WEBSITE_ID = '11111111-1111-1111-1111-111111111111';

function briefOnlySources(): SiteStudioExportSources {
  const brief = emptyWebsiteBrief();
  brief.org.name = 'Acme Chapel';
  brief.org.oneLiner = 'Local church with a clear gospel invitation';
  brief.stackPreference = 'astro';

  return {
    generatedAt: GENERATED_AT,
    website: {
      id: WEBSITE_ID,
      name: 'Acme Chapel site',
      domain: 'acmechapel.example',
      sitemap: [],
      wireframes: [],
    },
    brief,
    styleTokens: null,
    seoPages: [],
    contentDocs: [],
  };
}

function fullSources(): SiteStudioExportSources {
  const brief = emptyWebsiteBrief();
  brief.org.name = 'Acme Chapel';
  brief.stackPreference = 'next';
  brief.offer.primaryConversionGoals = ['Book a visit'];

  const tokens = emptyWebsiteStyleSystem().tokens;
  tokens.colors.accent = '#FF5C34';
  tokens.typography.displayFamily = 'Fraunces';

  return {
    generatedAt: GENERATED_AT,
    website: {
      id: WEBSITE_ID,
      name: 'Acme Chapel site',
      domain: 'acmechapel.example',
      sitemap: [
        {
          id: 'page-home',
          title: 'Home',
          slug: 'home',
          pageType: 'home',
          status: 'approved',
          description: 'Landing page',
          parentId: null,
          sections: [
            {
              id: 'sec-nav',
              title: 'Header',
              description: '',
              sectionType: 'nav',
              componentKey: 'site-header',
              status: 'approved',
            },
            {
              id: 'sec-hero',
              title: 'Hero',
              description: '',
              sectionType: 'hero',
              status: 'draft',
            },
            {
              id: 'sec-footer',
              title: 'Footer',
              description: '',
              sectionType: 'footer',
              componentKey: 'site-footer',
              status: 'draft',
            },
          ],
        },
        {
          id: 'page-about',
          title: 'About',
          slug: 'about',
          pageType: 'about',
          status: 'draft',
          parentId: 'page-home',
          sections: [
            {
              id: 'sec-about-content',
              title: 'Story',
              description: '',
              sectionType: 'content',
              status: 'draft',
            },
          ],
        },
      ],
      wireframes: [
        {
          id: 'wf-home',
          pageId: 'page-home',
          title: 'Home',
          sections: [
            {
              id: 'wf-nav',
              sitemapSectionId: 'sec-nav',
              title: 'Header',
              layout: 'full',
              contentNotes: '',
              libraryKey: 'nav-simple',
              copyOutline: 'Logo + Visit + Give',
              copy: {
                slots: { logoText: 'Acme', cta: 'Visit' },
              },
            },
            {
              id: 'wf-hero',
              sitemapSectionId: 'sec-hero',
              title: 'Hero',
              layout: 'split',
              contentNotes: '',
              libraryKey: 'hero-split',
              copyOutline: 'Welcome headline + CTA',
              copy: {
                slots: {
                  headline: 'You are welcome here',
                  cta: 'Plan a visit',
                },
              },
            },
            {
              id: 'wf-footer',
              sitemapSectionId: 'sec-footer',
              title: 'Footer',
              layout: 'footer',
              contentNotes: '',
              copyOutline: 'Address + links',
            },
          ],
        },
        {
          id: 'wf-about',
          pageId: 'page-about',
          title: 'About',
          sections: [
            {
              id: 'wf-about-content',
              sitemapSectionId: 'sec-about-content',
              title: 'Story',
              layout: 'full',
              contentNotes: 'Our history',
              copyOutline: 'Church story outline',
            },
          ],
        },
      ],
    },
    brief,
    styleTokens: tokens,
    seoPages: [
      {
        page_id: 'page-home',
        page_slug: 'home',
        status: 'approved',
        fields: {
          primaryKeyword: 'church near me',
          secondaryKeywords: 'sunday service, gospel',
          title: 'Acme Chapel | Welcome',
          metaDescription: 'A warm local church.',
          h1: 'Welcome to Acme Chapel',
          headingOutline: 'H2: Welcome\nH2: Times',
          internalLinks: 'about — Visit us\nvisit — Plan a visit',
          schemaTypes: ['Organization', 'FAQPage'],
          localSeo: 'City centre',
          answerBlocks: [
            { question: 'What time is Sunday?', answer: '10:30am' },
          ],
          entityNotes: 'Christian church',
        },
      },
    ],
    contentDocs: [
      { id: 'doc-1', title: 'Homepage copy' },
      { id: 'doc-2', title: 'About draft' },
    ],
  };
}

describe('buildExport', () => {
  it('builds a contract for a brief-only seeded website', async () => {
    const sources = briefOnlySources();
    const doc = await buildExport(WEBSITE_ID, {
      loadSources: async () => sources,
    });

    expect(doc.schemaVersion).toBe(SITE_STUDIO_EXPORT_SCHEMA_VERSION);
    expect(doc.generatedAt).toBe(GENERATED_AT);
    expect(doc.website).toEqual({
      id: WEBSITE_ID,
      name: 'Acme Chapel site',
      domain: 'acmechapel.example',
      stackPreference: 'astro',
    });
    expect(doc.brief?.org.name).toBe('Acme Chapel');
    expect(doc.styleTokens).toBeNull();
    expect(doc.seo).toBeNull();
    expect(doc.sitemap).toEqual([]);
    expect(doc.sections).toEqual([]);
    expect(doc.repeatingComponents).toEqual([]);
    expect(doc.contentDocs).toEqual([]);

    expect(doc).toMatchSnapshot('brief-only');
  });

  it('builds a full contract with nested sitemap, components, sections, seo', async () => {
    const doc = await buildExport(WEBSITE_ID, {
      loadSources: async () => fullSources(),
    });

    expect(doc.sitemap.map((page) => page.slug)).toEqual(['home', 'about']);
    expect(doc.sitemap[1]?.parentId).toBe('page-home');
    expect(doc.repeatingComponents.map((item) => item.key).sort()).toEqual([
      'site-footer',
      'site-header',
    ]);
    expect(doc.sections).toHaveLength(4);
    expect(doc.sections.find((s) => s.id === 'wf-hero')).toMatchObject({
      pageSlug: 'home',
      sectionType: 'hero',
      layoutPreset: 'hero-split',
      colorTag: 'hero',
      copyOutline: 'Welcome headline + CTA',
    });
    expect(doc.styleTokens?.colors.accent).toBe('#FF5C34');
    expect(doc.styleTokens?.typography.displayFamily).toBe('Fraunces');
    expect(doc.seo?.pages).toHaveLength(1);
    expect(doc.seo?.pages[0]).toMatchObject({
      pageSlug: 'home',
      status: 'approved',
      keywords: {
        primary: 'church near me',
        secondary: ['sunday service', 'gospel'],
      },
      meta: {
        title: 'Acme Chapel | Welcome',
        description: 'A warm local church.',
      },
    });
    expect(doc.seo?.pages[0]?.internalLinks.map((link) => link.toSlug)).toEqual(
      expect.arrayContaining(['about', 'visit']),
    );
    expect(doc.seo?.pages[0]?.aeo.answerBlocks[0]?.question).toBe(
      'What time is Sunday?',
    );
    expect(doc.contentDocs).toEqual([
      { title: 'Homepage copy', url: '#content/doc-1' },
      { title: 'About draft', url: '#content/doc-2' },
    ]);

    expect(doc).toMatchSnapshot('full-data');
  });

  it('tolerates missing optional tables without throwing', async () => {
    const doc = await buildExport(WEBSITE_ID, {
      loadSources: async () => ({
        generatedAt: GENERATED_AT,
        website: {
          id: WEBSITE_ID,
          name: 'Bare site',
          domain: null,
          sitemap: null,
          wireframes: undefined,
        },
        brief: null,
        styleTokens: null,
        seoPages: [],
        contentDocs: [],
      }),
    });

    expect(doc.brief).toBeNull();
    expect(doc.styleTokens).toBeNull();
    expect(doc.seo).toBeNull();
    expect(doc.website.stackPreference).toBe('undecided');
    expect(doc.sitemap).toEqual([]);
  });
});

describe('assertCompatibleExportSchemaVersion', () => {
  it('accepts the current major', () => {
    expect(() =>
      assertCompatibleExportSchemaVersion(SITE_STUDIO_EXPORT_SCHEMA_VERSION),
    ).not.toThrow();
  });

  it('refuses unknown majors', () => {
    expect(() => assertCompatibleExportSchemaVersion('2.0')).toThrow(
      /Unsupported SiteStudioExport/,
    );
  });
});
