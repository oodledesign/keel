import { describe, expect, it } from 'vitest';

import { emptyWebsiteBrief } from '../brief-types';
import {
  SITE_STUDIO_EXPORT_SCHEMA_VERSION,
  type SiteStudioExport,
} from '../export-contract';
import { emptyWebsiteSeoPageSeo } from '../seo-types';
import {
  generateJsonLd,
  generateLlmsTxt,
  jsonLdToScriptTags,
} from './seo-generators';

function seededExport(): SiteStudioExport {
  const brief = emptyWebsiteBrief();
  brief.org.name = 'Acme Chapel';
  brief.org.oneLiner = 'A local church with clear gospel invitation';
  brief.org.geography = 'Manchester city centre';
  brief.offer.services = [
    {
      id: 'svc-1',
      name: 'Sunday worship',
      description: 'Weekly gathered worship',
    },
    {
      id: 'svc-2',
      name: 'Pastoral care',
      description: 'One-to-one support',
    },
  ];
  brief.offer.primaryConversionGoals = ['Book a visit'];

  const homeSeo = emptyWebsiteSeoPageSeo();
  homeSeo.meta.title = 'Acme Chapel | Welcome';
  homeSeo.meta.description = 'Join us on Sundays in Manchester';
  homeSeo.keywords.primary = 'church manchester';
  homeSeo.schemaTypes = ['Organization', 'LocalBusiness', 'FAQPage'];
  homeSeo.geo.isLocationPage = true;
  homeSeo.geo.nap = '12 High Street, Manchester M1 1AA · 0161 000 0000';
  homeSeo.geo.serviceArea = ['Manchester', 'Salford'];
  homeSeo.aeo.answerBlocks = [
    {
      question: 'What time is Sunday service?',
      draftAnswer: '10:30am every Sunday.',
    },
    {
      question: 'Is parking available?',
      draftAnswer: 'Yes, street parking nearby.',
    },
  ];

  const servicesSeo = emptyWebsiteSeoPageSeo();
  servicesSeo.meta.title = 'Services | Acme Chapel';
  servicesSeo.meta.description = 'Worship and pastoral care';
  servicesSeo.schemaTypes = ['Service'];
  servicesSeo.keywords.primary = 'sunday worship';

  return {
    schemaVersion: SITE_STUDIO_EXPORT_SCHEMA_VERSION,
    generatedAt: '2026-07-14T12:00:00.000Z',
    website: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Acme Chapel site',
      domain: 'acmechapel.example',
      stackPreference: 'astro',
    },
    brief,
    styleTokens: null,
    sitemap: [
      {
        slug: 'home',
        title: 'Home',
        description: 'Welcome landing',
        pageType: 'home',
        parentId: null,
        status: 'approved',
        sectionIds: [],
      },
      {
        slug: 'services',
        title: 'Services',
        description: 'What we offer',
        pageType: 'service',
        parentId: null,
        status: 'approved',
        sectionIds: [],
      },
    ],
    repeatingComponents: [],
    sections: [],
    seo: {
      pages: [
        {
          pageSlug: 'home',
          status: 'approved',
          ...homeSeo,
        },
        {
          pageSlug: 'services',
          status: 'approved',
          ...servicesSeo,
        },
      ],
    },
    contentDocs: [{ title: 'Homepage copy', url: '#content/doc-1' }],
  };
}

/** Lightweight schema.org shape checks (no network). */
function assertValidJsonLd(block: Record<string, unknown>) {
  expect(block['@context']).toBe('https://schema.org');
  expect(block['@type'] || block['@graph']).toBeTruthy();
  // Round-trip JSON (no cycles / undefined)
  expect(() => JSON.parse(JSON.stringify(block))).not.toThrow();
}

describe('generateLlmsTxt', () => {
  it('follows llmstxt.org H1 → blockquote → H2 link lists', () => {
    const text = generateLlmsTxt(seededExport());
    const lines = text.trim().split('\n');

    expect(lines[0]).toBe('# Acme Chapel');
    expect(lines[1]).toBe('');
    expect(lines[2]).toMatch(/^>/);
    expect(text).toContain('## Pages');
    expect(text).toContain(
      '- [Home](https://acmechapel.example/): Join us on Sundays in Manchester',
    );
    expect(text).toContain('## Services');
    expect(text).toContain('## Optional');
    expect(text).toContain('What time is Sunday service?');
    expect(text).toContain('10:30am every Sunday.');
  });

  it('honours edit-before-export override', () => {
    const override = '# Custom\n> Edited\n';
    expect(generateLlmsTxt(seededExport(), { llmsTxtOverride: override })).toBe(
      override,
    );
  });
});

describe('generateJsonLd', () => {
  it('builds a stable entity graph and valid per-page blocks', () => {
    const { siteGraph, pages } = generateJsonLd(seededExport());
    assertValidJsonLd(siteGraph);

    const graph = siteGraph['@graph'] as Array<Record<string, unknown>>;
    expect(graph.length).toBeGreaterThan(1);
    const org = graph.find((node) => {
      const type = node['@type'];
      return (
        type === 'Organization' ||
        (Array.isArray(type) && type.includes('Organization'))
      );
    });
    expect(org?.['@id']).toBe('https://acmechapel.example/#organization');

    const services = graph.filter((node) => node['@type'] === 'Service');
    expect(services).toHaveLength(2);
    expect(services[0]?.provider).toEqual({
      '@id': 'https://acmechapel.example/#organization',
    });

    expect(pages.map((page) => page.pageSlug)).toEqual(['home', 'services']);
    for (const page of pages) {
      for (const block of page.blocks) {
        assertValidJsonLd(block as Record<string, unknown>);
      }
    }
  });

  it('matches approved FAQ answer blocks exactly', () => {
    const { pages } = generateJsonLd(seededExport());
    const home = pages.find((page) => page.pageSlug === 'home')!;
    const faq = home.blocks.find(
      (block) => (block as { '@type'?: string })['@type'] === 'FAQPage',
    ) as {
      mainEntity: Array<{
        name: string;
        acceptedAnswer: { text: string };
      }>;
    };

    expect(faq.mainEntity).toEqual([
      {
        '@type': 'Question',
        name: 'What time is Sunday service?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '10:30am every Sunday.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is parking available?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, street parking nearby.',
        },
      },
    ]);
  });

  it('omits FAQ when answer blocks are draft-only', () => {
    const exp = seededExport();
    exp.seo!.pages[0]!.status = 'draft';
    const { pages } = generateJsonLd(exp);
    const home = pages.find((page) => page.pageSlug === 'home')!;
    expect(
      home.blocks.some(
        (block) => (block as { '@type'?: string })['@type'] === 'FAQPage',
      ),
    ).toBe(false);
  });

  it('serialises paste-ready script tags', () => {
    const { siteGraph } = generateJsonLd(seededExport());
    const html = jsonLdToScriptTags([siteGraph]);
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@graph"');
  });
});
