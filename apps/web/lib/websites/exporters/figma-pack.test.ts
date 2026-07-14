import { describe, expect, it } from 'vitest';

import { emptyWebsiteBrief } from '../brief-types';
import {
  SITE_STUDIO_EXPORT_SCHEMA_VERSION,
  type SiteStudioExport,
} from '../export-contract';
import { emptyWebsiteStyleSystem } from '../planning-types';
import { generateFigmaPack } from './figma-pack';

function fullExport(): SiteStudioExport {
  const brief = emptyWebsiteBrief();
  brief.org.name = 'Acme Chapel';
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
      stackPreference: 'next',
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
        sectionIds: ['wf-hero'],
      },
    ],
    repeatingComponents: [],
    sections: [
      {
        id: 'wf-hero',
        pageSlug: 'home',
        sectionType: 'hero',
        layoutPreset: 'hero-split',
        componentKey: 'hero-split',
        props: {},
        copyOutline: 'Welcome headline',
        colorTag: 'hero',
        status: 'draft',
      },
    ],
    seo: null,
    contentDocs: [],
  };
}

describe('generateFigmaPack', () => {
  it('emits labelled Tokens Studio files, outline, and build prompt', () => {
    const pack = generateFigmaPack(fullExport(), {
      importUrls: {
        home: 'https://example.test/portal/websites/tok/figma/home',
      },
    });
    const paths = pack.files.map((file) => file.path);

    expect(paths).toContain('README.md');
    expect(paths).toContain('TOKENS-README.md');
    expect(paths).toContain('tokens-studio.legacy.json');
    expect(paths).toContain('tokens-studio.dtcg.json');
    expect(paths).toContain('style-tokens.plain.json');
    expect(paths).toContain('PAGE-OUTLINE.md');
    expect(paths).toContain('BUILD-FRAMES.md');
    expect(paths).toContain('png/README.md');

    const readme = pack.files.find((f) => f.path === 'README.md')!
      .content as string;
    expect(readme).toMatch(/No Figma plugin/i);
    expect(readme).toMatch(/html\.to\.design/);

    const tokensReadme = pack.files.find((f) => f.path === 'TOKENS-README.md')!
      .content as string;
    expect(tokensReadme).toMatch(/legacy/i);
    expect(tokensReadme).toMatch(/DTCG|W3C/i);
    expect(tokensReadme).toMatch(/fallback/i);

    const legacy = JSON.parse(
      pack.files.find((f) => f.path === 'tokens-studio.legacy.json')!
        .content as string,
    ) as {
      global: { color: { primary: { type: string; value: string } } };
      $metadata: { tokenSetOrder: string[] };
    };
    expect(legacy.global.color.primary.type).toBe('color');
    expect(legacy.global.color.primary.value).toBe('#FF5C34');
    expect(legacy.$metadata.tokenSetOrder).toEqual(['global']);

    const dtcg = JSON.parse(
      pack.files.find((f) => f.path === 'tokens-studio.dtcg.json')!
        .content as string,
    ) as {
      color: { primary: { $type: string; $value: string } };
    };
    expect(dtcg.color.primary.$type).toBe('color');
    expect(dtcg.color.primary.$value).toBe('#FF5C34');

    const plain = JSON.parse(
      pack.files.find((f) => f.path === 'style-tokens.plain.json')!
        .content as string,
    ) as { $label: string; tokens: { colors: { primary: string } } };
    expect(plain.$label).toMatch(/FALLBACK/i);
    expect(plain.tokens.colors.primary).toBe('#FF5C34');

    const outline = pack.files.find((f) => f.path === 'PAGE-OUTLINE.md')!
      .content as string;
    expect(outline).toContain('Welcome headline');
    expect(outline).toContain('html.to.design URL');
  });

  it('embeds binary PNGs when provided', () => {
    const png = new Uint8Array([137, 80, 78, 71]);
    const pack = generateFigmaPack(fullExport(), {
      pagePngs: { home: png },
    });
    const file = pack.files.find((f) => f.path === 'png/home.png');
    expect(file).toBeTruthy();
    expect(file?.content).toBeInstanceOf(Uint8Array);
  });
});
