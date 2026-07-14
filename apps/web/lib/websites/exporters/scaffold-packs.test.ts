import { describe, expect, it } from 'vitest';

import { emptyWebsiteBrief } from '../brief-types';
import {
  SITE_STUDIO_EXPORT_SCHEMA_VERSION,
  type SiteStudioExport,
} from '../export-contract';
import { emptyWebsiteStyleSystem } from '../planning-types';
import { generateAstroPack } from './astro-pack';
import { generateNextPack } from './next-pack';
import { generateWebflowPack } from './webflow-pack';

function fullExport(): SiteStudioExport {
  const brief = emptyWebsiteBrief();
  brief.org.name = 'Acme Chapel';
  brief.stackPreference = 'astro';

  const tokens = emptyWebsiteStyleSystem().tokens;
  tokens.colors.primary = '#FF5C34';
  tokens.typography.displayFamily = 'Fraunces';

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
        layoutPreset: 'hero-split',
        componentKey: 'hero-split',
        props: { slots: { headline: 'Welcome', cta: 'Plan a visit' } },
        copyOutline: 'Headline + CTA for Sunday welcome',
        colorTag: 'hero',
        status: 'draft',
      },
      {
        id: 'wf-footer',
        pageSlug: 'home',
        sectionType: 'footer',
        layoutPreset: 'footer',
        componentKey: 'footer-standard',
        props: {},
        copyOutline: 'Address + links',
        colorTag: 'footer',
        status: 'draft',
      },
      {
        id: 'wf-services',
        pageSlug: 'services',
        sectionType: 'content',
        layoutPreset: 'feature-grid',
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
          keywords: { primary: 'church near me', secondary: [] },
          meta: { title: 'Acme Chapel', description: 'Welcome' },
          headingOutline: [{ level: 1, text: 'Welcome' }],
          internalLinks: [],
          canonicalRule: 'self',
          slugRule: 'home',
          imageAltPlan: [],
          schemaTypes: ['Organization', 'FAQPage'],
          geo: {
            isLocationPage: false,
            nap: '',
            serviceArea: [],
            gbpCues: [],
            localFaq: [],
          },
          aeo: {
            answerBlocks: [
              {
                question: 'When do you meet?',
                draftAnswer: 'Sundays at 10:30am',
              },
            ],
            definitions: [],
            entityNotes: '',
          },
          technical: { indexable: true, ogImagePlan: '' },
        },
      ],
    },
    contentDocs: [],
  };
}

describe('generateWebflowPack', () => {
  it('emits README scope, workflow, class guide, site.json, and CF stubs', () => {
    const pack = generateWebflowPack(fullExport());
    const paths = pack.files.map((file) => file.path);

    expect(paths).toContain('README.md');
    expect(paths).toContain('WORKFLOW.md');
    expect(paths).toContain('CLASS-NAMING.md');
    expect(paths).toContain('site.json');
    expect(paths).toContain('public/llms.txt');
    expect(paths).toContain('seo/json-ld-embeds.md');
    expect(paths.some((path) => path.startsWith('webflow/sections/'))).toBe(
      true,
    );

    const llms = pack.files.find(
      (file) => file.path === 'public/llms.txt',
    )!.content;
    expect(llms.startsWith('# Acme Chapel')).toBe(true);
    expect(llms).toContain('## Pages');

    const embeds = pack.files.find(
      (file) => file.path === 'seo/json-ld-embeds.md',
    )!.content;
    expect(embeds).toContain('application/ld+json');
    expect(embeds).toContain('When do you meet?');
    expect(embeds).toContain('Sundays at 10:30am');

    const readme = pack.files.find(
      (file) => file.path === 'README.md',
    )!.content;
    expect(readme).toMatch(/does \*\*not\*\* push/i);
    expect(readme).toMatch(/Designer API/i);

    const stub = pack.files.find((file) =>
      file.path.includes('webflow/sections/'),
    )!.content;
    expect(stub).toContain('padding-global');
    expect(stub).toContain('container-large');
    expect(stub).toContain('section_');
    expect(stub).toContain('Headline + CTA');

    const site = JSON.parse(
      pack.files.find((file) => file.path === 'site.json')!.content,
    ) as {
      $schemaNote: string;
      pages: Array<{ sections: Array<{ clientFirstName: string }> }>;
      tokens: { colors: { primary: string } };
    };
    expect(site.$schemaNote).toMatch(/not Designer API sync/i);
    expect(site.tokens.colors.primary).toBe('#FF5C34');
    expect(site.pages[0]?.sections[0]?.clientFirstName).toBe('hero-split');
  });
});

describe('generateAstroPack', () => {
  it('emits a runnable project skeleton with tokens and content collections', () => {
    const pack = generateAstroPack(fullExport());
    const paths = pack.files.map((file) => file.path);

    expect(paths).toContain('package.json');
    expect(paths).toContain('astro.config.mjs');
    expect(paths).toContain('README.md');
    expect(paths).toContain('src/styles/tokens.css');
    expect(paths).toContain('src/content.config.ts');
    expect(paths).toContain('src/pages/index.astro');
    expect(paths).toContain('src/pages/services.astro');
    expect(paths).toContain('src/content/pages/home.md');
    expect(paths).toContain('src/components/sections/HeroSplit.astro');
    expect(paths).toContain('src/components/sections/SiteFooter.astro');
    expect(paths).toContain('src/components/sections/FeatureGrid.astro');
    expect(paths).toContain('public/llms.txt');
    expect(paths).toContain('src/lib/json-ld.ts');
    expect(paths).toContain('src/layouts/BaseLayout.astro');

    const llms = pack.files.find(
      (file) => file.path === 'public/llms.txt',
    )!.content;
    expect(llms).toContain('# Acme Chapel');

    const layout = pack.files.find(
      (file) => file.path === 'src/layouts/BaseLayout.astro',
    )!.content;
    expect(layout).toContain('application/ld+json');

    const jsonLd = pack.files.find(
      (file) => file.path === 'src/lib/json-ld.ts',
    )!.content;
    expect(jsonLd).toContain('When do you meet?');
    expect(jsonLd).toContain('Sundays at 10:30am');

    const tokens = pack.files.find(
      (file) => file.path === 'src/styles/tokens.css',
    )!.content;
    expect(tokens).toContain('--sb-color-primary: #FF5C34');
    expect(tokens).toContain('--sb-font-display');

    const readme = pack.files.find(
      (file) => file.path === 'README.md',
    )!.content;
    expect(readme).toContain('pnpm install');
    expect(readme).toContain('pnpm dev');
    expect(readme).toMatch(/Decodable/);
    expect(readme).toMatch(/not\*\* included/i);

    const homeMd = pack.files.find(
      (file) => file.path === 'src/content/pages/home.md',
    )!.content;
    expect(homeMd).toContain('component: HeroSplit');
    expect(homeMd).toContain('Headline + CTA');

    const pkg = JSON.parse(
      pack.files.find((file) => file.path === 'package.json')!.content,
    ) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(pkg.scripts.dev).toBe('astro dev');
    expect(pkg.dependencies.astro).toBeTruthy();
  });
});

describe('generateNextPack', () => {
  it('emits a runnable App Router project with metadata, JSON-LD, and llms.txt', () => {
    const pack = generateNextPack(fullExport());
    const paths = pack.files.map((file) => file.path);

    expect(paths).toContain('package.json');
    expect(paths).toContain('next.config.ts');
    expect(paths).toContain('tsconfig.json');
    expect(paths).toContain('site.config.ts');
    expect(paths).toContain('app/layout.tsx');
    expect(paths).toContain('app/page.tsx');
    expect(paths).toContain('app/services/page.tsx');
    expect(paths).toContain('app/tokens.css');
    expect(paths).toContain('app/globals.css');
    expect(paths).toContain('public/llms.txt');
    expect(paths).toContain('lib/site-json-ld.ts');
    expect(paths).toContain('components/JsonLd.tsx');
    expect(paths).toContain('components/PageSections.tsx');
    expect(paths).toContain('components/sections/HeroSplit.tsx');
    expect(paths).toContain('components/sections/FeatureGrid.tsx');
    expect(paths).toContain('README.md');
    expect(paths).not.toContain('content/cms.stub.md');

    const pkg = JSON.parse(
      pack.files.find((file) => file.path === 'package.json')!
        .content as string,
    ) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(pkg.scripts.dev).toBe('next dev');
    expect(pkg.dependencies.next).toBeTruthy();
    expect(pkg.dependencies['@kit/site-blocks-core']).toBeUndefined();

    const home = pack.files.find((file) => file.path === 'app/page.tsx')!
      .content as string;
    expect(home).toContain('generateMetadata');
    expect(home).toContain('JsonLd');
    expect(home).toContain('jsonLdForPage');
    expect(home).toContain('PageSections');

    const config = pack.files.find((file) => file.path === 'site.config.ts')!
      .content as string;
    expect(config).toContain('Acme Chapel');
    expect(config).toContain('HeroSplit');

    const jsonLd = pack.files.find(
      (file) => file.path === 'lib/site-json-ld.ts',
    )!.content as string;
    expect(jsonLd).toContain('Sundays at 10:30am');

    const readme = pack.files.find((file) => file.path === 'README.md')!
      .content as string;
    expect(readme).toContain('pnpm install');
    expect(readme).toContain('pnpm dev');
    expect(readme).toContain('Vercel');
    expect(readme).toMatch(/Pure typed config/i);
    expect(readme).toMatch(
      /does \*\*not\*\* depend on `@kit\/site-blocks-core`/i,
    );
  });

  it('nests app routes from parentId and adds CMS stub when implied', () => {
    const exp = fullExport();
    exp.brief!.stackPreference = 'webflow';
    exp.website.stackPreference = 'webflow';
    exp.sitemap.push({
      slug: 'youth',
      title: 'Youth',
      description: 'Youth ministry',
      pageType: 'other',
      // parentId uses source-id style; resolver strips `page-` → services
      parentId: 'page-services',
      status: 'draft',
      sectionIds: [],
    });

    const pack = generateNextPack(exp);
    const paths = pack.files.map((file) => file.path);
    expect(paths).toContain('app/services/youth/page.tsx');
    expect(paths).toContain('content/cms.stub.md');

    const youth = pack.files.find(
      (file) => file.path === 'app/services/youth/page.tsx',
    )!.content as string;
    expect(youth).toContain('getPage("youth")');
    expect(youth).toContain('const page = pageOrNull');
    expect(youth).toContain('../../../site.config');
  });
});
