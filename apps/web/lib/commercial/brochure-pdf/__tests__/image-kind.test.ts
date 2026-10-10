import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import {
  imageToneStats,
  isDrawingImage,
  looksLikeDrawing,
} from '../image-kind';

vi.mock('server-only', () => ({}));

const white = { r: 255, g: 255, b: 255 };

describe('looksLikeDrawing', () => {
  it('accepts a mostly white plan', () => {
    expect(
      looksLikeDrawing({
        dominant: white,
        whiteShare: 0.82,
        meanSaturation: 0.02,
      }),
    ).toBe(true);
  });

  it('accepts a coloured elevation on a white sheet', () => {
    expect(
      looksLikeDrawing({
        dominant: white,
        whiteShare: 0.7,
        meanSaturation: 0.14,
      }),
    ).toBe(true);
  });

  it('accepts a pale drawing with less white when it is unsaturated', () => {
    expect(
      looksLikeDrawing({
        dominant: white,
        whiteShare: 0.45,
        meanSaturation: 0.05,
      }),
    ).toBe(true);
  });

  it('rejects a bright, colourful photo with some white', () => {
    expect(
      looksLikeDrawing({
        dominant: white,
        whiteShare: 0.45,
        meanSaturation: 0.3,
      }),
    ).toBe(false);
  });

  it('rejects anything whose dominant colour is not near white', () => {
    expect(
      looksLikeDrawing({
        dominant: { r: 120, g: 140, b: 90 },
        whiteShare: 0.7,
        meanSaturation: 0.02,
      }),
    ).toBe(false);
  });
});

async function plan(): Promise<Buffer> {
  const lines = Array.from(
    { length: 6 },
    (_, i) =>
      `<rect x="${20 + i * 60}" y="20" width="4" height="260" fill="#222"/>`,
  ).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#fff"/>${lines}<rect x="20" y="140" width="360" height="4" fill="#222"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function photo(): Promise<Buffer> {
  const width = 120;
  const height = 90;
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      data[i] = (x * 2) % 256;
      data[i + 1] = 80 + ((y * 3) % 120);
      data[i + 2] = 40 + ((x + y) % 90);
    }
  }
  return sharp(data, { raw: { width, height, channels: 3 } })
    .jpeg()
    .toBuffer();
}

describe('imageToneStats', () => {
  it('reports a white dominant colour and high white share for a line drawing', async () => {
    const stats = await imageToneStats(await plan());
    expect(stats).not.toBeNull();
    expect(
      Math.min(stats!.dominant.r, stats!.dominant.g, stats!.dominant.b),
    ).toBeGreaterThanOrEqual(225);
    expect(stats!.whiteShare).toBeGreaterThan(0.8);
  });

  it('returns null for bytes that are not an image', async () => {
    expect(await imageToneStats(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe('isDrawingImage', () => {
  it('flags a line drawing', async () => {
    expect(await isDrawingImage(await plan())).toBe(true);
  });

  it('does not flag a photo', async () => {
    expect(await isDrawingImage(await photo())).toBe(false);
  });
});
