import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { BrandFontId } from '~/lib/brand/brand-fonts.shared';

export type BrandFontFiles = { regular: Uint8Array; bold: Uint8Array };

const cache = new Map<BrandFontId, Promise<BrandFontFiles | null>>();

async function readFont(name: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(
      await readFile(path.join(process.cwd(), 'lib', 'brand', 'fonts', name)),
    );
  } catch {
    return null;
  }
}

/**
 * TTF bytes for embedding a brand font in a PDF. Routes that call this need
 * `lib/brand/fonts/*.ttf` in `outputFileTracingIncludes`. Null for Helvetica
 * (a PDF standard font) and when the files are missing.
 */
export function loadBrandFontFiles(
  id: BrandFontId,
): Promise<BrandFontFiles | null> {
  if (id === 'helvetica') return Promise.resolve(null);

  let pending = cache.get(id);
  if (!pending) {
    pending = (async () => {
      const [regular, bold] = await Promise.all([
        readFont(`${id}-regular.ttf`),
        readFont(`${id}-bold.ttf`),
      ]);
      if (!regular || !bold) {
        console.error(`[brand-fonts] ${id} font files missing`);
        return null;
      }
      return { regular, bold };
    })();
    cache.set(id, pending);
  }
  return pending;
}
