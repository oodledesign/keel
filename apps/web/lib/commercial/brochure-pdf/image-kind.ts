import 'server-only';

export type ImageToneStats = {
  /** sharp's dominant colour (most populated 4096-bin histogram bucket). */
  dominant: { r: number; g: number; b: number };
  /** Share of pixels with every channel at or above 240. */
  whiteShare: number;
  /** Mean HSV saturation, 0–1. */
  meanSaturation: number;
};

const SAMPLE_SIZE = 96;

/**
 * Floor plans, site plans and elevations: a near-white background that covers
 * much of the frame. Coloured elevations pass on white share alone; paler
 * ones also need low saturation so bright interior photos are not caught.
 */
export function looksLikeDrawing(stats: ImageToneStats): boolean {
  const { r, g, b } = stats.dominant;
  if (Math.min(r, g, b) < 225) return false;
  return (
    stats.whiteShare >= 0.6 ||
    (stats.whiteShare >= 0.4 && stats.meanSaturation < 0.12)
  );
}

export async function imageToneStats(
  bytes: Uint8Array,
): Promise<ImageToneStats | null> {
  try {
    const sharp = (await import('sharp')).default;
    const sample = sharp(bytes)
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'inside' })
      .removeAlpha()
      .toColourspace('srgb');
    const [{ dominant }, { data, info }] = await Promise.all([
      sample.clone().stats(),
      sample.clone().raw().toBuffer({ resolveWithObject: true }),
    ]);

    const channels = info.channels;
    const pixels = data.length / channels;
    if (pixels === 0) return null;
    let white = 0;
    let saturation = 0;
    for (let i = 0; i < data.length; i += channels) {
      const pr = data[i]!;
      const pg = channels >= 3 ? data[i + 1]! : pr;
      const pb = channels >= 3 ? data[i + 2]! : pr;
      const max = Math.max(pr, pg, pb);
      const min = Math.min(pr, pg, pb);
      if (min >= 240) white += 1;
      if (max > 0) saturation += (max - min) / max;
    }
    return {
      dominant,
      whiteShare: white / pixels,
      meanSaturation: saturation / pixels,
    };
  } catch {
    return null;
  }
}

export async function isDrawingImage(bytes: Uint8Array): Promise<boolean> {
  const stats = await imageToneStats(bytes);
  return stats ? looksLikeDrawing(stats) : false;
}
