import { describe, expect, it } from 'vitest';

import {
  SITE_BLOCK_TYPES,
  buildConfig,
  siteBlocksRegistry,
} from '@kit/site-blocks-core';

describe('site-blocks registry', () => {
  it('matches buildConfig component keys', () => {
    const config = buildConfig();
    const registryNames = new Set(
      (siteBlocksRegistry.blocks as Array<{ name: string }>).map(
        (block) => block.name,
      ),
    );

    for (const type of SITE_BLOCK_TYPES) {
      expect(config.components[type]).toBeTruthy();
      expect(registryNames.has(type)).toBe(true);
    }

    expect(siteBlocksRegistry.blocks).toHaveLength(SITE_BLOCK_TYPES.length);
  });

  it('registry layoutPresets are unique', () => {
    const presets = (
      siteBlocksRegistry.blocks as Array<{ layoutPreset: string }>
    ).map((block) => block.layoutPreset);
    expect(new Set(presets).size).toBe(presets.length);
  });
});
