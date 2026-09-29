import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import type { SurveyPdfFonts, SurveyPdfImage } from './survey-report-pdf';

const PHOTO_MAX_EDGE = 1600;
const PHOTO_QUALITY = 80;

let fontsPromise: Promise<SurveyPdfFonts | null> | null = null;
let artPromise: Promise<SurveyPdfArt> | null = null;

export type SurveyPdfArt = {
  ricsLogo: SurveyPdfImage | null;
  typicalHouse: SurveyPdfImage | null;
};

async function readAppFile(...segments: string[]): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(
      await readFile(path.join(process.cwd(), ...segments)),
    );
  } catch {
    return null;
  }
}

/** Noto Sans, bundled with the route through `outputFileTracingIncludes`. */
export function loadSurveyPdfFonts(): Promise<SurveyPdfFonts | null> {
  fontsPromise ??= (async () => {
    const dir = ['lib', 'building-surveyor', 'fonts'];
    const [regular, bold, italic, boldItalic] = await Promise.all([
      readAppFile(...dir, 'NotoSans-Regular.ttf'),
      readAppFile(...dir, 'NotoSans-Bold.ttf'),
      readAppFile(...dir, 'NotoSans-Italic.ttf'),
      readAppFile(...dir, 'NotoSans-BoldItalic.ttf'),
    ]);
    if (!regular || !bold || !italic || !boldItalic) return null;
    return { regular, bold, italic, boldItalic };
  })();
  return fontsPromise;
}

export function loadSurveyPdfArt(): Promise<SurveyPdfArt> {
  artPromise ??= (async () => {
    const [ricsLogo, typicalHouse] = await Promise.all([
      readAppFile('public', 'brand', 'rics-logo.png'),
      readAppFile('public', 'brand', 'rics-typical-house.png'),
    ]);
    return {
      ricsLogo: ricsLogo ? { bytes: ricsLogo, kind: 'png' } : null,
      typicalHouse: typicalHouse ? { bytes: typicalHouse, kind: 'png' } : null,
    };
  })();
  return artPromise;
}

/**
 * Re-encodes a photo as a JPEG no larger than 1600px on its long edge, applying
 * EXIF rotation. Handles WebP and (where libvips supports it) HEIC uploads that
 * pdf-lib cannot embed directly.
 */
export async function normalizeSurveyPhoto(
  bytes: Uint8Array,
): Promise<SurveyPdfImage | null> {
  try {
    const output = await sharp(bytes, { failOn: 'none' })
      .rotate()
      .resize({
        width: PHOTO_MAX_EDGE,
        height: PHOTO_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: PHOTO_QUALITY, mozjpeg: true })
      .toBuffer();
    return { bytes: new Uint8Array(output), kind: 'jpg' };
  } catch {
    return null;
  }
}
