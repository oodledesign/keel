import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type BrochureSerifFonts = { regular: Uint8Array; semiBold: Uint8Array };

let fontsPromise: Promise<BrochureSerifFonts | null> | null = null;

async function readFont(name: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(
      await readFile(
        path.join(
          process.cwd(),
          'lib',
          'commercial',
          'brochure-pdf',
          'fonts',
          name,
        ),
      ),
    );
  } catch {
    return null;
  }
}

/**
 * Lora (OFL) for brochure headings, bundled with the brochure routes through
 * `outputFileTracingIncludes`. Null when the files are missing — the renderer
 * then falls back to Helvetica.
 */
export function loadBrochureSerifFonts(): Promise<BrochureSerifFonts | null> {
  fontsPromise ??= (async () => {
    const [regular, semiBold] = await Promise.all([
      readFont('Lora-Regular.ttf'),
      readFont('Lora-SemiBold.ttf'),
    ]);
    if (!regular || !semiBold) {
      console.error('[brochure-pdf] Lora fonts missing; using Helvetica');
      return null;
    }
    return { regular, semiBold };
  })();
  return fontsPromise;
}
