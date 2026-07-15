import { describe, expect, it } from 'vitest';

import { emptyWebsiteBrief } from '../brief-types';
import {
  SITE_STUDIO_EXPORT_SCHEMA_VERSION,
  type SiteStudioExport,
} from '../export-contract';
import { emptyWebsiteStyleSystem } from '../planning-types';
import { generatePromptPack } from './prompt-pack';

const NOT_DEFINED_MARKER = 'Not yet defined in Site Studio';

function briefOnlyExport(): SiteStudioExport {
  const brief = emptyWebsiteBrief();
  brief.org.name = 'Acme Chapel';
  brief.org.oneLiner = 'Local church';
  brief.brand.tone = ['warm', 'clear'];
  brief.offer.primaryConversionGoals = ['Book a visit'];
  brief.audience.segments = [
    {
      id: 'seg-1',
      name: 'Local families',
      jobsToBeDone: 'Find a welcoming Sunday',
      objections: [],
    },
  ];
  brief.stackPreference = 'next';

  return {
    schemaVersion: SITE_STUDIO_EXPORT_SCHEMA_VERSION,
    generatedAt: '2026-07-14T12:00:00.000Z',
    website: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Acme Chapel site',
      domain: 'acmechapel.example',
      stackPreference: 'next',
    },
    brief,
    styleTokens: null,
    sitemap: [],
    repeatingComponents: [],
    sections: [],
    seo: null,
    contentDocs: [],
  };
}

function fullExport(): SiteStudioExport {
  const base = briefOnlyExport();
  const tokens = emptyWebsiteStyleSystem().tokens;
  tokens.colors.accent = '#FF5C34';
  tokens.typography.displayFamily = 'Fraunces';

  return {
    ...base,
    website: { ...base.website, stackPreference: 'webflow' },
    brief: base.brief ? { ...base.brief, stackPreference: 'webflow' } : null,
    styleTokens: tokens,
    sitemap: [
      {
        slug: 'home',
        title: 'Home',
        description: 'Landing',
        pageType: 'home',
        parentId: null,
        status: 'approved',
        sectionIds: ['wf-hero', 'wf-footer'],
      },
      {
        slug: 'services',
        title: 'Services',
        description: 'What we offer',
        pageType: 'service',
        parentId: null,
        status: 'draft',
        sectionIds: ['wf-services'],
      },
    ],
    repeatingComponents: [
      {
        key: 'site-footer',
        title: 'Footer',
        sectionType: 'footer',
        layoutPreset: 'footer',
        props: {},
      },
    ],
    sections: [
      {
        id: 'wf-hero',
        pageSlug: 'home',
        sectionType: 'hero',
        layoutPreset: 'split',
        componentKey: null,
        props: { slots: { headline: 'Welcome' } },
        copyOutline: 'Headline + CTA',
        colorTag: 'hero',
        status: 'draft',
      },
      {
        id: 'wf-footer',
        pageSlug: 'home',
        sectionType: 'footer',
        layoutPreset: 'footer',
        componentKey: 'site-footer',
        props: {},
        copyOutline: 'Address links',
        colorTag: 'footer',
        status: 'draft',
      },
      {
        id: 'wf-services',
        pageSlug: 'services',
        sectionType: 'content',
        layoutPreset: 'cards',
        componentKey: null,
        props: {},
        copyOutline: 'Three service cards',
        colorTag: 'content',
        status: 'draft',
      },
    ],
    seo: {
      pages: [
        {
          pageSlug: 'home',
          status: 'approved',
          schemaVersion: '1.0',
          keywords: {
            primary: 'church near me',
            secondary: ['sunday service'],
          },
          meta: {
            title: 'Acme Chapel',
            description: 'Welcome',
          },
          headingOutline: [
            { level: 1, text: 'Welcome' },
            { level: 2, text: 'Times' },
          ],
          internalLinks: [
            { toSlug: 'services', anchorSuggestion: 'Our services' },
          ],
          canonicalRule: 'self',
          slugRule: 'home',
          imageAltPlan: [],
          schemaTypes: ['Organization'],
          geo: {
            isLocationPage: true,
            nap: 'City',
            serviceArea: [],
            gbpCues: [],
            localFaq: [],
          },
          aeo: {
            answerBlocks: [],
            definitions: [],
            entityNotes: '',
          },
          technical: {
            indexable: true,
            ogImagePlan: '',
          },
        },
      ],
    },
    contentDocs: [{ title: 'Homepage copy', url: '#content/doc-1' }],
  };
}

describe('generatePromptPack', () => {
  it('exports next target from contract only and degrades missing style/seo', () => {
    const pack = generatePromptPack(briefOnlyExport(), 'next');
    const paths = pack.files.map((file) => file.path);

    expect(paths).toContain('00-project-context.md');
    expect(paths).toContain('AGENTS.md');
    expect(paths).toContain('.cursor/rules/site-studio.mdc');
    expect(paths).toContain('seo/llms.txt');
    expect(paths).toContain('seo/json-ld-embeds.md');
    expect(paths).toContain('seo/json-ld.json');
    expect(paths.some((path) => path.startsWith('pages/'))).toBe(false);

    const context = pack.files.find(
      (file) => file.path === '00-project-context.md',
    )!.content;
    expect(context).toContain('Acme Chapel');
    expect(context).toContain('Book a visit');
    expect(context).toContain('Local families');
    expect(context).toContain(NOT_DEFINED_MARKER);
    expect(context).not.toMatch(/#[0-9A-Fa-f]{6}/);

    const agents = pack.files.find(
      (file) => file.path === 'AGENTS.md',
    )!.content;
    expect(agents).toContain('Next.js App Router');
    expect(agents).toContain(NOT_DEFINED_MARKER);
  });

  it('exports webflow target with per-section Client-First files', () => {
    const pack = generatePromptPack(fullExport(), 'webflow');
    const paths = pack.files.map((file) => file.path);

    expect(paths).toContain('pages/10-home.md');
    expect(paths).toContain('pages/20-services.md');
    expect(paths.some((path) => path.startsWith('webflow/sections/'))).toBe(
      true,
    );

    const home = pack.files.find(
      (file) => file.path === 'pages/10-home.md',
    )!.content;
    expect(home).toContain('layoutPreset');
    expect(home).toContain('split');
    expect(home).toContain('Headline + CTA');
    expect(home).toContain('church near me');
    expect(home).toContain('Client-First');

    const sectionFile = pack.files.find((file) =>
      file.path.includes('webflow/sections/'),
    )!;
    expect(sectionFile.content).toContain('Implement section');
    expect(sectionFile.content).toContain('padding-global');

    const context = pack.files.find(
      (file) => file.path === '00-project-context.md',
    )!.content;
    expect(context).toContain('#FF5C34');
    expect(context).toContain('Fraunces');
  });

  it('marks missing SEO on pages without inventing titles', () => {
    const exp = fullExport();
    exp.seo = null;
    const pack = generatePromptPack(exp, 'next');
    const home = pack.files.find(
      (file) => file.path === 'pages/10-home.md',
    )!.content;
    expect(home).toContain(NOT_DEFINED_MARKER);
    expect(home).not.toContain('Acme Chapel | Welcome home meta');
  });

  it('embeds site-blocks registry for ozer_sites target', () => {
    const pack = generatePromptPack(fullExport(), 'ozer_sites');
    const paths = pack.files.map((file) => file.path);
    expect(paths).toContain('registry/site-blocks-registry.json');
    expect(paths).toContain('registry/README.md');

    const registryFile = pack.files.find(
      (file) => file.path === 'registry/site-blocks-registry.json',
    )!;
    const parsed = JSON.parse(registryFile.content) as {
      package: string;
      blocks: Array<{ name: string; layoutPreset: string }>;
    };
    expect(parsed.package).toBe('@kit/site-blocks-core');
    expect(parsed.blocks.length).toBeGreaterThanOrEqual(18);
    expect(parsed.blocks.some((block) => block.name === 'HeroSplit')).toBe(
      true,
    );

    const home = pack.files.find(
      (file) => file.path === 'pages/10-home.md',
    )!.content;
    expect(home).toContain('@kit/site-blocks-core');
  });

  it('includes ROUNDTRIP.md with workspace pack path for ozer_sites target', () => {
    const pack = generatePromptPack(fullExport(), 'ozer_sites', {
      accountSlug: 'ybb',
    });
    const roundtrip = pack.files.find((file) => file.path === 'ROUNDTRIP.md');
    expect(roundtrip).toBeTruthy();
    expect(roundtrip!.content).toContain(
      'packages/site-blocks-workspaces/src/workspaces/ybb/',
    );
    expect(roundtrip!.content).toContain('block.manifest.json');
    expect(roundtrip!.content).toContain('manifestToPuckConfig');

    const home = pack.files.find(
      (file) => file.path === 'pages/10-home.md',
    )!.content;
    expect(home).toContain('Round-trip');

    // Missing slug degrades to a placeholder, never an empty path.
    const noSlug = generatePromptPack(fullExport(), 'ozer_sites');
    const noSlugRoundtrip = noSlug.files.find(
      (file) => file.path === 'ROUNDTRIP.md',
    )!;
    expect(noSlugRoundtrip.content).toContain('{accountSlug}');
  });

  it('does not emit ROUNDTRIP.md for non-ozer_sites targets', () => {
    const pack = generatePromptPack(fullExport(), 'next', {
      accountSlug: 'ybb',
    });
    expect(pack.files.some((file) => file.path === 'ROUNDTRIP.md')).toBe(false);
  });
});
