import { describe, expect, it } from 'vitest';

import { emptyWebsiteBrief } from './brief-types';
import {
  SITE_STUDIO_EXPORT_SCHEMA_VERSION,
  type SiteStudioExport,
} from './export-contract';
import { generateOzerSitesPack } from './exporters/ozer-sites-pack';
import {
  emptyOzerSiteSettings,
  resolveOzerSitePuckPermissions,
} from './ozer-sites-types';
import { emptyWebsiteStyleSystem } from './planning-types';

function seeded(): SiteStudioExport {
  const brief = emptyWebsiteBrief();
  brief.org.name = 'Acme Chapel';
  brief.stackPreference = 'ozer_sites';
  const tokens = emptyWebsiteStyleSystem().tokens;
  return {
    schemaVersion: SITE_STUDIO_EXPORT_SCHEMA_VERSION,
    generatedAt: '2026-07-14T12:00:00.000Z',
    website: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Acme Chapel',
      domain: 'acmechapel.example',
      stackPreference: 'ozer_sites',
    },
    brief,
    styleTokens: tokens,
    sitemap: [
      {
        slug: 'home',
        title: 'Home',
        description: '',
        pageType: 'home',
        parentId: null,
        status: 'approved',
        sectionIds: ['s1'],
      },
    ],
    repeatingComponents: [],
    sections: [
      {
        id: 's1',
        pageSlug: 'home',
        sectionType: 'hero',
        layoutPreset: 'hero-split',
        componentKey: 'hero-split',
        props: { slots: { headline: 'Welcome' } },
        copyOutline: 'Welcome',
        colorTag: 'hero',
        status: 'draft',
      },
    ],
    seo: null,
    contentDocs: [],
  };
}

describe('generateOzerSitesPack', () => {
  it('maps sections to puck data with stable source hashes', () => {
    const pack = generateOzerSitesPack(seeded());
    expect(pack.subdomain).toBe('acme-chapel');
    expect(pack.pages).toHaveLength(1);
    expect(pack.pages[0]?.puckData.content.length).toBeGreaterThan(0);
    expect(pack.pages[0]?.sourceHash).toMatch(/^[a-f0-9]{32}$/);
    expect(generateOzerSitesPack(seeded()).pages[0]?.sourceHash).toBe(
      pack.pages[0]?.sourceHash,
    );
  });

  it('dedupes index and home to a single home page', () => {
    const exp = seeded();
    exp.sitemap = [
      ...exp.sitemap,
      {
        slug: 'index',
        title: 'Index duplicate',
        description: '',
        pageType: 'home',
        parentId: null,
        status: 'approved',
        sectionIds: [],
      },
    ];
    const pack = generateOzerSitesPack(exp);
    expect(pack.pages).toHaveLength(1);
    expect(pack.pages[0]?.slug).toBe('home');
  });
});

describe('resolveOzerSitePuckPermissions', () => {
  it('gives agency full control and clients restricted defaults', () => {
    const settings = emptyOzerSiteSettings();
    expect(resolveOzerSitePuckPermissions('agency', settings)).toEqual({
      delete: true,
      drag: true,
      duplicate: true,
      edit: true,
      insert: true,
    });
    expect(resolveOzerSitePuckPermissions('client', settings)).toEqual({
      delete: false,
      drag: false,
      duplicate: true,
      edit: true,
      insert: false,
    });
    expect(
      resolveOzerSitePuckPermissions('client', {
        ...settings,
        clientCanDelete: true,
        clientCanInsert: true,
        clientCanDrag: true,
      }),
    ).toMatchObject({ delete: true, insert: true, drag: true });
  });
});
