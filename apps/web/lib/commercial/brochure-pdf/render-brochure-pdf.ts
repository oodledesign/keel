import 'server-only';

import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  StandardFonts,
  clip,
  closePath,
  degrees,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type RGB,
} from 'pdf-lib';

import type {
  BrochureDocument,
  BrochureOrientation,
  BrochurePage,
  BrochureSlotValue,
  BrochureTemplateId,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import { fetchBrochureMapImageBytes } from '~/lib/commercial/brochure-pdf/mapbox-static';
import { sanitizePdfText } from '~/lib/invoices/pdf-text';
import type { PublicBrochureData } from '~/lib/commercial/public-brochure.shared';

const A4_PORTRAIT = { width: 595.28, height: 841.89 };
const A4_LANDSCAPE = { width: 841.89, height: 595.28 };

/** Avoid upscaling tiny photos into blurry full-bleed frames. */
const MAX_UPSCALE = 1.35;

type BrandColors = {
  primary: RGB;
  secondary: RGB;
  accent: RGB;
  ink: RGB;
  muted: RGB;
  paper: RGB;
  paperMuted: RGB;
  soft: RGB;
};

type ImageFit = 'cover' | 'contain' | 'smart';

function hexToRgb(hex: string, fallback: RGB): RGB {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length !== 6) return fallback;
  const n = Number.parseInt(cleaned, 16);
  if (!Number.isFinite(n)) return fallback;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const safe = sanitizePdfText(text).replace(/\s+/g, ' ').trim();
  if (!safe) return [];

  const words = safe.split(' ');
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    font: PDFFont;
    size: number;
    color: RGB;
    maxWidth: number;
    lineHeight?: number;
    maxLines?: number;
  },
): number {
  const lineHeight = opts.lineHeight ?? opts.size * 1.35;
  let lines = wrapText(text, opts.font, opts.size, opts.maxWidth);
  if (opts.maxLines != null && lines.length > opts.maxLines) {
    lines = lines.slice(0, opts.maxLines);
    const last = lines[lines.length - 1] ?? '';
    lines[lines.length - 1] = `${last.replace(/\s+\S*$/, '')}...`;
  }

  let y = opts.y;
  for (const line of lines) {
    page.drawText(line, {
      x: opts.x,
      y,
      size: opts.size,
      font: opts.font,
      color: opts.color,
    });
    y -= lineHeight;
  }
  return y;
}

function isSafeRemoteImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === '169.254.169.254' ||
      host.startsWith('169.254.') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function fetchImageBytes(url: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  if (!isSafeRemoteImageUrl(url)) {
    console.error('[brochure-pdf] blocked unsafe image url host');
    return null;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (
      contentType &&
      !contentType.startsWith('image/') &&
      !contentType.includes('octet-stream')
    ) {
      console.error('[brochure-pdf] blocked non-image content-type:', contentType);
      return null;
    }
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function embedImage(
  pdf: PDFDocument,
  bytes: Uint8Array | null,
): Promise<PDFImage | null> {
  if (!bytes || bytes.length === 0) return null;
  // Mapbox Static usually returns PNG; try PNG first then JPEG.
  try {
    return await pdf.embedPng(bytes);
  } catch {
    try {
      return await pdf.embedJpg(bytes);
    } catch {
      console.error('[brochure-pdf] failed to embed image bytes');
      return null;
    }
  }
}

function clipToBox(
  page: PDFPage,
  box: { x: number; y: number; width: number; height: number },
) {
  page.pushOperators(
    pushGraphicsState(),
    moveTo(box.x, box.y),
    lineTo(box.x + box.width, box.y),
    lineTo(box.x + box.width, box.y + box.height),
    lineTo(box.x, box.y + box.height),
    closePath(),
    clip(),
    endPath(),
  );
}

function resolveFit(
  image: PDFImage,
  box: { width: number; height: number },
  fit: ImageFit,
): 'cover' | 'contain' {
  if (fit === 'cover') return 'cover';
  if (fit === 'contain') return 'contain';

  const coverScale = Math.max(box.width / image.width, box.height / image.height);
  if (coverScale > MAX_UPSCALE) return 'contain';

  const imgAspect = image.width / image.height;
  const boxAspect = box.width / box.height;
  // Landscape photo in a tall/narrow cell (or vice versa) — letterbox instead of heavy crop
  const mismatch =
    (imgAspect > 1.25 && boxAspect < 0.85) ||
    (imgAspect < 0.85 && boxAspect > 1.25);
  if (mismatch) return 'contain';

  return 'cover';
}

function drawImageInBox(
  page: PDFPage,
  image: PDFImage | null,
  box: { x: number; y: number; width: number; height: number },
  placeholder: RGB,
  fit: ImageFit = 'smart',
) {
  page.drawRectangle({
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    color: placeholder,
  });

  if (!image || box.width <= 0 || box.height <= 0) return;

  const mode = resolveFit(image, box, fit);
  const scale =
    mode === 'cover'
      ? Math.max(box.width / image.width, box.height / image.height)
      : Math.min(box.width / image.width, box.height / image.height);

  const drawW = image.width * scale;
  const drawH = image.height * scale;
  const dx = box.x + (box.width - drawW) / 2;
  const dy = box.y + (box.height - drawH) / 2;

  clipToBox(page, box);
  page.drawImage(image, {
    x: dx,
    y: dy,
    width: drawW,
    height: drawH,
  });
  page.pushOperators(popGraphicsState());
}

function slotText(slots: Record<string, BrochureSlotValue>, key: string): string {
  const s = slots[key];
  return s?.type === 'text' ? s.text : '';
}

function slotImage(
  slots: Record<string, BrochureSlotValue>,
  key: string,
): { mediaId: string | null; url: string | null } | null {
  const s = slots[key];
  if (s?.type !== 'image') return null;
  return { mediaId: s.mediaId, url: s.url };
}

function pageSize(orientation: BrochureOrientation) {
  return orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
}

function templateMargins(templateId: BrochureTemplateId) {
  if (templateId === 'compact') return 28;
  if (templateId === 'editorial') return 48;
  return 40;
}

function coverBandRatio(templateId: BrochureTemplateId) {
  if (templateId === 'editorial') return 0.26;
  if (templateId === 'compact') return 0.38;
  return 0.32;
}

type RenderCtx = {
  pdf: PDFDocument;
  data: PublicBrochureData;
  colors: BrandColors;
  font: PDFFont;
  fontBold: PDFFont;
  orientation: BrochureOrientation;
  templateId: BrochureTemplateId;
  imageCache: Map<string, PDFImage | null>;
  logo: PDFImage | null;
};

async function resolveImage(
  ctx: RenderCtx,
  url: string | null,
): Promise<PDFImage | null> {
  if (!url) return null;
  if (ctx.imageCache.has(url)) return ctx.imageCache.get(url) ?? null;
  const bytes = await fetchImageBytes(url);
  const img = await embedImage(ctx.pdf, bytes);
  ctx.imageCache.set(url, img);
  return img;
}

function drawLogo(
  page: PDFPage,
  logo: PDFImage | null,
  opts: { x: number; y: number; maxWidth: number; maxHeight: number },
) {
  if (!logo) return 0;
  const scale = Math.min(
    opts.maxWidth / logo.width,
    opts.maxHeight / logo.height,
  );
  const w = logo.width * scale;
  const h = logo.height * scale;
  page.drawImage(logo, {
    x: opts.x,
    y: opts.y - h,
    width: w,
    height: h,
  });
  return h;
}

function drawSectionTab(
  page: PDFPage,
  ctx: RenderCtx,
  label: string | undefined,
  number: string | undefined,
  landscape: boolean,
) {
  if (ctx.templateId === 'compact') return;
  if (!label && !number) return;
  const { width, height } = page.getSize();
  if (landscape && ctx.templateId === 'editorial') {
    const tabW = 28;
    page.drawRectangle({
      x: width - tabW,
      y: 0,
      width: tabW,
      height,
      color: ctx.colors.primary,
    });
    const text = sanitizePdfText([number, label].filter(Boolean).join('  '));
    if (text) {
      page.drawText(text, {
        x: width - 18,
        y: 40,
        size: 8,
        font: ctx.fontBold,
        color: ctx.colors.paper,
        rotate: degrees(90),
      });
    }
  } else if (number && ctx.templateId === 'editorial') {
    page.drawText(sanitizePdfText(number), {
      x: 36,
      y: height - 36,
      size: 10,
      font: ctx.fontBold,
      color: ctx.colors.accent,
    });
  }
}

async function renderCover(page: PDFPage, brochurePage: BrochurePage, ctx: RenderCtx) {
  const { width, height } = page.getSize();
  const landscape = ctx.orientation === 'landscape';
  const hero = slotImage(brochurePage.slots, 'hero');
  const heroImg = await resolveImage(ctx, hero?.url ?? null);
  const title = slotText(brochurePage.slots, 'title');
  const address = slotText(brochurePage.slots, 'address');
  const disposal = slotText(brochurePage.slots, 'disposal');
  const headline = slotText(brochurePage.slots, 'headline');
  const brandName = slotText(brochurePage.slots, 'brandName');
  const bandRatio = coverBandRatio(ctx.templateId);
  const titleSize =
    ctx.templateId === 'editorial' ? 26 : ctx.templateId === 'compact' ? 18 : 22;

  if (landscape) {
    const bandW = Math.round(width * bandRatio);
    const heroW = width - bandW;
    drawImageInBox(
      page,
      heroImg,
      { x: 0, y: 0, width: heroW, height },
      ctx.colors.soft,
      'smart',
    );
    page.drawRectangle({
      x: heroW,
      y: 0,
      width: bandW,
      height,
      color: ctx.colors.primary,
    });

    if (ctx.templateId === 'editorial') {
      page.drawRectangle({
        x: heroW,
        y: 0,
        width: 4,
        height,
        color: ctx.colors.accent,
      });
    }

    let y = height - 40;
    const logoH = drawLogo(page, ctx.logo, {
      x: heroW + 28,
      y,
      maxWidth: bandW - 56,
      maxHeight: 36,
    });
    if (logoH > 0) {
      y -= logoH + 16;
    } else {
      page.drawText(
        sanitizePdfText(brandName || ctx.data.accountName || 'Agency'),
        {
          x: heroW + 28,
          y,
          size: 11,
          font: ctx.fontBold,
          color: ctx.colors.paper,
        },
      );
      y -= 28;
    }

    if (disposal) {
      page.drawText(sanitizePdfText(disposal.toUpperCase()), {
        x: heroW + 28,
        y,
        size: 9,
        font: ctx.fontBold,
        color: ctx.colors.accent,
      });
      y -= 22;
    }
    y = drawWrapped(page, title, {
      x: heroW + 28,
      y,
      font: ctx.fontBold,
      size: titleSize,
      color: ctx.colors.paper,
      maxWidth: bandW - 56,
      maxLines: 4,
    });
    y -= 12;
    y = drawWrapped(page, address, {
      x: heroW + 28,
      y,
      font: ctx.font,
      size: 10,
      color: ctx.colors.paperMuted,
      maxWidth: bandW - 56,
      maxLines: 4,
    });
    y -= 16;
    if (headline) {
      drawWrapped(page, headline, {
        x: heroW + 28,
        y,
        font: ctx.fontBold,
        size: 11,
        color: ctx.colors.paper,
        maxWidth: bandW - 56,
        maxLines: 3,
      });
    }
  } else {
    const bandH =
      ctx.templateId === 'editorial'
        ? 170
        : ctx.templateId === 'compact'
          ? 130
          : 150;
    const heroH = height - bandH;
    drawImageInBox(
      page,
      heroImg,
      { x: 0, y: bandH, width, height: heroH },
      ctx.colors.soft,
      'smart',
    );
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: bandH,
      color: ctx.colors.primary,
    });
    if (ctx.templateId === 'editorial') {
      page.drawRectangle({
        x: 0,
        y: bandH - 4,
        width,
        height: 4,
        color: ctx.colors.accent,
      });
    }

    const logoH = drawLogo(page, ctx.logo, {
      x: 36,
      y: bandH - 16,
      maxWidth: 140,
      maxHeight: 32,
    });
    if (logoH <= 0) {
      page.drawText(
        sanitizePdfText(brandName || ctx.data.accountName || 'Agency'),
        {
          x: 36,
          y: bandH - 28,
          size: 10,
          font: ctx.fontBold,
          color: ctx.colors.paper,
        },
      );
    }

    let y = Math.min(110, bandH - 48);
    if (disposal) {
      page.drawText(sanitizePdfText(disposal.toUpperCase()), {
        x: 36,
        y,
        size: 9,
        font: ctx.fontBold,
        color: ctx.colors.accent,
      });
      y -= 18;
    }
    y = drawWrapped(page, title, {
      x: 36,
      y,
      font: ctx.fontBold,
      size: titleSize - 2,
      color: ctx.colors.paper,
      maxWidth: width - 72,
      maxLines: 2,
    });
    y -= 6;
    drawWrapped(page, headline || address, {
      x: 36,
      y,
      font: ctx.font,
      size: 10,
      color: ctx.colors.paperMuted,
      maxWidth: width - 72,
      maxLines: 2,
    });
  }
}

async function renderFacts(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  const { width, height } = page.getSize();
  const landscape = ctx.orientation === 'landscape';
  const margin = templateMargins(ctx.templateId);
  drawSectionTab(
    page,
    ctx,
    brochurePage.sectionLabel,
    brochurePage.sectionNumber,
    landscape,
  );

  const title = slotText(brochurePage.slots, 'title') || 'Summary';
  const titleSize = ctx.templateId === 'editorial' ? 22 : 18;
  page.drawText(sanitizePdfText(title), {
    x: margin,
    y: height - 48,
    size: titleSize,
    font: ctx.fontBold,
    color: ctx.colors.ink,
  });

  if (ctx.templateId === 'editorial') {
    page.drawRectangle({
      x: margin,
      y: height - 56,
      width: 48,
      height: 3,
      color: ctx.colors.accent,
    });
  }

  const factsSlot = brochurePage.slots.facts;
  const rows =
    factsSlot?.type === 'facts'
      ? factsSlot.rows
      : ([] as Array<{ label: string; value: string }>);

  const tableX = margin;
  const tableW = landscape
    ? width * (ctx.templateId === 'editorial' ? 0.4 : 0.45)
    : width - margin * 2;
  let y = height - 80;
  const rowH = ctx.templateId === 'compact' ? 24 : 28;

  if (ctx.templateId !== 'editorial') {
    page.drawRectangle({
      x: tableX,
      y: y - rows.length * rowH - 8,
      width: tableW,
      height: rows.length * rowH + 16,
      color: ctx.colors.soft,
    });
  }

  for (const row of rows) {
    page.drawText(sanitizePdfText(row.label), {
      x: tableX + 14,
      y: y - 6,
      size: 9,
      font: ctx.fontBold,
      color: ctx.colors.muted,
    });
    drawWrapped(page, row.value, {
      x: tableX + tableW * 0.38,
      y: y - 6,
      font: ctx.font,
      size: 10,
      color: ctx.colors.ink,
      maxWidth: tableW * 0.55,
      maxLines: 2,
    });
    if (ctx.templateId === 'editorial') {
      page.drawRectangle({
        x: tableX,
        y: y - rowH + 8,
        width: tableW,
        height: 0.5,
        color: rgb(0.85, 0.82, 0.8),
      });
    }
    y -= rowH;
  }

  if (landscape && ctx.data.images[0]) {
    const img = await resolveImage(ctx, ctx.data.images[0].url);
    const box = {
      x: width * (ctx.templateId === 'editorial' ? 0.48 : 0.52),
      y: 48,
      width: width * (ctx.templateId === 'editorial' ? 0.44 : 0.42),
      height: height - 96,
    };
    drawImageInBox(page, img, box, ctx.colors.soft, 'smart');
  }
}

async function renderDescription(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  const { width, height } = page.getSize();
  const landscape = ctx.orientation === 'landscape';
  const margin = templateMargins(ctx.templateId);
  drawSectionTab(
    page,
    ctx,
    brochurePage.sectionLabel,
    brochurePage.sectionNumber,
    landscape,
  );

  const title = slotText(brochurePage.slots, 'title') || 'About the property';
  const body = slotText(brochurePage.slots, 'body').trim();
  const highlightLines = slotText(brochurePage.slots, 'highlights')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 10);
  const hasHighlights = highlightLines.length > 0;

  page.drawText(sanitizePdfText(title), {
    x: margin,
    y: height - 48,
    size: ctx.templateId === 'editorial' ? 22 : 18,
    font: ctx.fontBold,
    color: ctx.colors.ink,
  });

  const fullW = width - margin * 2;
  const colW =
    landscape && hasHighlights
      ? (width - margin * 3) / 2
      : fullW;
  let y = height - 80;

  if (body) {
    y = drawWrapped(page, body, {
      x: margin,
      y,
      font: ctx.font,
      size: ctx.templateId === 'compact' ? 9 : 10,
      color: ctx.colors.ink,
      maxWidth: colW,
      maxLines: landscape ? 22 : 28,
    });
  }

  if (!hasHighlights) return;

  const hx = landscape ? margin * 2 + colW : margin;
  let hy = landscape ? height - 80 : y - 24;
  page.drawText('Key points', {
    x: hx,
    y: hy,
    size: 12,
    font: ctx.fontBold,
    color: ctx.colors.primary,
  });
  hy -= 20;
  for (const line of highlightLines) {
    hy = drawWrapped(page, line, {
      x: hx,
      y: hy,
      font: ctx.font,
      size: 10,
      color: ctx.colors.ink,
      maxWidth: landscape && hasHighlights ? colW : fullW,
      maxLines: 2,
    });
    hy -= 6;
  }
}

async function renderPhotoFull(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  const { width, height } = page.getSize();
  const photo = slotImage(brochurePage.slots, 'photo');
  const img = await resolveImage(ctx, photo?.url ?? null);
  const inset = ctx.templateId === 'editorial' ? 0 : 16;
  drawImageInBox(
    page,
    img,
    {
      x: inset,
      y: inset,
      width: width - inset * 2,
      height: height - inset * 2,
    },
    ctx.colors.soft,
    'smart',
  );
  drawSectionTab(
    page,
    ctx,
    brochurePage.sectionLabel,
    brochurePage.sectionNumber,
    ctx.orientation === 'landscape',
  );
}

async function renderPhotoGrid2(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  const { width, height } = page.getSize();
  const gap = 12;
  const margin = ctx.templateId === 'editorial' ? 20 : 24;
  const a = slotImage(brochurePage.slots, 'photo1');
  const b = slotImage(brochurePage.slots, 'photo2');
  const imgA = await resolveImage(ctx, a?.url ?? null);
  const imgB = await resolveImage(ctx, b?.url ?? null);

  // Stack as two wide frames in both orientations — side-by-side tall cells
  // crush landscape photos to a thin strip.
  const h = (height - margin * 2 - gap) / 2;
  const w = width - margin * 2;
  drawImageInBox(
    page,
    imgA,
    { x: margin, y: margin + h + gap, width: w, height: h },
    ctx.colors.soft,
    'smart',
  );
  drawImageInBox(
    page,
    imgB,
    { x: margin, y: margin, width: w, height: h },
    ctx.colors.soft,
    'smart',
  );
}

async function renderPhotoGrid3(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  const { width, height } = page.getSize();
  const gap = 10;
  const margin = 24;
  const imgs = await Promise.all([
    resolveImage(ctx, slotImage(brochurePage.slots, 'photo1')?.url ?? null),
    resolveImage(ctx, slotImage(brochurePage.slots, 'photo2')?.url ?? null),
    resolveImage(ctx, slotImage(brochurePage.slots, 'photo3')?.url ?? null),
  ]);

  if (ctx.orientation === 'landscape') {
    const topH = (height - margin * 2 - gap) * 0.55;
    const botH = height - margin * 2 - gap - topH;
    const w = width - margin * 2;
    drawImageInBox(
      page,
      imgs[0],
      { x: margin, y: margin + botH + gap, width: w, height: topH },
      ctx.colors.soft,
      'smart',
    );
    const halfW = (w - gap) / 2;
    drawImageInBox(
      page,
      imgs[1],
      { x: margin, y: margin, width: halfW, height: botH },
      ctx.colors.soft,
      'smart',
    );
    drawImageInBox(
      page,
      imgs[2],
      { x: margin + halfW + gap, y: margin, width: halfW, height: botH },
      ctx.colors.soft,
      'smart',
    );
  } else {
    const topH = (height - margin * 2 - gap) * 0.58;
    const botH = height - margin * 2 - gap - topH;
    const w = width - margin * 2;
    drawImageInBox(
      page,
      imgs[0],
      { x: margin, y: margin + botH + gap, width: w, height: topH },
      ctx.colors.soft,
      'smart',
    );
    const halfW = (w - gap) / 2;
    drawImageInBox(
      page,
      imgs[1],
      { x: margin, y: margin, width: halfW, height: botH },
      ctx.colors.soft,
      'smart',
    );
    drawImageInBox(
      page,
      imgs[2],
      { x: margin + halfW + gap, y: margin, width: halfW, height: botH },
      ctx.colors.soft,
      'smart',
    );
  }
}

async function renderFloorplan(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  const { width, height } = page.getSize();
  const margin = templateMargins(ctx.templateId);
  const caption = slotText(brochurePage.slots, 'caption') || 'Floor plan';
  page.drawText(sanitizePdfText(caption), {
    x: margin,
    y: height - 40,
    size: 14,
    font: ctx.fontBold,
    color: ctx.colors.ink,
  });
  const plan = slotImage(brochurePage.slots, 'plan');
  const img = await resolveImage(ctx, plan?.url ?? null);
  drawImageInBox(
    page,
    img,
    {
      x: margin,
      y: margin,
      width: width - margin * 2,
      height: height - margin - 56,
    },
    ctx.colors.soft,
    'contain',
  );
}

function drawMapPlaceholder(
  page: PDFPage,
  box: { x: number; y: number; width: number; height: number },
  ctx: RenderCtx,
  lat: number,
  lng: number,
) {
  page.drawRectangle({
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    color: ctx.colors.soft,
  });
  page.drawRectangle({
    x: box.x + 12,
    y: box.y + 12,
    width: box.width - 24,
    height: box.height - 24,
    borderColor: ctx.colors.muted,
    borderWidth: 1,
  });
  const label = sanitizePdfText(
    `Map unavailable · ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
  );
  page.drawText(label, {
    x: box.x + 24,
    y: box.y + box.height / 2,
    size: 10,
    font: ctx.font,
    color: ctx.colors.muted,
  });
}

async function renderMap(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  const { width, height } = page.getSize();
  const landscape = ctx.orientation === 'landscape';
  const margin = templateMargins(ctx.templateId);
  drawSectionTab(
    page,
    ctx,
    brochurePage.sectionLabel,
    brochurePage.sectionNumber,
    landscape,
  );

  const title = slotText(brochurePage.slots, 'title') || 'Location';
  const body = slotText(brochurePage.slots, 'body');
  const mapSlot = brochurePage.slots.map;
  const amenities =
    mapSlot?.type === 'map'
      ? mapSlot.amenities
      : ([] as Array<{ label: string; index: number }>);
  const lat =
    (mapSlot?.type === 'map' ? mapSlot.latitude : null) ??
    ctx.data.listing.latitude;
  const lng =
    (mapSlot?.type === 'map' ? mapSlot.longitude : null) ??
    ctx.data.listing.longitude;

  page.drawText(sanitizePdfText(title), {
    x: margin,
    y: height - 48,
    size: 18,
    font: ctx.fontBold,
    color: ctx.colors.ink,
  });

  const listW = landscape ? width * 0.32 : width - margin * 2;
  let y = height - 80;
  if (body) {
    y = drawWrapped(page, body, {
      x: margin,
      y,
      font: ctx.font,
      size: 9,
      color: ctx.colors.muted,
      maxWidth: listW,
      maxLines: landscape ? 8 : 6,
    });
    y -= 16;
  }

  if (amenities.length > 0) {
    page.drawText('Nearby', {
      x: margin,
      y,
      size: 11,
      font: ctx.fontBold,
      color: ctx.colors.primary,
    });
    y -= 18;

    for (const amenity of amenities.slice(0, 8)) {
      page.drawCircle({
        x: margin + 6,
        y: y + 3,
        size: 7,
        color: ctx.colors.accent,
      });
      page.drawText(String(amenity.index), {
        x: margin + 3.5,
        y: y + 0.5,
        size: 7,
        font: ctx.fontBold,
        color: ctx.colors.paper,
      });
      drawWrapped(page, amenity.label, {
        x: margin + 20,
        y,
        font: ctx.font,
        size: 10,
        color: ctx.colors.ink,
        maxWidth: listW - 28,
        maxLines: 2,
      });
      y -= 22;
    }
  }

  if (lat != null && lng != null) {
    const mapW = landscape ? width * 0.58 : width - margin * 2;
    const mapH = landscape ? height - 96 : Math.min(280, Math.max(160, y - margin - 20));
    const mapX = landscape ? width - margin - mapW : margin;
    const mapY = landscape ? 48 : margin;
    const box = { x: mapX, y: mapY, width: mapW, height: Math.max(120, mapH) };

    // Only pin the property — fake amenity offsets produced misleading maps
    const bytes = await fetchBrochureMapImageBytes({
      latitude: lat,
      longitude: lng,
      width: Math.round(mapW * 2),
      height: Math.round(box.height * 2),
      zoom: 14,
    });
    const mapImg = await embedImage(ctx.pdf, bytes);
    if (mapImg) {
      drawImageInBox(page, mapImg, box, ctx.colors.soft, 'cover');
    } else {
      drawMapPlaceholder(page, box, ctx, lat, lng);
    }
  }
}

async function renderContact(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  const { width, height } = page.getSize();
  const landscape = ctx.orientation === 'landscape';
  const margin = templateMargins(ctx.templateId);
  drawSectionTab(
    page,
    ctx,
    brochurePage.sectionLabel,
    brochurePage.sectionNumber,
    landscape,
  );

  page.drawRectangle({
    x: 0,
    y: height - 72,
    width,
    height: 72,
    color: ctx.colors.primary,
  });

  const title = slotText(brochurePage.slots, 'title') || 'Contact';
  page.drawText(sanitizePdfText(title), {
    x: margin,
    y: height - 44,
    size: 18,
    font: ctx.fontBold,
    color: ctx.colors.paper,
  });

  const logoH = drawLogo(page, ctx.logo, {
    x: width - margin - 120,
    y: height - 20,
    maxWidth: 120,
    maxHeight: 36,
  });
  if (logoH <= 0) {
    page.drawText(
      sanitizePdfText(
        ctx.data.accountName ||
          slotText(brochurePage.slots, 'brandName') ||
          '',
      ),
      {
        x: margin + 160,
        y: height - 42,
        size: 11,
        font: ctx.font,
        color: ctx.colors.paperMuted,
      },
    );
  }

  const agents = ctx.data.agents.slice(0, 4);
  let x = margin;
  let y = height - 120;
  const cardW = landscape
    ? (width - margin * 2) / 4 - 8
    : (width - margin * 2) / 2 - 8;

  for (const agent of agents) {
    page.drawText(sanitizePdfText(agent.name), {
      x,
      y,
      size: 12,
      font: ctx.fontBold,
      color: ctx.colors.ink,
    });
    if (agent.email) {
      page.drawText(sanitizePdfText(agent.email), {
        x,
        y: y - 16,
        size: 9,
        font: ctx.font,
        color: ctx.colors.muted,
      });
    }
    if (agent.phone) {
      page.drawText(sanitizePdfText(agent.phone), {
        x,
        y: y - 30,
        size: 9,
        font: ctx.font,
        color: ctx.colors.muted,
      });
    }
    x += cardW + 12;
    if (!landscape && x + cardW > width - margin) {
      x = margin;
      y -= 70;
    }
  }

  const notice = slotText(brochurePage.slots, 'notice');
  if (notice) {
    drawWrapped(page, notice, {
      x: margin,
      y: 70,
      font: ctx.font,
      size: 7,
      color: ctx.colors.muted,
      maxWidth: width - margin * 2,
      maxLines: 6,
    });
  }
}

async function renderPage(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  switch (brochurePage.layoutId) {
    case 'cover_hero_band':
      await renderCover(page, brochurePage, ctx);
      break;
    case 'facts_table':
      await renderFacts(page, brochurePage, ctx);
      break;
    case 'description_highlights':
      await renderDescription(page, brochurePage, ctx);
      break;
    case 'photo_full':
      await renderPhotoFull(page, brochurePage, ctx);
      break;
    case 'photo_grid_2':
      await renderPhotoGrid2(page, brochurePage, ctx);
      break;
    case 'photo_grid_3':
      await renderPhotoGrid3(page, brochurePage, ctx);
      break;
    case 'floorplan':
      await renderFloorplan(page, brochurePage, ctx);
      break;
    case 'map_amenities':
      await renderMap(page, brochurePage, ctx);
      break;
    case 'contact':
      await renderContact(page, brochurePage, ctx);
      break;
    default:
      page.drawText('Unsupported layout', {
        x: 40,
        y: 400,
        size: 12,
        font: ctx.font,
        color: ctx.colors.muted,
      });
  }
}

/**
 * Render a brochure document to PDF bytes using pdf-lib.
 */
export async function renderBrochurePdf(
  document: BrochureDocument,
  data: PublicBrochureData,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const size = pageSize(document.orientation);

  const colors: BrandColors = {
    primary: hexToRgb(data.brand.primaryColor, rgb(0.21, 0.12, 0.16)),
    secondary: hexToRgb(data.brand.secondaryColor, rgb(0.25, 0.38, 0.44)),
    accent: hexToRgb(data.brand.accentColor, rgb(1, 0.36, 0.2)),
    ink: rgb(0.12, 0.1, 0.11),
    muted: rgb(0.45, 0.4, 0.42),
    paper: rgb(0.98, 0.96, 0.93),
    paperMuted: rgb(0.9, 0.88, 0.86),
    soft: rgb(0.94, 0.92, 0.9),
  };

  const logoBytes = await fetchImageBytes(data.brand.logoUrl);
  const logo = await embedImage(pdf, logoBytes);

  const ctx: RenderCtx = {
    pdf,
    data,
    colors,
    font,
    fontBold,
    orientation: document.orientation,
    templateId: document.templateId,
    imageCache: new Map(),
    logo,
  };

  if (document.pages.length > 30) {
    throw new Error('Brochure exceeds maximum page count');
  }

  for (const brochurePage of document.pages) {
    const pdfPage = pdf.addPage([size.width, size.height]);
    await renderPage(pdfPage, brochurePage, ctx);
  }

  if (document.pages.length === 0) {
    const pdfPage = pdf.addPage([size.width, size.height]);
    pdfPage.drawText('Empty brochure', {
      x: 40,
      y: size.height / 2,
      size: 14,
      font,
      color: colors.muted,
    });
  }

  return pdf.save();
}
