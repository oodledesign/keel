import { createElement } from 'react';

import { describe, expect, it } from 'vitest';

import { SITE_BLOCK_TYPES, buildConfig } from '@kit/site-blocks-core';
import {
  type BlockManifest,
  getWorkspacePack,
  manifestToPuckConfig,
  resolveSiteBlocksConfig,
  templatePack,
} from '@kit/site-blocks-workspaces';

describe('resolveSiteBlocksConfig', () => {
  it('returns core-only config for unknown / missing slugs', () => {
    for (const slug of [null, undefined, '', 'no-such-workspace']) {
      const config = resolveSiteBlocksConfig(slug);
      expect(Object.keys(config.components).sort()).toEqual(
        [...SITE_BLOCK_TYPES].sort(),
      );
    }
  });

  it('unknown slug matches stock buildConfig categories', () => {
    const config = resolveSiteBlocksConfig('no-such-workspace');
    expect(config.categories).toEqual(buildConfig().categories);
  });

  it('registered slugs include core plus custom types', () => {
    // No production packs registered yet — assert the registry contract via
    // the template pack merged through buildConfig extras.
    const merged = buildConfig({
      extraComponents: templatePack.components,
      extraCategories: templatePack.categories,
    });

    for (const type of SITE_BLOCK_TYPES) {
      expect(merged.components[type]).toBeTruthy();
    }
    for (const type of Object.keys(templatePack.components)) {
      expect((merged.components as Record<string, unknown>)[type]).toBeTruthy();
    }
    expect(
      (merged.categories as Record<string, { components: string[] }>).template
        ?.components,
    ).toEqual(Object.keys(templatePack.components));
  });

  it('template pack is not registered in the workspace registry', () => {
    expect(getWorkspacePack('_template')).toBeNull();
  });

  it('extraComponents colliding with core types throw', () => {
    expect(() =>
      buildConfig({
        extraComponents: {
          HeroSplit: { render: () => createElement('div') },
        },
      }),
    ).toThrow(/collides/);
  });
});

describe('manifestToPuckConfig', () => {
  const manifest: BlockManifest = {
    type: 'YbbHero',
    label: 'YBB Hero',
    category: 'ybb',
    fields: [
      { key: 'heading', type: 'text', label: 'Heading' },
      { key: 'body', type: 'textarea', label: 'Body' },
      { key: 'count', type: 'number', label: 'Count' },
      {
        key: 'variant',
        type: 'select',
        label: 'Variant',
        options: [{ label: 'Light', value: 'light' }],
      },
      { key: 'image', type: 'image', label: 'Image' },
      { key: 'ctaHref', type: 'link', label: 'CTA link' },
      {
        key: 'items',
        type: 'array',
        label: 'Items',
        itemLabel: 'Item',
        itemFields: [{ key: 'title', type: 'text', label: 'Title' }],
      },
    ],
    defaults: { heading: 'Hello', items: [] },
  };

  it('maps manifest fields onto expected Puck field keys and types', () => {
    const config = manifestToPuckConfig(manifest, () => null);
    const fields = config.fields as Record<string, { type: string }>;

    expect(Object.keys(fields)).toEqual([
      'heading',
      'body',
      'count',
      'variant',
      'image',
      'ctaHref',
      'items',
    ]);
    expect(fields.heading?.type).toBe('text');
    expect(fields.body?.type).toBe('textarea');
    expect(fields.count?.type).toBe('number');
    expect(fields.variant?.type).toBe('select');
    // v1: image + link fields edit as plain text (URL / href).
    expect(fields.image?.type).toBe('text');
    expect(fields.ctaHref?.type).toBe('text');
    expect(fields.items?.type).toBe('array');
  });

  it('nests array itemFields and applies defaults + label', () => {
    const config = manifestToPuckConfig(manifest, () => null);

    const items = (
      config.fields as Record<
        string,
        { arrayFields?: Record<string, { type: string }> }
      >
    ).items;
    expect(items?.arrayFields?.title?.type).toBe('text');

    expect(config.label).toBe('YBB Hero');
    expect(config.defaultProps).toEqual({ heading: 'Hello', items: [] });
  });
});
