import 'server-only';

import {
  LINKEDIN_OVERLAY_HEIGHT,
  LINKEDIN_OVERLAY_WIDTH,
  type OverlaySpec,
  buildOverlaySvg,
} from '~/lib/commercial/linkedin-publishing/overlay';

export async function composeLinkedInOverlayJpeg(
  imageBytes: Buffer,
  spec: OverlaySpec,
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const svg = Buffer.from(buildOverlaySvg(spec));

  return sharp(imageBytes)
    .rotate()
    .resize(LINKEDIN_OVERLAY_WIDTH, LINKEDIN_OVERLAY_HEIGHT, {
      fit: 'cover',
      position: 'centre',
    })
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}

export async function cropLinkedInLandscapeJpeg(
  imageBytes: Buffer,
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp(imageBytes)
    .rotate()
    .resize(LINKEDIN_OVERLAY_WIDTH, LINKEDIN_OVERLAY_HEIGHT, {
      fit: 'cover',
      position: 'centre',
    })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}
