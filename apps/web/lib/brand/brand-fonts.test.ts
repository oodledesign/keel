import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  BRAND_FONT_IDS,
  BRAND_FONT_OPTIONS,
  parseBrandFontId,
} from './brand-fonts.shared';

describe('brand fonts', () => {
  it('bundles regular and bold TTF + WOFF2 files for every font option', () => {
    const dir = path.join(__dirname, 'fonts');
    const missing = BRAND_FONT_IDS.filter((id) => id !== 'helvetica').flatMap(
      (id) =>
        ['regular.ttf', 'bold.ttf', 'regular.woff2', 'bold.woff2']
          .map((suffix) => `${id}-${suffix}`)
          .filter((file) => !existsSync(path.join(dir, file))),
    );
    expect(missing).toEqual([]);
  });

  it('lists each id exactly once in the picker options', () => {
    expect(BRAND_FONT_OPTIONS.map((option) => option.id).sort()).toEqual(
      [...BRAND_FONT_IDS].sort(),
    );
  });

  it('parses known ids and rejects anything else', () => {
    expect(parseBrandFontId('playfair-display')).toBe('playfair-display');
    expect(parseBrandFontId('comic-sans')).toBeNull();
    expect(parseBrandFontId(null)).toBeNull();
    expect(parseBrandFontId(42)).toBeNull();
  });
});
