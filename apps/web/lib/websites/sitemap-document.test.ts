import { describe, expect, it } from 'vitest';

import { WEBSITE_SITEMAP_SCHEMA_VERSION } from './planning-types';
import {
  applySymbolToPages,
  migrateSitemapDocument,
  migrateSitemapPages,
} from './sitemap-document';

describe('migrateSitemapDocument', () => {
  it('upgrades a legacy page array', () => {
    const doc = migrateSitemapDocument([
      {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Home',
        slug: 'home',
        sections: [
          {
            id: '22222222-2222-2222-2222-222222222222',
            title: 'Header',
            description: 'Nav',
            sectionType: 'nav',
            componentKey: 'site-header',
          },
        ],
      },
    ]);

    expect(doc.schemaVersion).toBe(WEBSITE_SITEMAP_SCHEMA_VERSION);
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0]?.sections[0]?.color).toBe('nav');
    expect(doc.pages[0]?.sections[0]?.sectionType).toBe('nav');
    expect(doc.components.map((item) => item.key)).toEqual(['site-header']);
    expect(typeof doc.pages[0]?.x).toBe('number');
    expect(typeof doc.pages[0]?.y).toBe('number');
  });

  it('passes through a v1 document and syncs color', () => {
    const doc = migrateSitemapDocument({
      schemaVersion: '1.0',
      pages: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          title: 'About',
          slug: 'about',
          sections: [
            {
              id: '22222222-2222-2222-2222-222222222222',
              title: 'Story',
              description: '',
              color: 'content',
            },
          ],
          x: 40,
          y: 60,
        },
      ],
      components: [],
    });

    expect(doc.pages[0]?.x).toBe(40);
    expect(doc.pages[0]?.sections[0]?.sectionType).toBe('content');
    expect(migrateSitemapPages(doc)).toHaveLength(1);
  });
});

describe('applySymbolToPages', () => {
  it('propagates symbol edits to all instances', () => {
    const pages = applySymbolToPages(
      [
        {
          id: 'p1',
          title: 'Home',
          slug: 'home',
          sections: [
            {
              id: 's1',
              title: 'Old',
              description: 'old',
              color: 'nav',
              sectionType: 'nav',
              componentKey: 'site-header',
              status: 'draft',
            },
          ],
        },
        {
          id: 'p2',
          title: 'About',
          slug: 'about',
          sections: [
            {
              id: 's2',
              title: 'Old',
              description: 'old',
              color: 'nav',
              sectionType: 'nav',
              componentKey: 'site-header',
              status: 'draft',
            },
          ],
        },
      ],
      {
        key: 'site-header',
        title: 'Site header',
        description: 'Updated',
        color: 'nav',
        status: 'approved',
      },
    );

    expect(
      pages.every((page) => page.sections[0]?.title === 'Site header'),
    ).toBe(true);
    expect(pages[0]?.sections[0]?.status).toBe('approved');
  });
});
