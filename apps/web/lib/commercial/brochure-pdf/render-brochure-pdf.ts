import 'server-only';

import fontkit from '@pdf-lib/fontkit';
import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
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
  setCharacterSpacing,
} from 'pdf-lib';

import { loadBrandFontFiles } from '~/lib/brand/brand-fonts.server';
import {
  type BrandFontId,
  DEFAULT_PDF_BODY_FONT,
  DEFAULT_PDF_HEADING_FONT,
} from '~/lib/brand/brand-fonts.shared';
import {
  AMENITY_ICON_PATHS,
  AMENITY_ICON_VIEWBOX,
} from '~/lib/commercial/brochure-pdf/amenity-icons';
import type {
  BrochureDocument,
  BrochureOrientation,
  BrochurePage,
  BrochureSlotValue,
  BrochureTemplateId,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import {
  type Box,
  coverHeadline,
  coverTitleParts,
  fitPhotoBox,
  keepPostcodesTogether,
  layoutPhotoGrid,
  nameInitials,
  parseDetailsBody,
  splitLeadParagraph,
} from '~/lib/commercial/brochure-pdf/brochure-layout';
import { resolveBrochureLinkButtons } from '~/lib/commercial/brochure-pdf/brochure-links';
import { brochureContactShopfrontBox } from '~/lib/commercial/brochure-pdf/contact-layout';
import {
  brochureSashHex,
  parseCoverPriceLines,
} from '~/lib/commercial/brochure-pdf/cover-prices';
import {
  brochureMapPinColor,
  fetchBrochureMapImageBytes,
} from '~/lib/commercial/brochure-pdf/mapbox-static';
import {
  type AmenityIcon,
  buildFallbackNearbyAmenities,
  isThinNearbyAmenityList,
  resolveAmenityIcon,
  sanitizeBrochureAmenities,
} from '~/lib/commercial/brochure-pdf/nearby-amenities.shared';
import {
  type BrochureListing,
  type PublicBrochureData,
  formatBrochureAddress,
  resolveBrochurePlateLogo,
} from '~/lib/commercial/public-brochure.shared';
import { sanitizePdfText } from '~/lib/invoices/pdf-text';
import { addUriLink } from '~/lib/pdf/pdf-links';
import {
  supabaseStorageObjectPath,
  toSupabasePublicStorageUrl,
} from '~/lib/storage/public-url';

const A4_PORTRAIT = { width: 595.28, height: 841.89 };
const A4_LANDSCAPE = { width: 841.89, height: 595.28 };

/** Avoid upscaling tiny photos into blurry frames (PDF pt per image px). */
const MAX_UPSCALE = 1.35;

/** Footer rule sits here; page content stops at CONTENT_MIN_Y. */
const FOOTER_BASELINE = 24;
const CONTENT_MIN_Y = 54;
const EDITORIAL_TAB_WIDTH = 28;
/** Classic/compact inner pages: brand band on top, soft band at the foot. */
const HEADER_BAND_H = 40;
const HEADER_RULE_H = 2;
const FOOTER_BAND_H = 34;

type BrandColors = {
  primary: RGB;
  secondary: RGB;
  accent: RGB;
  ink: RGB;
  muted: RGB;
  paper: RGB;
  paperMuted: RGB;
  soft: RGB;
  hairline: RGB;
};

function hexToRgb(hex: string, fallback: RGB): RGB {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length !== 6) return fallback;
  const n = Number.parseInt(cleaned, 16);
  if (!Number.isFinite(n)) return fallback;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * WinAnsi (Helvetica) draws en/em dashes, curly quotes, bullets, middle dots,
 * ellipses and NBSP; `sanitizePdfText` flattens them to ASCII. Keep them.
 */
const NON_TYPOGRAPHIC_RUN =
  /[^\u00a0\u00b7\u2013\u2014\u2018\u2019\u201a\u201c\u201d\u201e\u2022\u2026\u20ac\u2122]+/g;

function pdfText(input: string): string {
  return input.replace(NON_TYPOGRAPHIC_RUN, (run) => sanitizePdfText(run));
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function trackedWidth(
  text: string,
  font: PDFFont,
  size: number,
  tracking = 0,
): number {
  return (
    font.widthOfTextAtSize(text, size) + tracking * Math.max(0, text.length - 1)
  );
}

function drawText(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    color: RGB;
    tracking?: number;
    opacity?: number;
  },
): number {
  const safe = pdfText(text);
  if (!safe) return 0;
  const tracking = opts.tracking ?? 0;
  if (tracking) page.pushOperators(setCharacterSpacing(tracking));
  page.drawText(safe, {
    x: opts.x,
    y: opts.y,
    size: opts.size,
    font: opts.font,
    color: opts.color,
    opacity: opts.opacity,
  });
  if (tracking) page.pushOperators(setCharacterSpacing(0));
  return trackedWidth(safe, opts.font, opts.size, tracking);
}

/** Small uppercase label with open tracking. */
function drawEyebrow(
  page: PDFPage,
  ctx: RenderCtx,
  text: string,
  opts: { x: number; y: number; color: RGB; size?: number; opacity?: number },
): number {
  return drawText(page, text.toUpperCase(), {
    x: opts.x,
    y: opts.y,
    size: opts.size ?? 7,
    font: ctx.fontBold,
    color: opts.color,
    tracking: 1.1,
    opacity: opts.opacity,
  });
}

function wrapParagraph(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  const safe = pdfText(keepPostcodesTogether(collapsed));
  if (!safe) return [];

  const lines: string[] = [];
  let line = '';
  for (const word of safe.split(' ')) {
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

/** Wrapped lines; an empty string marks a paragraph break. */
function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  paragraphs.forEach((paragraph, index) => {
    if (index > 0) lines.push('');
    lines.push(...wrapParagraph(paragraph, font, size, maxWidth));
  });
  return lines;
}

function ellipsize(
  line: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string {
  let base = line.replace(/[\s,.;:–—-]+$/, '');
  while (base && font.widthOfTextAtSize(`${base}…`, size) > maxWidth) {
    base = base.replace(/\s*\S+$/, '');
  }
  return base ? `${base.replace(/[\s,.;:–—-]+$/, '')}…` : '…';
}

/** One line: unchanged when it fits, else shortened with an ellipsis. */
function fitLine(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string {
  const safe = pdfText(text);
  return font.widthOfTextAtSize(safe, size) <= maxWidth
    ? safe
    : ellipsize(safe, font, size, maxWidth);
}

type WrapOptions = {
  x: number;
  y: number;
  font: PDFFont;
  size: number;
  color: RGB;
  maxWidth: number;
  lineHeight?: number;
  maxLines?: number;
  /** Lowest baseline allowed; overflow ends with an ellipsis. */
  minY?: number;
  /** Extra space between paragraphs (defaults to half a line). */
  paragraphGap?: number;
  opacity?: number;
};

function lineHeightOf(opts: Pick<WrapOptions, 'lineHeight' | 'size'>) {
  return opts.lineHeight ?? opts.size * 1.45;
}

function measureWrapped(
  text: string,
  opts: Omit<WrapOptions, 'x' | 'y' | 'color'>,
): number {
  const lineHeight = lineHeightOf(opts);
  const gap = opts.paragraphGap ?? lineHeight * 0.5;
  let lines = wrapText(text, opts.font, opts.size, opts.maxWidth);
  if (opts.maxLines != null) {
    let count = 0;
    lines = lines.filter((l) =>
      l === '' ? count < opts.maxLines! : ++count <= opts.maxLines!,
    );
  }
  return lines.reduce((h, l) => h + (l === '' ? gap : lineHeight), 0);
}

/** Draw wrapped text from baseline `y`; returns the next baseline. */
function drawWrapped(page: PDFPage, text: string, opts: WrapOptions): number {
  const lineHeight = lineHeightOf(opts);
  const gap = opts.paragraphGap ?? lineHeight * 0.5;
  const lines = wrapText(text, opts.font, opts.size, opts.maxWidth);
  let y = opts.y;
  let drawn = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line === '') {
      y -= gap;
      continue;
    }
    if (opts.minY != null && y < opts.minY) break;
    const atLineLimit = opts.maxLines != null && drawn === opts.maxLines - 1;
    const atFloor = opts.minY != null && y - lineHeight < opts.minY;
    const more = lines.slice(i + 1).some((l) => l !== '');
    const last = (atLineLimit || atFloor) && more;
    page.drawText(
      last ? ellipsize(line, opts.font, opts.size, opts.maxWidth) : line,
      {
        x: opts.x,
        y,
        size: opts.size,
        font: opts.font,
        color: opts.color,
        opacity: opts.opacity,
      },
    );
    drawn += 1;
    y -= lineHeight;
    if (last) break;
  }
  return y;
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

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

function isWorkspaceSupabaseHost(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  try {
    return new URL(url).hostname === new URL(base).hostname;
  } catch {
    return false;
  }
}

const BROCHURE_STORAGE_BUCKETS = [
  'commercial-listing-media',
  'brand-assets',
] as const;

async function downloadStorageObjectBytes(
  url: string,
): Promise<Uint8Array | null> {
  if (!isWorkspaceSupabaseHost(url)) return null;

  try {
    // Dynamic import so the admin client is only loaded when HTTP fetch fails.
    const { getSupabaseServerAdminClient } =
      await import('@kit/supabase/server-admin-client');
    const admin = getSupabaseServerAdminClient();

    for (const bucket of BROCHURE_STORAGE_BUCKETS) {
      const path = supabaseStorageObjectPath(url, bucket);
      if (!path) continue;
      const { data, error } = await admin.storage.from(bucket).download(path);
      if (error || !data) continue;
      return new Uint8Array(await data.arrayBuffer());
    }
  } catch {
    return null;
  }

  return null;
}

async function fetchImageBytes(url: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  // Signed listing-media URLs must not be rewritten to /object/public/sign/...
  const normalized = toSupabasePublicStorageUrl(url) ?? url;
  if (!isSafeRemoteImageUrl(normalized)) {
    const fromStorage = await downloadStorageObjectBytes(normalized);
    if (fromStorage) return fromStorage;
    console.error('[brochure-pdf] blocked unsafe image url host');
    return null;
  }
  try {
    const res = await fetch(normalized, {
      cache: 'no-store',
      headers: { Accept: 'image/png,image/jpeg,image/webp,image/*,*/*' },
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const contentType = res.headers.get('content-type') ?? '';
      if (
        contentType &&
        !contentType.startsWith('image/') &&
        !contentType.includes('octet-stream')
      ) {
        console.error(
          '[brochure-pdf] blocked non-image content-type:',
          contentType,
        );
      } else {
        return new Uint8Array(await res.arrayBuffer());
      }
    } else {
      console.error('[brochure-pdf] image fetch failed:', res.status);
    }
  } catch {
    // Fall through to workspace storage download.
  }

  return downloadStorageObjectBytes(normalized);
}

async function convertImageBytesToJpeg(
  bytes: Uint8Array,
): Promise<Uint8Array | null> {
  try {
    const sharp = (await import('sharp')).default;
    const jpeg = await sharp(bytes).rotate().jpeg({ quality: 88 }).toBuffer();
    return new Uint8Array(jpeg);
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
      const converted = await convertImageBytesToJpeg(bytes);
      if (converted) {
        try {
          return await pdf.embedJpg(converted);
        } catch {
          // handled below
        }
      }
      console.error('[brochure-pdf] failed to embed image bytes');
      return null;
    }
  }
}

function clipToBox(page: PDFPage, box: Box) {
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

/** Fill `box` completely, cropping the overflow. */
function drawImageCover(page: PDFPage, image: PDFImage, box: Box) {
  if (box.width <= 0 || box.height <= 0) return;
  const scale = Math.max(box.width / image.width, box.height / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  clipToBox(page, box);
  page.drawImage(image, {
    x: box.x + (box.width - w) / 2,
    y: box.y + (box.height - h) / 2,
    width: w,
    height: h,
  });
  page.pushOperators(popGraphicsState());
}

function drawPlaceholder(page: PDFPage, ctx: RenderCtx, box: Box) {
  page.drawRectangle({ ...box, color: ctx.colors.soft });
}

/**
 * Photo inside `area` at its own aspect (cropping at most `maxCrop`). The
 * frame shrinks instead of painting letterbox bars, and never upscales a
 * small image beyond MAX_UPSCALE.
 */
function drawPhoto(
  page: PDFPage,
  ctx: RenderCtx,
  image: PDFImage | null,
  area: Box,
  opts: {
    maxCrop?: number;
    align?: 'top' | 'center';
    anchorLeft?: boolean;
  } = {},
): Box | null {
  if (area.width <= 0 || area.height <= 0) return null;
  if (!image) {
    drawPlaceholder(page, ctx, area);
    return area;
  }

  let box = fitPhotoBox(image.width / image.height, area, opts);
  const scale = Math.max(box.width / image.width, box.height / image.height);
  if (scale > MAX_UPSCALE) {
    const k = MAX_UPSCALE / scale;
    const width = box.width * k;
    const height = box.height * k;
    box = {
      x: area.x + (area.width - width) / 2,
      y:
        opts.align === 'top'
          ? area.y + area.height - height
          : area.y + (area.height - height) / 2,
      width,
      height,
    };
  }
  if (opts.anchorLeft) box = { ...box, x: area.x };

  drawImageCover(page, image, box);
  return box;
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

function roundedRectPath(w: number, h: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  const k = 0.5523 * r;
  return [
    `M ${r} 0`,
    `H ${w - r}`,
    `C ${w - r + k} 0 ${w} ${r - k} ${w} ${r}`,
    `V ${h - r}`,
    `C ${w} ${h - r + k} ${w - r + k} ${h} ${w - r} ${h}`,
    `H ${r}`,
    `C ${r - k} ${h} 0 ${h - r + k} 0 ${h - r}`,
    `V ${r}`,
    `C 0 ${r - k} ${r - k} 0 ${r} 0`,
    'Z',
  ].join(' ');
}

function drawRoundedRect(
  page: PDFPage,
  box: Box,
  radius: number,
  opts: { color?: RGB; borderColor?: RGB; borderWidth?: number },
) {
  page.drawSvgPath(roundedRectPath(box.width, box.height, radius), {
    // SVG paths draw downward from (x, y).
    x: box.x,
    y: box.y + box.height,
    color: opts.color,
    borderColor: opts.borderColor,
    borderWidth: opts.borderWidth,
  });
}

function drawHairline(
  page: PDFPage,
  ctx: RenderCtx,
  x1: number,
  x2: number,
  y: number,
  color?: RGB,
  opacity?: number,
) {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness: 0.5,
    color: color ?? ctx.colors.hairline,
    opacity,
  });
}

/** Icon (or numbered) disc matching the map's amenity pins. */
function drawAmenityBadge(
  page: PDFPage,
  ctx: RenderCtx,
  amenity: { label: string; index: number; icon?: AmenityIcon | null },
  cx: number,
  cy: number,
) {
  const radius = 7.5;
  page.drawCircle({ x: cx, y: cy, size: radius, color: ctx.colors.accent });
  const icon = resolveAmenityIcon(amenity);
  if (icon) {
    const glyph = 9;
    const scale = glyph / AMENITY_ICON_VIEWBOX;
    // SVG paths draw downward from (x, y), so anchor at the glyph's top-left.
    page.drawSvgPath(AMENITY_ICON_PATHS[icon], {
      x: cx - glyph / 2,
      y: cy + glyph / 2,
      scale,
      color: ctx.colors.paper,
    });
    return;
  }
  const label = String(amenity.index);
  const size = 7;
  page.drawText(label, {
    x: cx - ctx.fontBold.widthOfTextAtSize(label, size) / 2,
    y: cy - size * 0.36,
    size,
    font: ctx.fontBold,
    color: ctx.colors.paper,
  });
}

// ---------------------------------------------------------------------------
// Context + page chrome
// ---------------------------------------------------------------------------

type RenderCtx = {
  pdf: PDFDocument;
  data: PublicBrochureData;
  colors: BrandColors;
  /** Brand body font (Helvetica by default). */
  font: PDFFont;
  fontBold: PDFFont;
  /** Brand heading font for titles and lead paragraphs (Lora by default). */
  heading: PDFFont;
  headingBold: PDFFont;
  orientation: BrochureOrientation;
  templateId: BrochureTemplateId;
  imageCache: Map<string, PDFImage | null>;
  imageById: Map<string, string>;
  floorplanById: Map<string, string>;
  logo: PDFImage | null;
  /** "10 High Street, Otford" — eyebrow on inner pages. */
  runningTitle: string;
  /** Listing photos no page slot uses (for the facts page). */
  spareImageUrls: string[];
  pageNumber: number;
  totalPages: number;
};

function slotText(
  slots: Record<string, BrochureSlotValue>,
  key: string,
): string {
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
  if (templateId === 'compact') return 32;
  if (templateId === 'editorial') return 48;
  return 44;
}

function coverBandRatio(templateId: BrochureTemplateId) {
  if (templateId === 'editorial') return 0.32;
  if (templateId === 'compact') return 0.38;
  return 0.37;
}

function typeScale(ctx: RenderCtx) {
  const landscape = ctx.orientation === 'landscape';
  const compact = ctx.templateId === 'compact';
  const editorial = ctx.templateId === 'editorial';
  const body = compact ? 9 : 9.5;
  return {
    title: editorial
      ? landscape
        ? 28
        : 26
      : compact
        ? 19
        : landscape
          ? 24
          : 22,
    body,
    leading: compact ? 13.5 : 14.5,
    small: 8,
  };
}

function hasSideTab(ctx: RenderCtx) {
  return ctx.templateId === 'editorial' && ctx.orientation === 'landscape';
}

/** Editorial keeps its side tab; classic and compact get header/footer bands. */
function hasBands(ctx: RenderCtx) {
  return ctx.templateId !== 'editorial';
}

/** Bottom edge of the header band's accent rule. */
function bandsTop(page: PDFPage) {
  return page.getSize().height - HEADER_BAND_H - HEADER_RULE_H;
}

/** Area between the bands, edge to edge (for full-bleed photos and maps). */
function bleedArea(page: PDFPage, fromX: number): Box {
  const { width } = page.getSize();
  return {
    x: fromX,
    y: FOOTER_BAND_H,
    width: width - fromX,
    height: bandsTop(page) - FOOTER_BAND_H,
  };
}

function contentFrame(page: PDFPage, ctx: RenderCtx) {
  const { width, height } = page.getSize();
  const margin = templateMargins(ctx.templateId);
  const right = width - margin - (hasSideTab(ctx) ? EDITORIAL_TAB_WIDTH : 0);
  return {
    left: margin,
    right,
    top: hasBands(ctx) ? bandsTop(page) - 34 : height - margin,
    width: right - margin,
  };
}

function drawSectionTab(
  page: PDFPage,
  ctx: RenderCtx,
  label: string | undefined,
  number: string | undefined,
) {
  if (!hasSideTab(ctx) || (!label && !number)) return;
  const { width, height } = page.getSize();
  page.drawRectangle({
    x: width - EDITORIAL_TAB_WIDTH,
    y: 0,
    width: EDITORIAL_TAB_WIDTH,
    height,
    color: ctx.colors.primary,
  });
  const text = [number, label].filter(Boolean).join('   ').toUpperCase();
  if (text) {
    page.pushOperators(setCharacterSpacing(1.1));
    page.drawText(pdfText(text), {
      x: width - 11,
      y: 48,
      size: 7,
      font: ctx.fontBold,
      color: ctx.colors.paper,
      rotate: degrees(90),
    });
    page.pushOperators(setCharacterSpacing(0));
  }
}

const PAGE_EYEBROWS: Partial<Record<BrochurePage['layoutId'], string>> = {
  facts_table: 'The opportunity',
  description_highlights: 'Description',
  details_columns: 'Particulars',
  floorplan: 'Accommodation',
  map_amenities: 'Location',
  contact: 'Viewing & enquiries',
};

/** "Otford, Sevenoaks" for the location page title; null when unknown. */
function locationHeadline(listing: BrochureListing): string | null {
  const parts = [listing.addressLine2, listing.town]
    .map((p) => p?.trim() ?? '')
    .filter((p) => p && !/\d/.test(p));
  const unique = parts.filter(
    (p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i,
  );
  return unique.length ? unique.join(', ') : null;
}

/**
 * Eyebrow + title (+ a short accent rule on unbanded pages). Long titles wrap
 * to two lines within `maxWidth`. Returns the first content baseline.
 */
function drawPageHeader(
  page: PDFPage,
  ctx: RenderCtx,
  brochurePage: BrochurePage,
  title: string,
  maxWidth?: number,
): number {
  const frame = contentFrame(page, ctx);
  const type = typeScale(ctx);
  const width = maxWidth ?? frame.width;
  const editorialSection =
    ctx.templateId === 'editorial' && brochurePage.sectionNumber
      ? `${brochurePage.sectionNumber}   ${brochurePage.sectionLabel ?? ''}`
      : null;
  const banded = hasBands(ctx);
  const eyebrow = banded
    ? (PAGE_EYEBROWS[brochurePage.layoutId] ?? brochurePage.sectionLabel ?? '')
    : (editorialSection ?? ctx.runningTitle);

  const eyebrowY = frame.top - 7;
  drawEyebrow(page, ctx, eyebrow, {
    x: frame.left,
    y: eyebrowY,
    color: banded || editorialSection ? ctx.colors.accent : ctx.colors.muted,
  });

  const lineHeight = type.title * 1.12;
  const titleY = eyebrowY - 12 - type.title * 0.72;
  const next = drawWrapped(page, title, {
    x: frame.left,
    y: titleY,
    font: ctx.headingBold,
    size: type.title,
    lineHeight,
    color: ctx.colors.ink,
    maxWidth: width,
    maxLines: 2,
  });
  const lastBaseline = next + lineHeight;

  if (banded) return lastBaseline - 30;

  page.drawRectangle({
    x: frame.left,
    y: lastBaseline - 14,
    width: 28,
    height: 2,
    color: ctx.colors.accent,
  });
  return lastBaseline - 14 - 26;
}

function drawBands(page: PDFPage, ctx: RenderCtx) {
  const { width, height } = page.getSize();
  const margin = templateMargins(ctx.templateId);
  const { listing, branch } = ctx.data;

  page.drawRectangle({
    x: 0,
    y: height - HEADER_BAND_H,
    width,
    height: HEADER_BAND_H,
    color: ctx.colors.primary,
  });
  page.drawRectangle({
    x: 0,
    y: bandsTop(page),
    width,
    height: HEADER_RULE_H,
    color: ctx.colors.accent,
  });

  const midY = height - HEADER_BAND_H / 2;
  let textLeft = margin;
  if (ctx.logo) {
    const logoH = Math.min(20, (110 / ctx.logo.width) * ctx.logo.height);
    const drawn = drawLogo(page, ctx.logo, {
      x: margin,
      y: midY + logoH / 2,
      maxWidth: 110,
      maxHeight: 20,
    });
    textLeft = margin + drawn.width + 24;
  } else if (ctx.data.accountName) {
    textLeft +=
      drawText(page, ctx.data.accountName, {
        x: margin,
        y: midY - 3.5,
        size: 10,
        font: ctx.headingBold,
        color: ctx.colors.paper,
      }) + 24;
  }

  const postcode = listing.postcode?.trim() ?? '';
  const right = width - margin;
  const postcodeW = postcode
    ? trackedWidth(pdfText(postcode), ctx.font, 7.5, 0.4)
    : 0;
  const titleMax = right - textLeft - (postcode ? postcodeW + 14 : 0);
  const title = fitLine(
    ctx.runningTitle,
    ctx.fontBold,
    7.5,
    Math.max(0, titleMax),
  );
  const titleW = ctx.fontBold.widthOfTextAtSize(title, 7.5);
  const titleX = right - (postcode ? postcodeW + 14 : 0) - titleW;
  if (titleMax > 40) {
    drawText(page, title, {
      x: titleX,
      y: midY - 2.7,
      size: 7.5,
      font: ctx.fontBold,
      color: ctx.colors.paper,
    });
  }
  if (postcode) {
    drawText(page, postcode, {
      x: right - postcodeW,
      y: midY - 2.7,
      size: 7.5,
      font: ctx.font,
      color: ctx.colors.paperMuted,
      tracking: 0.4,
    });
  }

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height: FOOTER_BAND_H,
    color: ctx.colors.soft,
  });
  const footY = FOOTER_BAND_H / 2 - 2.5;
  const pageNo = String(ctx.pageNumber).padStart(2, '0');
  const pageNoW = trackedWidth(pageNo, ctx.fontBold, 8, 0.6);
  drawText(page, pageNo, {
    x: right - pageNoW,
    y: footY,
    size: 8,
    font: ctx.fontBold,
    color: ctx.colors.ink,
    tracking: 0.6,
  });
  const notice = 'Subject to contract';
  const noticeW = trackedWidth(notice, ctx.font, 7, 0.2);
  const noticeX = right - pageNoW - 18 - noticeW;
  drawText(page, notice, {
    x: noticeX,
    y: footY,
    size: 7,
    font: ctx.font,
    color: ctx.colors.muted,
    tracking: 0.2,
  });
  const office = [
    ctx.data.accountName?.trim(),
    branch?.address?.replace(/\s*\n\s*/g, ', ').trim(),
    branch?.phone?.trim(),
  ]
    .filter(Boolean)
    .join('  ·  ');
  if (office) {
    drawText(page, fitLine(office, ctx.font, 7, noticeX - 24 - margin), {
      x: margin,
      y: footY,
      size: 7,
      font: ctx.font,
      color: ctx.colors.muted,
    });
  }
}

function drawFooter(page: PDFPage, ctx: RenderCtx) {
  if (hasBands(ctx)) {
    drawBands(page, ctx);
    return;
  }
  const frame = contentFrame(page, ctx);
  drawHairline(page, ctx, frame.left, frame.right, FOOTER_BASELINE + 12);

  const left = [ctx.data.accountName?.trim(), 'Subject to contract']
    .filter(Boolean)
    .join('  ·  ');
  drawText(page, left, {
    x: frame.left,
    y: FOOTER_BASELINE,
    size: 7,
    font: ctx.font,
    color: ctx.colors.muted,
    tracking: 0.2,
  });

  const pad = (n: number) => String(n).padStart(2, '0');
  const right = `${pad(ctx.pageNumber)} / ${pad(ctx.totalPages)}`;
  const w = trackedWidth(right, ctx.fontBold, 7, 0.6);
  drawText(page, right, {
    x: frame.right - w,
    y: FOOTER_BASELINE,
    size: 7,
    font: ctx.fontBold,
    color: ctx.colors.muted,
    tracking: 0.6,
  });
}

// ---------------------------------------------------------------------------
// Shared blocks
// ---------------------------------------------------------------------------

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

async function resolveListingImage(
  ctx: RenderCtx,
  slot: { mediaId: string | null; url: string | null } | null,
  fallbackUrl?: string | null,
): Promise<PDFImage | null> {
  const tried = new Set<string>();
  const fromId = slot?.mediaId
    ? (ctx.imageById.get(slot.mediaId) ??
      ctx.floorplanById.get(slot.mediaId) ??
      null)
    : null;
  for (const url of [slot?.url, fromId, fallbackUrl]) {
    if (!url || tried.has(url)) continue;
    tried.add(url);
    const img = await resolveImage(ctx, url);
    if (img) return img;
  }
  return null;
}

function listingCoverUrl(data: PublicBrochureData): string | null {
  return (
    data.images.find((item) => item.isCover)?.url ?? data.images[0]?.url ?? null
  );
}

function stripBulletPrefix(line: string): string {
  return line.replace(/^[\s]*[-–—*•·]\s*/, '').trim();
}

function drawBulletList(
  page: PDFPage,
  ctx: RenderCtx,
  items: string[],
  opts: {
    x: number;
    y: number;
    maxWidth: number;
    minY?: number;
  },
): number {
  const type = typeScale(ctx);
  let y = opts.y;
  for (const raw of items) {
    const item = stripBulletPrefix(raw);
    if (!item) continue;
    if (opts.minY != null && y < opts.minY) break;
    page.drawRectangle({
      x: opts.x,
      y: y + type.body * 0.28,
      width: 4,
      height: 4,
      color: ctx.colors.accent,
    });
    y = drawWrapped(page, item, {
      x: opts.x + 14,
      y,
      font: ctx.font,
      size: type.body,
      color: ctx.colors.ink,
      maxWidth: Math.max(40, opts.maxWidth - 14),
      lineHeight: type.leading,
      maxLines: 3,
      minY: opts.minY,
    });
    y -= 5;
  }
  return y;
}

function measureBulletList(
  ctx: RenderCtx,
  items: string[],
  maxWidth: number,
): number {
  const type = typeScale(ctx);
  return items.reduce(
    (h, raw) =>
      h +
      measureWrapped(stripBulletPrefix(raw), {
        font: ctx.font,
        size: type.body,
        maxWidth: Math.max(40, maxWidth - 14),
        lineHeight: type.leading,
        maxLines: 3,
      }) +
      5,
    0,
  );
}

function leadType(ctx: RenderCtx) {
  const size = typeScale(ctx).body + 3;
  return { size, leading: size * 1.42 };
}

/** Body copy; with `lead`, the opening line is set larger in the heading font. */
function drawBodyCopy(
  page: PDFPage,
  ctx: RenderCtx,
  text: string,
  opts: {
    x: number;
    y: number;
    maxWidth: number;
    minY: number;
    lead?: boolean;
  },
): number {
  const type = typeScale(ctx);
  const { lead, rest } = opts.lead
    ? splitLeadParagraph(text)
    : { lead: '', rest: text };
  let y = opts.y;
  if (lead) {
    const lt = leadType(ctx);
    y = drawWrapped(page, lead, {
      x: opts.x,
      y: y + type.body - lt.size,
      font: ctx.heading,
      size: lt.size,
      color: ctx.colors.ink,
      maxWidth: opts.maxWidth,
      lineHeight: lt.leading,
      minY: opts.minY,
    });
    if (!rest) return y;
    y -= type.leading * 0.5;
  }
  return drawWrapped(page, rest, {
    x: opts.x,
    y,
    font: ctx.font,
    size: type.body,
    color: ctx.colors.ink,
    maxWidth: opts.maxWidth,
    lineHeight: type.leading,
    minY: opts.minY,
  });
}

function measureBodyCopy(
  ctx: RenderCtx,
  text: string,
  width: number,
  withLead = false,
): number {
  const type = typeScale(ctx);
  const { lead, rest } = withLead
    ? splitLeadParagraph(text)
    : { lead: '', rest: text };
  const lt = leadType(ctx);
  const leadH = lead
    ? measureWrapped(lead, {
        font: ctx.heading,
        size: lt.size,
        maxWidth: width,
        lineHeight: lt.leading,
      }) + (rest ? type.leading * 0.5 : 0)
    : 0;
  const restH = rest
    ? measureWrapped(rest, {
        font: ctx.font,
        size: type.body,
        maxWidth: width,
        lineHeight: type.leading,
      })
    : 0;
  return leadH + restH;
}

function drawLinkButtons(
  page: PDFPage,
  ctx: RenderCtx,
  buttons: ReturnType<typeof resolveBrochureLinkButtons>,
  opts: {
    x: number;
    y: number;
    maxWidth: number;
    /** Primary (first) button fill + label. */
    fill: RGB;
    text: RGB;
    /** Secondary buttons are outlined. */
    outline: RGB;
    outlineText: RGB;
  },
): number {
  if (buttons.length === 0) return 0;
  const height = 22;
  const padX = 12;
  const size = 7;
  const tracking = 0.8;
  let x = opts.x;
  buttons.forEach((button, index) => {
    const label = pdfText(button.label.toUpperCase());
    const width = trackedWidth(label, ctx.fontBold, size, tracking) + padX * 2;
    if (x + width > opts.x + opts.maxWidth + 1) return;
    const box = { x, y: opts.y, width, height };
    const primary = index === 0;
    drawRoundedRect(page, box, height / 2, {
      color: primary ? opts.fill : undefined,
      borderColor: primary ? undefined : opts.outline,
      borderWidth: primary ? undefined : 0.75,
    });
    drawText(page, label, {
      x: x + padX,
      y: opts.y + (height - size * 0.72) / 2,
      size,
      font: ctx.fontBold,
      color: primary ? opts.text : opts.outlineText,
      tracking,
    });
    addUriLink(page, box, button.url);
    x += width + 8;
  });
  return height;
}

function brochureLinks(ctx: RenderCtx) {
  return resolveBrochureLinkButtons({
    showWebsiteListingButton: ctx.data.showWebsiteListingButton,
    showSlideshowBrochureButton: ctx.data.showSlideshowBrochureButton,
    websiteListingUrl: ctx.data.websiteListingUrl,
    slideshowBrochureUrl: ctx.data.slideshowBrochureUrl,
  });
}

function drawLogo(
  page: PDFPage,
  logo: PDFImage | null,
  opts: {
    x: number;
    y: number;
    maxWidth: number;
    maxHeight: number;
    alignRight?: boolean;
  },
) {
  if (!logo) return { width: 0, height: 0 };
  const scale = Math.min(
    opts.maxWidth / logo.width,
    opts.maxHeight / logo.height,
  );
  const w = logo.width * scale;
  const h = logo.height * scale;
  page.drawImage(logo, {
    x: opts.alignRight ? opts.x - w : opts.x,
    y: opts.y - h,
    width: w,
    height: h,
  });
  return { width: w, height: h };
}

function drawReducedBadge(
  page: PDFPage,
  box: Box,
  ctx: RenderCtx,
  label: string,
) {
  const text = pdfText(label.trim().toUpperCase());
  if (!text || box.width < 40 || box.height < 24) return;

  const sash = hexToRgb(
    brochureSashHex(ctx.data.brand.accentColor),
    rgb(0.78, 0.06, 0.18),
  );
  const size = 7.5;
  const padX = 10;
  const tracking = 0.8;
  const width = Math.min(
    box.width - 16,
    trackedWidth(text, ctx.fontBold, size, tracking) + padX * 2,
  );
  const height = 20;
  const x = box.x + 16;
  const y = box.y + box.height - height - 16;

  drawRoundedRect(page, { x, y, width, height }, height / 2, { color: sash });
  drawText(page, text, {
    x: x + padX,
    y: y + (height - size * 0.72) / 2,
    size,
    font: ctx.fontBold,
    color: ctx.colors.paper,
    tracking,
  });
}

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------

const COVER_FACT_LABELS: Record<string, string> = {
  size: 'Size',
  rent: 'Rent',
  price: 'Price',
};

/** "new_lease" -> "New lease"; leaves already-formatted values alone. */
function humanizeValue(value: string | null | undefined): string {
  const text = value?.trim().replace(/_/g, ' ') ?? '';
  return text ? text[0]!.toUpperCase() + text.slice(1) : '';
}

/** Size, use, tenure and terms for the cover grid (legacy: headline lines). */
function resolveCoverFacts(
  slots: Record<string, BrochureSlotValue>,
  listing: BrochureListing,
): Array<{ label: string; value: string }> {
  const fact = (key: string) => ({
    label: COVER_FACT_LABELS[key]!,
    value: slotText(slots, key).trim(),
  });
  const terms = [fact('rent'), fact('price')].filter((f) => f.value);
  const size = fact('size');
  if (!size.value && terms.length === 0) {
    return parseCoverPriceLines(slotText(slots, 'headline')).map((value) => ({
      label: '',
      value,
    }));
  }
  return [
    size,
    { label: 'Use', value: humanizeValue(listing.sector) },
    { label: 'Tenure', value: humanizeValue(listing.tenure) },
    ...terms,
  ].filter((f) => f.value);
}

/** Accent pill ("TO LET"); returns its height. */
function drawDisposalBadge(
  page: PDFPage,
  ctx: RenderCtx,
  label: string,
  x: number,
  top: number,
): number {
  const text = label.toUpperCase();
  const size = 7.5;
  const tracking = 1.2;
  const h = 20;
  const w = trackedWidth(pdfText(text), ctx.fontBold, size, tracking) + 20;
  drawRoundedRect(page, { x, y: top - h, width: w, height: h }, 2, {
    color: ctx.colors.accent,
  });
  drawText(page, text, {
    x: x + 10,
    y: top - h / 2 - size * 0.36,
    size,
    font: ctx.fontBold,
    color: ctx.colors.paper,
    tracking,
  });
  return h;
}

/**
 * Two-column label/value grid with hairlines, anchored at `bottom`; returns
 * the grid's top edge.
 */
function drawCoverFactsGrid(
  page: PDFPage,
  ctx: RenderCtx,
  facts: Array<{ label: string; value: string }>,
  opts: { x: number; bottom: number; width: number; valueSize: number },
): number {
  if (facts.length === 0) return opts.bottom;
  const columns = facts.length > 1 ? 2 : 1;
  const rows = Math.ceil(facts.length / columns);
  const rowH = opts.valueSize + 32;
  const colW = opts.width / columns;
  const widest = Math.max(
    ...facts.map((f) =>
      ctx.fontBold.widthOfTextAtSize(pdfText(f.value), opts.valueSize),
    ),
  );
  const valueSize = Math.max(
    opts.valueSize - 2.5,
    Math.min(opts.valueSize, (opts.valueSize * (colW - 14)) / widest),
  );
  const top = opts.bottom + rows * rowH;
  const line = (y: number) =>
    drawHairline(
      page,
      ctx,
      opts.x,
      opts.x + opts.width,
      y,
      ctx.colors.paper,
      0.22,
    );

  for (let r = 0; r <= rows; r++) line(top - r * rowH);
  if (columns > 1) {
    page.drawLine({
      start: { x: opts.x + colW, y: opts.bottom },
      end: { x: opts.x + colW, y: top },
      thickness: 0.5,
      color: ctx.colors.paper,
      opacity: 0.22,
    });
  }

  facts.forEach((fact, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const cellX = opts.x + col * colW + (col > 0 ? 14 : 0);
    const cellW = colW - 14;
    const rowTop = top - row * rowH;
    if (fact.label) {
      drawEyebrow(page, ctx, fact.label, {
        x: cellX,
        y: rowTop - 15,
        size: 6.5,
        color: ctx.colors.paperMuted,
        opacity: 0.85,
      });
    }
    drawText(page, fitLine(fact.value, ctx.fontBold, valueSize, cellW), {
      x: cellX,
      y: rowTop - (fact.label ? 21 : 15) - valueSize * 0.72,
      size: valueSize,
      font: ctx.fontBold,
      color: ctx.colors.paper,
    });
  });
  return top;
}

async function renderCover(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  const { width, height } = page.getSize();
  const landscape = ctx.orientation === 'landscape';
  const heroImg = await resolveListingImage(
    ctx,
    slotImage(brochurePage.slots, 'hero'),
    listingCoverUrl(ctx.data),
  );
  const { title, subtitle } = coverHeadline(
    coverTitleParts(
      slotText(brochurePage.slots, 'title'),
      slotText(brochurePage.slots, 'address'),
    ),
  );
  const disposal = slotText(brochurePage.slots, 'disposal').trim();
  const brandName = slotText(brochurePage.slots, 'brandName');
  const facts = resolveCoverFacts(brochurePage.slots, ctx.data.listing);
  const reducedLabel =
    slotText(brochurePage.slots, 'reducedBadge').trim() ||
    (ctx.data.showReducedPrice ? 'REDUCED PRICE' : '');
  const links = brochureLinks(ctx);
  const titleSize =
    ctx.templateId === 'editorial'
      ? landscape
        ? 32
        : 30
      : ctx.templateId === 'compact'
        ? landscape
          ? 24
          : 22
        : landscape
          ? 28
          : 26;
  const pad = 32;

  const drawBrandFallback = (x: number, y: number, alignRight = false) => {
    const label = brandName || ctx.data.accountName || '';
    if (!label) return 0;
    const w = trackedWidth(pdfText(label), ctx.fontBold, 11, 0.4);
    drawText(page, label, {
      x: alignRight ? x - w : x,
      y: y - 11,
      size: 11,
      font: ctx.fontBold,
      color: ctx.colors.paper,
      tracking: 0.4,
    });
    return 14;
  };

  const drawTitleBlock = (x: number, top: number, w: number, minY: number) => {
    let y = top;
    if (disposal) {
      y -= drawDisposalBadge(page, ctx, disposal, x, y) + 20;
    }
    y -= titleSize * 0.72;
    y = drawWrapped(page, title, {
      x,
      y,
      font: ctx.headingBold,
      size: titleSize,
      color: ctx.colors.paper,
      maxWidth: w,
      lineHeight: titleSize * 1.12,
      maxLines: 3,
      minY,
    });
    if (subtitle) {
      drawWrapped(page, subtitle, {
        x,
        y: y - 4,
        font: ctx.font,
        size: 10.5,
        color: ctx.colors.paperMuted,
        maxWidth: w,
        lineHeight: 15,
        maxLines: 3,
        minY,
      });
    }
  };

  if (landscape) {
    const bandW = Math.round(width * coverBandRatio(ctx.templateId));
    const heroW = width - bandW;
    const heroBox = { x: 0, y: 0, width: heroW, height };
    if (heroImg) drawImageCover(page, heroImg, heroBox);
    else drawPlaceholder(page, ctx, heroBox);
    if (reducedLabel) drawReducedBadge(page, heroBox, ctx, reducedLabel);

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

    const x = heroW + pad;
    const innerW = bandW - pad * 2;

    // Bottom-anchored: buttons, then key facts above them.
    let bottom = pad;
    if (links.length > 0) {
      drawLinkButtons(page, ctx, links, {
        x,
        y: bottom,
        maxWidth: innerW,
        fill: ctx.colors.accent,
        text: ctx.colors.paper,
        outline: ctx.colors.paperMuted,
        outlineText: ctx.colors.paper,
      });
      bottom += 22 + 28;
    }
    let factsTop = bottom;
    if (facts.length > 0) {
      factsTop = drawCoverFactsGrid(page, ctx, facts, {
        x,
        bottom,
        width: innerW,
        valueSize: ctx.templateId === 'compact' ? 11.5 : 12.5,
      });
    }

    // Top-anchored: logo, eyebrow, title, address.
    let top = height - pad - 4;
    const logo = drawLogo(page, ctx.logo, {
      x,
      y: top,
      maxWidth: Math.min(innerW, 170),
      maxHeight: 36,
    });
    top -= (logo.height || drawBrandFallback(x, top)) + 40;
    drawTitleBlock(x, top, innerW, factsTop + 28);
  } else {
    const bandH =
      ctx.templateId === 'editorial'
        ? 250
        : ctx.templateId === 'compact'
          ? 210
          : 236;
    const heroBox = { x: 0, y: bandH, width, height: height - bandH };
    if (heroImg) drawImageCover(page, heroImg, heroBox);
    else drawPlaceholder(page, ctx, heroBox);
    if (reducedLabel) drawReducedBadge(page, heroBox, ctx, reducedLabel);

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

    const leftW = width * 0.52 - pad;
    const rightX = width * 0.56;
    const rightW = width - pad - rightX;

    let buttonsTop = pad;
    if (links.length > 0) {
      drawLinkButtons(page, ctx, links, {
        x: pad,
        y: pad,
        maxWidth: leftW,
        fill: ctx.colors.accent,
        text: ctx.colors.paper,
        outline: ctx.colors.paperMuted,
        outlineText: ctx.colors.paper,
      });
      buttonsTop = pad + 22;
    }
    drawTitleBlock(pad, bandH - pad, leftW, buttonsTop + 22);

    const logo = drawLogo(page, ctx.logo, {
      x: width - pad,
      y: bandH - pad,
      maxWidth: rightW,
      maxHeight: 32,
      alignRight: true,
    });
    if (!logo.height) drawBrandFallback(width - pad, bandH - pad, true);

    if (facts.length > 0) {
      drawCoverFactsGrid(page, ctx, facts, {
        x: rightX,
        bottom: pad,
        width: rightW,
        valueSize: ctx.templateId === 'compact' ? 10.5 : 11.5,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Facts / description / details
// ---------------------------------------------------------------------------

function factsTableMetrics(ctx: RenderCtx, width: number) {
  const type = typeScale(ctx);
  const labelW = Math.min(112, width * 0.36);
  const valueSize = type.body + 0.5;
  return {
    labelW,
    valueW: width - labelW,
    valueSize,
    valueLeading: valueSize * 1.35,
  };
}

function factsRowHeight(
  ctx: RenderCtx,
  row: { value: string },
  width: number,
): number {
  const m = factsTableMetrics(ctx, width);
  const lines = Math.min(
    2,
    Math.max(1, wrapText(row.value, ctx.font, m.valueSize, m.valueW).length),
  );
  return 18 + lines * m.valueLeading;
}

/** Height from the first baseline to the table's bottom rule. */
function measureFactsTable(
  ctx: RenderCtx,
  rows: Array<{ value: string }>,
  width: number,
): number {
  if (rows.length === 0) return 0;
  return (
    rows.reduce((h, row) => h + factsRowHeight(ctx, row, width), 0) -
    typeScale(ctx).body
  );
}

function drawFactsTable(
  page: PDFPage,
  ctx: RenderCtx,
  rows: Array<{ label: string; value: string }>,
  opts: { x: number; y: number; width: number; minY: number },
): number {
  const type = typeScale(ctx);
  const { labelW, valueW, valueSize, valueLeading } = factsTableMetrics(
    ctx,
    opts.width,
  );
  // `y` is the first content baseline; the table's top rule sits above it.
  let top = opts.y + type.body;
  drawHairline(page, ctx, opts.x, opts.x + opts.width, top);

  for (const row of rows) {
    const rowH = factsRowHeight(ctx, row, opts.width);
    if (top - rowH < opts.minY) break;
    const baseline = top - 10 - valueSize * 0.78;
    drawEyebrow(page, ctx, row.label, {
      x: opts.x,
      y: baseline + 0.5,
      color: ctx.colors.muted,
    });
    drawWrapped(page, row.value, {
      x: opts.x + labelW,
      y: baseline,
      font: ctx.font,
      size: valueSize,
      color: ctx.colors.ink,
      maxWidth: valueW,
      lineHeight: valueLeading,
      maxLines: 2,
    });
    top -= rowH;
    drawHairline(page, ctx, opts.x, opts.x + opts.width, top);
  }
  return top - 26;
}

function highlightLinesFrom(
  slots: Record<string, BrochureSlotValue>,
  max: number,
): string[] {
  return slotText(slots, 'highlights')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);
}

/** Body copy then key points, flowing within one column. */
function drawCopyColumn(
  page: PDFPage,
  ctx: RenderCtx,
  body: string,
  highlights: string[],
  opts: { x: number; y: number; width: number; minY: number; lead?: boolean },
): number {
  let y = opts.y;
  const listH = highlights.length
    ? 22 + measureBulletList(ctx, highlights, opts.width)
    : 0;
  if (body) {
    y = drawBodyCopy(page, ctx, body, {
      x: opts.x,
      y,
      maxWidth: opts.width,
      lead: opts.lead,
      // Leave room for key points beneath the copy when they fit, but never
      // run below the column floor (footer).
      minY: Math.max(
        opts.minY,
        Math.min(opts.y - 3 * typeScale(ctx).leading, opts.minY + listH),
      ),
    });
    y -= 12;
  }
  if (highlights.length > 0 && y > opts.minY + 30) {
    drawEyebrow(page, ctx, 'Key points', {
      x: opts.x,
      y,
      color: ctx.colors.primary,
    });
    y = drawBulletList(page, ctx, highlights, {
      x: opts.x,
      y: y - 18,
      maxWidth: opts.width,
      minY: opts.minY,
    });
  }
  return y;
}

async function renderFacts(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  const landscape = ctx.orientation === 'landscape';
  drawSectionTab(
    page,
    ctx,
    brochurePage.sectionLabel,
    brochurePage.sectionNumber,
  );
  const frame = contentFrame(page, ctx);
  const title = slotText(brochurePage.slots, 'title') || 'Summary';
  const factsSlot = brochurePage.slots.facts;
  const rows = factsSlot?.type === 'facts' ? factsSlot.rows : [];
  const body = slotText(brochurePage.slots, 'body').trim();
  const highlights = highlightLinesFrom(brochurePage.slots, 8);
  const hasCopy = Boolean(body) || highlights.length > 0;
  const photos = await factsPhotos(brochurePage, ctx);

  if (landscape && hasBands(ctx) && photos.length > 0) {
    // Copy and facts on the left; photos bleed off the right edge.
    const splitX = Math.round(page.getSize().width * 0.52);
    const leftW = splitX - frame.left - 40;
    const contentTop = drawPageHeader(page, ctx, brochurePage, title, leftW);
    const tableH = measureFactsTable(ctx, rows, leftW);
    let y = contentTop;
    if (hasCopy) {
      y =
        drawCopyColumn(page, ctx, body, highlights, {
          x: frame.left,
          y,
          width: leftW,
          minY: Math.min(contentTop - 40, CONTENT_MIN_Y + tableH + 24),
          lead: true,
        }) - 14;
    }
    drawFactsTable(page, ctx, rows, {
      x: frame.left,
      y,
      width: leftW,
      minY: CONTENT_MIN_Y,
    });
    const area = bleedArea(page, splitX);
    drawBleedPhotos(page, photos, area);
    drawSizeStat(page, ctx, rows, area);
    drawFooter(page, ctx);
    return;
  }

  const contentTop = drawPageHeader(page, ctx, brochurePage, title);

  if (landscape) {
    const gutter = 36;
    const leftW = (frame.width - gutter) * 0.48;
    const rightX = frame.left + leftW + gutter;
    const rightW = frame.right - rightX;
    const columnH = contentTop - CONTENT_MIN_Y;
    const tableBottom = drawFactsTable(page, ctx, rows, {
      x: frame.left,
      y: contentTop,
      width: photos.length > 0 || hasCopy ? leftW : frame.width,
      minY: CONTENT_MIN_Y,
    });

    if (photos.length === 0) {
      if (hasCopy) {
        drawCopyColumn(page, ctx, body, highlights, {
          x: rightX,
          y: contentTop,
          width: rightW,
          minY: CONTENT_MIN_Y,
        });
      }
    } else {
      // Brief copy heads the photo column; longer copy runs under the table
      // so the photos keep a usable height.
      const copyH = hasCopy
        ? measureCopyColumn(ctx, body, highlights, rightW)
        : 0;
      // Photos rise to the eyebrow line unless a long header reaches across.
      const type = typeScale(ctx);
      const headerW = Math.max(
        ctx.headingBold.widthOfTextAtSize(title, type.title),
        trackedWidth(ctx.runningTitle.toUpperCase(), ctx.fontBold, 7, 1.1),
      );
      let photoTop = headerW > leftW ? contentTop + type.body : frame.top;
      if (hasCopy && copyH <= columnH * 0.38) {
        photoTop =
          drawCopyColumn(page, ctx, body, highlights, {
            x: rightX,
            y: contentTop,
            width: rightW,
            minY: CONTENT_MIN_Y,
          }) - 10;
      } else if (hasCopy) {
        drawCopyColumn(page, ctx, body, highlights, {
          x: frame.left,
          y: tableBottom,
          width: leftW,
          minY: CONTENT_MIN_Y,
        });
      }
      drawPhotoSet(
        page,
        ctx,
        photos,
        {
          x: rightX,
          y: CONTENT_MIN_Y,
          width: rightW,
          height: photoTop - CONTENT_MIN_Y,
        },
        { anchorLeft: true },
      );
    }
  } else {
    let y = drawFactsTable(page, ctx, rows, {
      x: frame.left,
      y: contentTop,
      width: frame.width,
      minY: CONTENT_MIN_Y,
    });
    if (hasCopy) {
      y = drawCopyColumn(page, ctx, body, highlights, {
        x: frame.left,
        y,
        width: frame.width,
        minY: CONTENT_MIN_Y,
      });
    }
    const photoTop = y - 4;
    if (photos.length > 0 && photoTop - CONTENT_MIN_Y >= 170) {
      drawPhotoSet(page, ctx, photos, {
        x: frame.left,
        y: CONTENT_MIN_Y,
        width: frame.width,
        height: photoTop - CONTENT_MIN_Y,
      });
    }
  }

  drawFooter(page, ctx);
}

/**
 * Facts-page photos from its own slots; documents saved before those slots
 * existed borrow one listing photo no other page uses.
 */
async function factsPhotos(
  brochurePage: BrochurePage,
  ctx: RenderCtx,
): Promise<PDFImage[]> {
  const keys = ['photo1', 'photo2'].filter(
    (key) => brochurePage.slots[key]?.type === 'image',
  );
  if (keys.length === 0 && ctx.templateId === 'editorial') return [];
  const images =
    keys.length > 0
      ? await Promise.all(
          keys.map((key) =>
            resolveListingImage(ctx, slotImage(brochurePage.slots, key)),
          ),
        )
      : [await resolveImage(ctx, ctx.spareImageUrls[0] ?? null)];
  return images.filter((img): img is PDFImage => img != null);
}

/** Photos filling `area` edge to edge, stacked with a thin paper gap. */
function drawBleedPhotos(page: PDFPage, photos: PDFImage[], area: Box) {
  const gap = 4;
  const shown = photos.slice(0, 2);
  const h = (area.height - gap * (shown.length - 1)) / shown.length;
  shown.forEach((img, i) =>
    drawImageCover(page, img, {
      x: area.x,
      y: area.y + area.height - (i + 1) * h - i * gap,
      width: area.width,
      height: h,
    }),
  );
}

/** Headline size ("1,146 / SQ FT MAXIMUM") in an accent block on the photo. */
function drawSizeStat(
  page: PDFPage,
  ctx: RenderCtx,
  rows: Array<{ label: string }>,
  area: Box,
) {
  const { sizeMinSqft, sizeMaxSqft } = ctx.data.listing;
  const sqft = sizeMaxSqft ?? sizeMinSqft;
  if (!sqft || !rows.some((row) => /^size$/i.test(row.label.trim()))) return;
  const ranged = sizeMinSqft != null && sizeMaxSqft != null;
  const value = Math.round(sqft).toLocaleString('en-GB');
  const label =
    ranged && sizeMinSqft !== sizeMaxSqft ? 'Sq ft maximum' : 'Sq ft';
  const valueSize = 26;
  const padX = 18;
  const w = Math.max(
    ctx.headingBold.widthOfTextAtSize(value, valueSize),
    trackedWidth(label.toUpperCase(), ctx.fontBold, 6.5, 1.1),
  );
  const box = { x: area.x, y: area.y, width: w + padX * 2, height: 72 };
  page.drawRectangle({ ...box, color: ctx.colors.accent });
  drawText(page, value, {
    x: box.x + padX,
    y: box.y + 32,
    size: valueSize,
    font: ctx.headingBold,
    color: ctx.colors.paper,
  });
  drawEyebrow(page, ctx, label, {
    x: box.x + padX,
    y: box.y + 17,
    size: 6.5,
    color: ctx.colors.paper,
  });
}

/** One photo at its own aspect, or a justified set filling the area. */
function drawPhotoSet(
  page: PDFPage,
  ctx: RenderCtx,
  photos: PDFImage[],
  area: Box,
  opts: { anchorLeft?: boolean } = {},
) {
  if (area.height < 80) return;
  if (photos.length === 1) {
    drawPhoto(page, ctx, photos[0]!, area, {
      align: 'top',
      maxCrop: 0.3,
      anchorLeft: opts.anchorLeft,
    });
    return;
  }
  const boxes = layoutPhotoGrid(
    photos.map((img) => img.width / img.height),
    area,
    { gap: 10, maxCrop: 0.3 },
  );
  if (boxes.length === 0) return;
  // Justified sets can come up short of the area; hang them from the top
  // (and from the copy's left edge when they share a column).
  const top = Math.max(...boxes.map((box) => box.y + box.height));
  const left = Math.min(...boxes.map((box) => box.x));
  const dy = area.y + area.height - top;
  const dx = opts.anchorLeft ? area.x - left : 0;
  boxes.forEach((box, i) =>
    drawImageCover(page, photos[i]!, { ...box, x: box.x + dx, y: box.y + dy }),
  );
}

function measureCopyColumn(
  ctx: RenderCtx,
  body: string,
  highlights: string[],
  width: number,
  withLead = false,
): number {
  const bodyH = body ? measureBodyCopy(ctx, body, width, withLead) + 12 : 0;
  const listH = highlights.length
    ? 22 + measureBulletList(ctx, highlights, width)
    : 0;
  return bodyH + listH;
}

const PANEL_PAD = 24;
const PANEL_ITEM_SIZE = 9.5;
const PANEL_ITEM_LEADING = 13.5;
const PANEL_ITEM_GAP = 18;

function panelItemWidth(width: number) {
  return width - PANEL_PAD * 2 - 16;
}

function measureKeyFeaturesPanel(
  ctx: RenderCtx,
  items: string[],
  width: number,
): number {
  const textW = panelItemWidth(width);
  const itemsH = items.reduce(
    (h, item) =>
      h +
      wrapText(stripBulletPrefix(item), ctx.font, PANEL_ITEM_SIZE, textW)
        .length *
        PANEL_ITEM_LEADING +
      PANEL_ITEM_GAP,
    0,
  );
  return PANEL_PAD * 2 + 26 + itemsH - PANEL_ITEM_GAP;
}

/** Navy "Key features" panel hung from `top`; items stop at `minY`. */
function drawKeyFeaturesPanel(
  page: PDFPage,
  ctx: RenderCtx,
  items: string[],
  opts: { x: number; top: number; width: number; minY: number },
) {
  const height = Math.min(
    measureKeyFeaturesPanel(ctx, items, opts.width),
    opts.top - opts.minY,
  );
  page.drawRectangle({
    x: opts.x,
    y: opts.top - height,
    width: opts.width,
    height,
    color: ctx.colors.primary,
  });
  const x = opts.x + PANEL_PAD;
  const textW = panelItemWidth(opts.width);
  const floor = opts.top - height + PANEL_PAD;
  let y = opts.top - PANEL_PAD - 7;
  drawEyebrow(page, ctx, 'Key features', {
    x,
    y,
    color: ctx.colors.paperMuted,
    opacity: 0.85,
  });
  y -= 26;

  for (const [i, item] of items.entries()) {
    const lines = wrapText(
      stripBulletPrefix(item),
      ctx.font,
      PANEL_ITEM_SIZE,
      textW,
    );
    const itemH = lines.length * PANEL_ITEM_LEADING;
    if (y - itemH + PANEL_ITEM_LEADING < floor) break;
    if (i > 0) {
      drawHairline(
        page,
        ctx,
        x,
        opts.x + opts.width - PANEL_PAD,
        y + (PANEL_ITEM_LEADING + PANEL_ITEM_GAP + 4) / 2,
        ctx.colors.paper,
        0.16,
      );
    }
    page.drawRectangle({
      x,
      y: y + 1.5,
      width: 5,
      height: 5,
      color: ctx.colors.accent,
    });
    drawWrapped(page, stripBulletPrefix(item), {
      x: x + 16,
      y,
      font: ctx.font,
      size: PANEL_ITEM_SIZE,
      color: ctx.colors.paper,
      maxWidth: textW,
      lineHeight: PANEL_ITEM_LEADING,
    });
    y -= itemH + PANEL_ITEM_GAP;
  }
}

async function renderDescription(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  const landscape = ctx.orientation === 'landscape';
  drawSectionTab(
    page,
    ctx,
    brochurePage.sectionLabel,
    brochurePage.sectionNumber,
  );
  const frame = contentFrame(page, ctx);
  const title = slotText(brochurePage.slots, 'title') || 'About the property';
  const body = slotText(brochurePage.slots, 'body').trim();
  const highlights = highlightLinesFrom(brochurePage.slots, 10);

  if (hasBands(ctx) && highlights.length > 0) {
    if (landscape) {
      const gutter = 44;
      const leftW = (frame.width - gutter) * 0.56;
      const panelX = frame.left + leftW + gutter;
      const contentTop = drawPageHeader(page, ctx, brochurePage, title, leftW);
      if (body) {
        drawBodyCopy(page, ctx, body, {
          x: frame.left,
          y: contentTop,
          maxWidth: leftW,
          minY: CONTENT_MIN_Y,
          lead: true,
        });
      }
      drawKeyFeaturesPanel(page, ctx, highlights, {
        x: panelX,
        top: frame.top + 6,
        width: frame.right - panelX,
        minY: CONTENT_MIN_Y - 8,
      });
    } else {
      const contentTop = drawPageHeader(page, ctx, brochurePage, title);
      const panelH = measureKeyFeaturesPanel(ctx, highlights, frame.width);
      const bodyFloor = Math.min(
        contentTop - 6 * typeScale(ctx).leading,
        CONTENT_MIN_Y + panelH + 24,
      );
      const y = body
        ? drawBodyCopy(page, ctx, body, {
            x: frame.left,
            y: contentTop,
            maxWidth: frame.width,
            minY: bodyFloor,
            lead: true,
          })
        : contentTop + typeScale(ctx).body;
      drawKeyFeaturesPanel(page, ctx, highlights, {
        x: frame.left,
        top: y - 6,
        width: frame.width,
        minY: CONTENT_MIN_Y - 8,
      });
    }
    drawFooter(page, ctx);
    return;
  }

  const contentTop = drawPageHeader(page, ctx, brochurePage, title);

  if (landscape && highlights.length > 0) {
    const gutter = 40;
    const leftW = (frame.width - gutter) * 0.58;
    const rightX = frame.left + leftW + gutter;
    if (body) {
      drawBodyCopy(page, ctx, body, {
        x: frame.left,
        y: contentTop,
        maxWidth: leftW,
        minY: CONTENT_MIN_Y,
      });
    }
    drawEyebrow(page, ctx, 'Key points', {
      x: rightX,
      y: contentTop,
      color: ctx.colors.primary,
    });
    drawBulletList(page, ctx, highlights, {
      x: rightX,
      y: contentTop - 18,
      maxWidth: frame.right - rightX,
      minY: CONTENT_MIN_Y,
    });
  } else {
    // Long lines are hard to read: cap the measure on wide pages.
    const measure = Math.min(frame.width, landscape ? 520 : frame.width);
    drawCopyColumn(page, ctx, body, highlights, {
      x: frame.left,
      y: contentTop,
      width: measure,
      minY: CONTENT_MIN_Y,
      lead: true,
    });
  }

  drawFooter(page, ctx);
}

const EPC_BANDS: Array<[string, RGB]> = [
  ['A', rgb(0, 0.5, 0.33)],
  ['B', rgb(0.1, 0.71, 0.35)],
  ['C', rgb(0.55, 0.81, 0.27)],
  ['D', rgb(1, 0.84, 0)],
  ['E', rgb(0.99, 0.67, 0.4)],
  ['F', rgb(0.94, 0.5, 0.14)],
  ['G', rgb(0.91, 0.08, 0.23)],
];
const EPC_ROW_H = 11;
const EPC_ROW_GAP = 2.5;
const EPC_HEIGHT = EPC_BANDS.length * (EPC_ROW_H + EPC_ROW_GAP);

function parseEpc(text: string): {
  band: string | null;
  rating: string | null;
} {
  const band = /\b([A-G])\b/i.exec(text)?.[1]?.toUpperCase() ?? null;
  const rating = /\b(\d{1,3})\b/.exec(text)?.[1] ?? null;
  return { band, rating };
}

/** A–G energy rating bars with a pointer at the property's band. */
function drawEpcScale(
  page: PDFPage,
  ctx: RenderCtx,
  opts: {
    x: number;
    top: number;
    width: number;
    band: string | null;
    rating: string | null;
  },
) {
  const pointerW = 40;
  const maxBar = opts.width - pointerW - 8;
  const minBar = maxBar * 0.4;
  EPC_BANDS.forEach(([letter, color], i) => {
    const barW = minBar + ((maxBar - minBar) * i) / (EPC_BANDS.length - 1);
    const y = opts.top - (i + 1) * EPC_ROW_H - i * EPC_ROW_GAP;
    page.drawRectangle({ x: opts.x, y, width: barW, height: EPC_ROW_H, color });
    const textColor =
      letter === 'D' || letter === 'E' ? ctx.colors.ink : ctx.colors.paper;
    page.drawText(letter, {
      x: opts.x + barW - 10,
      y: y + 2.6,
      size: 7.5,
      font: ctx.fontBold,
      color: textColor,
    });
    if (opts.band === letter) {
      const px = opts.x + maxBar + 8;
      page.drawSvgPath(
        `M 0 ${EPC_ROW_H / 2} L 6 0 H ${pointerW} V ${EPC_ROW_H} H 6 Z`,
        { x: px, y: y + EPC_ROW_H, color },
      );
      const label = opts.rating ? `${opts.rating} ${letter}` : letter;
      page.drawText(label, {
        x: px + 10,
        y: y + 2.6,
        size: 7.5,
        font: ctx.fontBold,
        color: textColor,
      });
    }
  });
}

type FlowItem =
  | { kind: 'heading'; text: string }
  | {
      kind: 'line';
      text: string;
      bullet: boolean;
      indent: number;
      paragraphEnd: boolean;
    }
  | { kind: 'epc'; band: string | null; rating: string | null };

async function renderDetails(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  const landscape = ctx.orientation === 'landscape';
  drawSectionTab(
    page,
    ctx,
    brochurePage.sectionLabel,
    brochurePage.sectionNumber,
  );
  const frame = contentFrame(page, ctx);
  const type = typeScale(ctx);
  const title =
    slotText(brochurePage.slots, 'title') || 'Specification & terms';
  const contentTop = drawPageHeader(page, ctx, brochurePage, title);

  const columns = landscape ? 3 : 2;
  const gutter = 28;
  const colW = (frame.width - gutter * (columns - 1)) / columns;

  const items: FlowItem[] = [];
  for (const block of parseDetailsBody(slotText(brochurePage.slots, 'body'))) {
    if (block.kind === 'heading') {
      items.push({ kind: 'heading', text: block.text });
      continue;
    }
    const indent = block.kind === 'bullet' ? 14 : 0;
    const lines = wrapParagraph(block.text, ctx.font, type.body, colW - indent);
    lines.forEach((text, i) =>
      items.push({
        kind: 'line',
        text,
        bullet: block.kind === 'bullet' && i === 0,
        indent,
        paragraphEnd: i === lines.length - 1,
      }),
    );
  }
  const epc = parseEpc(slotText(brochurePage.slots, 'epc'));
  if (epc.band) {
    items.push({ kind: 'heading', text: 'Energy performance' });
    items.push({ kind: 'epc', ...epc });
  }

  let col = 0;
  let y = contentTop;
  const colX = () => frame.left + col * (colW + gutter);
  const nextColumn = () => {
    col += 1;
    y = contentTop;
    return col < columns;
  };
  const heightOf = (item: FlowItem) =>
    item.kind === 'heading'
      ? 22
      : item.kind === 'epc'
        ? EPC_HEIGHT + 6
        : type.leading + (item.paragraphEnd ? 5 : 0);

  const HEADING_GAP = 10;
  const sectionHeight = (start: number) => {
    let h = heightOf(items[start]!) + HEADING_GAP;
    for (let j = start + 1; j < items.length; j++) {
      if (items[j]!.kind === 'heading') break;
      h += heightOf(items[j]!);
    }
    return h;
  };
  // Balance sections across columns rather than filling one to the floor.
  const total = items.reduce(
    (h, item) =>
      h + heightOf(item) + (item.kind === 'heading' ? HEADING_GAP : 0),
    0,
  );
  const target = total / columns;

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    let needed = heightOf(item);
    // Keep a heading with its first line.
    if (item.kind === 'heading' && items[i + 1]) {
      needed += heightOf(items[i + 1]!);
    }
    const used = contentTop - y;
    const overflows = y - needed < CONTENT_MIN_Y - type.leading;
    const pastTarget =
      item.kind === 'heading' &&
      col < columns - 1 &&
      used + sectionHeight(i) / 2 > target;
    if ((overflows || pastTarget) && y !== contentTop) {
      if (!nextColumn()) break;
    }

    if (item.kind === 'heading') {
      if (y !== contentTop) y -= HEADING_GAP;
      drawEyebrow(page, ctx, item.text, {
        x: colX(),
        y,
        color: ctx.colors.primary,
      });
      y -= 18;
    } else if (item.kind === 'epc') {
      drawEpcScale(page, ctx, {
        x: colX(),
        top: y + type.body * 0.8,
        width: Math.min(colW, 220),
        band: item.band,
        rating: item.rating,
      });
      y -= EPC_HEIGHT + 6;
    } else {
      if (item.bullet) {
        page.drawRectangle({
          x: colX(),
          y: y + type.body * 0.28,
          width: 4,
          height: 4,
          color: ctx.colors.accent,
        });
      }
      page.drawText(item.text, {
        x: colX() + item.indent,
        y,
        size: type.body,
        font: ctx.font,
        color: ctx.colors.ink,
      });
      y -= heightOf(item);
    }
  }

  drawFooter(page, ctx);
}

// ---------------------------------------------------------------------------
// Photos + floorplan
// ---------------------------------------------------------------------------

async function renderPhotoFull(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  const { width, height } = page.getSize();
  const img = await resolveListingImage(
    ctx,
    slotImage(brochurePage.slots, 'photo'),
    ctx.data.images.find((item) => !item.isCover)?.url ??
      listingCoverUrl(ctx.data),
  );
  if (hasBands(ctx)) {
    drawPhoto(page, ctx, img, bandedPhotoArea(page, ctx), { maxCrop: 0.25 });
    drawFooter(page, ctx);
    return;
  }
  const inset = ctx.templateId === 'editorial' ? 0 : 24;
  const tab = hasSideTab(ctx) ? EDITORIAL_TAB_WIDTH : 0;
  const area = {
    x: inset,
    y: inset,
    width: width - inset * 2 - tab,
    height: height - inset * 2,
  };
  if (ctx.templateId === 'editorial' && img) {
    drawImageCover(page, img, area);
  } else {
    drawPhoto(page, ctx, img, area, { maxCrop: 0.25 });
  }
  drawSectionTab(
    page,
    ctx,
    brochurePage.sectionLabel,
    brochurePage.sectionNumber,
  );
}

/** Photo pages between the bands, inset from the edges. */
function bandedPhotoArea(page: PDFPage, ctx: RenderCtx): Box {
  const { width } = page.getSize();
  const margin = templateMargins(ctx.templateId);
  const gap = 20;
  return {
    x: margin,
    y: FOOTER_BAND_H + gap,
    width: width - margin * 2,
    height: bandsTop(page) - FOOTER_BAND_H - gap * 2,
  };
}

async function renderPhotoGrid(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
  keys: string[],
) {
  const { width, height } = page.getSize();
  // Fall back only to unused photos so a broken slot never repeats another page's image.
  const imgs = await Promise.all(
    keys.map((key, i) =>
      resolveListingImage(
        ctx,
        slotImage(brochurePage.slots, key),
        ctx.spareImageUrls[i] ?? null,
      ),
    ),
  );
  const margin = ctx.templateId === 'editorial' ? 20 : 24;
  const tab = hasSideTab(ctx) ? EDITORIAL_TAB_WIDTH : 0;
  const area = hasBands(ctx)
    ? bandedPhotoArea(page, ctx)
    : {
        x: margin,
        y: margin,
        width: width - margin * 2 - tab,
        height: height - margin * 2,
      };
  const boxes = layoutPhotoGrid(
    imgs.map((img) => (img ? img.width / img.height : 1.5)),
    area,
    { gap: 10 },
  );
  boxes.forEach((box, i) => {
    const img = imgs[i];
    if (img) drawImageCover(page, img, box);
    else drawPlaceholder(page, ctx, box);
  });
  if (hasBands(ctx)) {
    drawFooter(page, ctx);
    return;
  }
  drawSectionTab(
    page,
    ctx,
    brochurePage.sectionLabel,
    brochurePage.sectionNumber,
  );
}

async function renderFloorplan(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  drawSectionTab(
    page,
    ctx,
    brochurePage.sectionLabel,
    brochurePage.sectionNumber,
  );
  const frame = contentFrame(page, ctx);
  const caption = slotText(brochurePage.slots, 'caption') || 'Floor plan';
  const contentTop = drawPageHeader(page, ctx, brochurePage, caption);
  const img = await resolveListingImage(
    ctx,
    slotImage(brochurePage.slots, 'plan'),
    ctx.data.floorplans[0]?.url ?? null,
  );
  // Plans are never cropped.
  drawPhoto(
    page,
    ctx,
    img,
    {
      x: frame.left,
      y: CONTENT_MIN_Y,
      width: frame.width,
      height: contentTop + 10 - CONTENT_MIN_Y,
    },
    { maxCrop: 0 },
  );
  drawFooter(page, ctx);
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

function drawMapPlaceholder(
  page: PDFPage,
  box: Box,
  ctx: RenderCtx,
  lat: number,
  lng: number,
) {
  page.drawRectangle({ ...box, color: ctx.colors.soft });
  const label = pdfText(
    `Map unavailable · ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
  );
  page.drawText(label, {
    x: box.x + 24,
    y: box.y + box.height / 2,
    size: 9,
    font: ctx.font,
    color: ctx.colors.muted,
  });
}

const AMENITY_ROW_H = 30;

function splitAmenityLabel(label: string): { name: string; detail: string } {
  const [name, ...rest] = label.split(/\s+·\s+/);
  return { name: name?.trim() ?? label, detail: rest.join(' · ').trim() };
}

function drawAmenityRows(
  page: PDFPage,
  ctx: RenderCtx,
  amenities: Array<{ label: string; index: number; icon?: AmenityIcon | null }>,
  opts: { x: number; y: number; width: number; columns: number; minY: number },
) {
  const colGap = 20;
  const colW = (opts.width - colGap * (opts.columns - 1)) / opts.columns;
  const perColumn = Math.ceil(amenities.length / opts.columns);
  amenities.forEach((amenity, i) => {
    const col = Math.floor(i / perColumn);
    const row = i % perColumn;
    const x = opts.x + col * (colW + colGap);
    const y = opts.y - row * AMENITY_ROW_H;
    if (y - 12 < opts.minY) return;
    const { name, detail } = splitAmenityLabel(amenity.label);
    drawAmenityBadge(page, ctx, amenity, x + 7.5, y + 3);
    drawWrapped(page, name, {
      x: x + 22,
      y,
      font: ctx.fontBold,
      size: 9,
      color: ctx.colors.ink,
      maxWidth: colW - 22,
      maxLines: 1,
    });
    if (detail) {
      drawWrapped(page, detail, {
        x: x + 22,
        y: y - 11.5,
        font: ctx.font,
        size: 8,
        color: ctx.colors.muted,
        maxWidth: colW - 22,
        maxLines: 1,
      });
    }
  });
}

async function renderMap(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  const landscape = ctx.orientation === 'landscape';
  drawSectionTab(
    page,
    ctx,
    brochurePage.sectionLabel,
    brochurePage.sectionNumber,
  );
  const frame = contentFrame(page, ctx);
  const type = typeScale(ctx);
  const title = slotText(brochurePage.slots, 'title') || 'Location';
  const body = slotText(brochurePage.slots, 'body').trim();
  const mapSlot = brochurePage.slots.map;
  const rawAmenities = mapSlot?.type === 'map' ? mapSlot.amenities : [];
  const fetched = ctx.data.nearbyAmenities ?? [];
  const amenities = sanitizeBrochureAmenities(
    isThinNearbyAmenityList(rawAmenities)
      ? fetched.length > 0
        ? fetched
        : buildFallbackNearbyAmenities(ctx.data.listing.town, fetched)
      : rawAmenities,
    ctx.data.listing.town,
  );
  const lat =
    (mapSlot?.type === 'map' ? mapSlot.latitude : null) ??
    ctx.data.listing.latitude;
  const lng =
    (mapSlot?.type === 'map' ? mapSlot.longitude : null) ??
    ctx.data.listing.longitude;

  const banded = hasBands(ctx);
  const headline =
    banded && title === 'Location'
      ? (locationHeadline(ctx.data.listing) ?? title)
      : title;
  const splitX = Math.round(page.getSize().width * 0.46);
  const leftW =
    banded && landscape ? splitX - frame.left - 40 : frame.width * 0.36;
  const contentTop = drawPageHeader(
    page,
    ctx,
    brochurePage,
    headline,
    banded && landscape ? leftW : undefined,
  );
  let mapBox: Box | null = null;
  const disclaimerH = banded && amenities.length > 0 ? 26 : 0;

  if (landscape) {
    const gutter = 32;
    const listH =
      amenities.length > 0
        ? 22 + amenities.length * AMENITY_ROW_H + disclaimerH
        : 0;
    let y = contentTop;
    if (body) {
      y = drawBodyCopy(page, ctx, body, {
        x: frame.left,
        y,
        maxWidth: leftW,
        minY: Math.min(
          contentTop - 4 * type.leading,
          CONTENT_MIN_Y + listH + 10,
        ),
      });
      y -= 14;
    }
    if (amenities.length > 0) {
      drawEyebrow(page, ctx, 'Nearby', {
        x: frame.left,
        y,
        color: ctx.colors.primary,
      });
      drawAmenityRows(page, ctx, amenities, {
        x: frame.left,
        y: y - 22,
        width: leftW,
        columns: 1,
        minY: CONTENT_MIN_Y + disclaimerH,
      });
      if (disclaimerH) {
        const rowsShown = Math.min(
          amenities.length,
          Math.floor(
            (y - 22 - 12 - CONTENT_MIN_Y - disclaimerH) / AMENITY_ROW_H,
          ) + 1,
        );
        drawMapDisclaimer(page, ctx, {
          x: frame.left,
          y: y - 22 - rowsShown * AMENITY_ROW_H - 4,
          width: leftW,
        });
      }
    }
    if (banded) {
      mapBox = bleedArea(page, splitX);
    } else {
      const mapX = frame.left + leftW + gutter;
      mapBox = {
        x: mapX,
        y: CONTENT_MIN_Y,
        width: frame.right - mapX,
        height: frame.top - CONTENT_MIN_Y,
      };
    }
  } else {
    let y = contentTop;
    if (body) {
      y = drawBodyCopy(page, ctx, body, {
        x: frame.left,
        y,
        maxWidth: frame.width,
        minY: contentTop - 7 * type.leading,
      });
      y -= 10;
    }
    const rows = Math.ceil(amenities.length / 2);
    const listH =
      amenities.length > 0 ? 34 + rows * AMENITY_ROW_H + disclaimerH : 0;
    const mapTop = y;
    const mapH = Math.max(180, mapTop - CONTENT_MIN_Y - listH);
    mapBox = {
      x: frame.left,
      y: mapTop - mapH,
      width: frame.width,
      height: mapH,
    };
    if (amenities.length > 0) {
      const listTop = mapBox.y - 24;
      drawEyebrow(page, ctx, 'Nearby', {
        x: frame.left,
        y: listTop,
        color: ctx.colors.primary,
      });
      drawAmenityRows(page, ctx, amenities, {
        x: frame.left,
        y: listTop - 22,
        width: frame.width,
        columns: 2,
        minY: CONTENT_MIN_Y + disclaimerH,
      });
      if (disclaimerH) {
        const rowsShown = Math.min(
          rows,
          Math.floor(
            (listTop - 22 - 12 - CONTENT_MIN_Y - disclaimerH) / AMENITY_ROW_H,
          ) + 1,
        );
        drawMapDisclaimer(page, ctx, {
          x: frame.left,
          y: listTop - 22 - rowsShown * AMENITY_ROW_H - 4,
          width: frame.width,
        });
      }
    }
  }

  if (lat != null && lng != null && mapBox) {
    const bytes = await fetchBrochureMapImageBytes({
      latitude: lat,
      longitude: lng,
      // CSS px ≈ PDF pt so labels print at a readable size; @2x for sharpness.
      width: Math.round(mapBox.width),
      height: Math.round(mapBox.height),
      zoom: 14,
      pinColor: brochureMapPinColor(ctx.data.brand),
      amenityPinColor: ctx.data.brand.accentColor,
      amenities,
    });
    const mapImg = await embedImage(ctx.pdf, bytes);
    if (mapImg) {
      drawImageCover(page, mapImg, mapBox);
      if (banded) drawMapAddressCard(page, ctx, mapBox);
    } else {
      drawMapPlaceholder(page, mapBox, ctx, lat, lng);
    }
  }

  drawFooter(page, ctx);
}

function drawMapDisclaimer(
  page: PDFPage,
  ctx: RenderCtx,
  opts: { x: number; y: number; width: number },
) {
  if (opts.y < CONTENT_MIN_Y) return;
  drawWrapped(
    page,
    'Distances are approximate straight-line measurements, for guidance only.',
    {
      x: opts.x,
      y: opts.y,
      font: ctx.font,
      size: 7,
      color: ctx.colors.muted,
      maxWidth: opts.width,
      lineHeight: 9.5,
      maxLines: 2,
    },
  );
}

/** White address card with an accent edge, top-left on the map. */
function drawMapAddressCard(page: PDFPage, ctx: RenderCtx, mapBox: Box) {
  const { listing } = ctx.data;
  const line1 = ctx.runningTitle;
  const running = line1.toLowerCase();
  const line2 = [listing.town, listing.postcode]
    .map((p) => p?.trim() ?? '')
    .filter((p) => p && !running.includes(p.toLowerCase()))
    .join(', ');
  const inset = 16;
  const pad = 12;
  const bar = 3;
  const maxText = mapBox.width - inset * 2 - pad * 2 - bar;
  if (maxText < 80) return;
  const t1 = fitLine(line1, ctx.fontBold, 9, maxText);
  const t2 = line2 ? fitLine(line2, ctx.font, 7.5, maxText) : '';
  const textW = Math.max(
    ctx.fontBold.widthOfTextAtSize(t1, 9),
    t2 ? ctx.font.widthOfTextAtSize(t2, 7.5) : 0,
  );
  const h = t2 ? 40 : 28;
  const box = {
    x: mapBox.x + inset,
    y: mapBox.y + mapBox.height - inset - h,
    width: textW + pad * 2 + bar,
    height: h,
  };
  page.drawRectangle({ ...box, color: ctx.colors.paper });
  page.drawRectangle({
    x: box.x,
    y: box.y,
    width: bar,
    height: h,
    color: ctx.colors.accent,
  });
  const x = box.x + bar + pad;
  drawText(page, t1, {
    x,
    y: box.y + h - pad - 7,
    size: 9,
    font: ctx.fontBold,
    color: ctx.colors.ink,
  });
  if (t2) {
    drawText(page, t2, {
      x,
      y: box.y + pad - 1,
      size: 7.5,
      font: ctx.font,
      color: ctx.colors.muted,
    });
  }
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

async function renderContact(
  page: PDFPage,
  brochurePage: BrochurePage,
  ctx: RenderCtx,
) {
  const { width, height } = page.getSize();
  const landscape = ctx.orientation === 'landscape';
  const frame = contentFrame(page, ctx);
  const bandH = 84;
  const banded = hasBands(ctx);
  const rawTitle = slotText(brochurePage.slots, 'title') || 'Contact';
  const title =
    banded && rawTitle === 'Contact' ? 'Strictly by appointment' : rawTitle;

  if (!banded) {
    page.drawRectangle({
      x: 0,
      y: height - bandH,
      width,
      height: bandH,
      color: ctx.colors.primary,
    });
    drawSectionTab(
      page,
      ctx,
      brochurePage.sectionLabel,
      brochurePage.sectionNumber,
    );

    drawEyebrow(page, ctx, 'Viewing & enquiries', {
      x: frame.left,
      y: height - 32,
      color: ctx.colors.paperMuted,
      opacity: 0.85,
    });
    drawText(page, title, {
      x: frame.left,
      y: height - 58,
      size: 22,
      font: ctx.headingBold,
      color: ctx.colors.paper,
    });

    const logo = drawLogo(page, ctx.logo, {
      x: frame.right,
      y: height - (bandH - 36) / 2,
      maxWidth: 140,
      maxHeight: 36,
      alignRight: true,
    });
    if (!logo.height) {
      const name = pdfText(ctx.data.accountName ?? '');
      if (name) {
        drawText(page, name, {
          x: frame.right - ctx.fontBold.widthOfTextAtSize(name, 12),
          y: height - 50,
          size: 12,
          font: ctx.fontBold,
          color: ctx.colors.paper,
        });
      }
    }
  }

  const branchName =
    slotText(brochurePage.slots, 'branchName').trim() ||
    ctx.data.branch?.name?.trim() ||
    ctx.data.accountName?.trim() ||
    '';
  const branchAddress =
    slotText(brochurePage.slots, 'branchAddress').trim() ||
    ctx.data.branch?.address?.trim() ||
    '';
  const branchPhone =
    slotText(brochurePage.slots, 'branchPhone').trim() ||
    ctx.data.branch?.phone?.trim() ||
    '';
  const branchEmail =
    slotText(brochurePage.slots, 'branchEmail').trim() ||
    ctx.data.branch?.email?.trim() ||
    '';

  const shopfront = slotImage(brochurePage.slots, 'shopfront');
  const shopfrontImg = await resolveListingImage(
    ctx,
    shopfront,
    ctx.data.branch?.shopfrontUrl ?? null,
  );
  if (
    !shopfrontImg &&
    (shopfront?.url?.trim() || ctx.data.branch?.shopfrontUrl?.trim())
  ) {
    console.error('[brochure-pdf] shopfront photo could not be embedded');
  }

  // Legal notice is bottom-anchored above the footer.
  const notice = slotText(brochurePage.slots, 'notice')
    .trim()
    .replace(/^important notice\s*[:.\-–—]\s*/i, '');
  const office: OfficeDetails = {
    name: branchName,
    address: branchAddress,
    phone: branchPhone,
    email: branchEmail,
  };

  if (banded && landscape) {
    renderContactSplit(page, ctx, {
      title,
      office,
      shopfrontImg,
      notice,
    });
    drawFooter(page, ctx);
    return;
  }

  const noticeTop = drawContactNotice(page, ctx, notice, {
    x: frame.left,
    width: frame.width,
  });
  const bodyMinY = noticeTop + 32;

  const officeW = landscape ? Math.min(300, frame.width * 0.4) : frame.width;
  let by = banded
    ? drawPageHeader(page, ctx, brochurePage, title)
    : height - bandH - 40;
  by = drawOfficeBlock(page, ctx, office, {
    x: frame.left,
    y: by,
    width: officeW,
  });

  const links = brochureLinks(ctx);
  if (links.length > 0) {
    by -= 12;
    drawLinkButtons(page, ctx, links, {
      x: frame.left,
      y: by - 22,
      maxWidth: officeW,
      fill: ctx.colors.primary,
      text: ctx.colors.paper,
      outline: ctx.colors.primary,
      outlineText: ctx.colors.primary,
    });
    by -= 22;
  }

  if (shopfrontImg) {
    const area = brochureContactShopfrontBox({
      landscape,
      pageWidth: width,
      margin: frame.left,
      branchCardWidth: officeW,
      afterAddressY: by - 8,
    });
    const clamped = {
      ...area,
      y: Math.max(area.y, bodyMinY),
      height: Math.min(area.height, area.y + area.height - bodyMinY),
    };
    if (clamped.height >= 60) {
      const drawn = drawPhoto(page, ctx, shopfrontImg, clamped, {
        align: 'top',
        maxCrop: 0.3,
        anchorLeft: true,
      });
      by = (drawn?.y ?? clamped.y) - 16;
    }
  }

  const agents = ctx.data.agents.slice(0, 4);
  if (agents.length === 0) {
    drawFooter(page, ctx);
    return;
  }

  const agentsX = landscape ? frame.left + officeW + 48 : frame.left;
  const agentsW = frame.right - agentsX;
  let ay = landscape ? height - bandH - 40 : by - 12;
  drawEyebrow(page, ctx, agents.length === 1 ? 'Agent' : 'Agents', {
    x: agentsX,
    y: ay,
    color: banded ? ctx.colors.accent : ctx.colors.primary,
  });
  ay -= 22;

  const columns = Math.min(2, agents.length);
  const colGap = 24;
  const cardW = (agentsW - colGap * (columns - 1)) / columns;
  const cardH = 58;
  const avatarW = banded ? 46 : 0;
  agents.forEach((agent, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const cardX = agentsX + col * (cardW + colGap);
    const x = cardX + avatarW;
    const textW = cardW - avatarW;
    const y = ay - row * (cardH + 14);
    if (y - 30 < bodyMinY) return;
    if (banded) drawAvatar(page, ctx, agent.name, cardX + 17, y - 10);
    drawWrapped(page, agent.name, {
      x,
      y,
      font: ctx.fontBold,
      size: 12,
      color: ctx.colors.ink,
      maxWidth: textW,
      maxLines: 1,
    });
    let line = y - 16;
    if (agent.phone) {
      drawText(page, agent.phone, {
        x,
        y: line,
        size: 9.5,
        font: ctx.font,
        color: ctx.colors.ink,
      });
      line -= 13;
    }
    if (agent.email) {
      drawWrapped(page, agent.email, {
        x,
        y: line,
        font: ctx.font,
        size: 9,
        color: ctx.colors.muted,
        maxWidth: textW,
        maxLines: 1,
      });
    }
    drawHairline(page, ctx, cardX, cardX + cardW, y - cardH + 14);
  });

  drawFooter(page, ctx);
}

type OfficeDetails = {
  name: string;
  address: string;
  phone: string;
  email: string;
};

/** Bottom-anchored legal notice; returns the top of the block. */
function drawContactNotice(
  page: PDFPage,
  ctx: RenderCtx,
  notice: string,
  opts: { x: number; width: number },
): number {
  if (!notice) return CONTENT_MIN_Y;
  const noticeOpts = {
    font: ctx.font,
    size: 7,
    maxWidth: opts.width,
    lineHeight: 10,
    maxLines: 7,
  };
  const top = CONTENT_MIN_Y + measureWrapped(notice, noticeOpts) + 4;
  drawEyebrow(page, ctx, 'Important notice', {
    x: opts.x,
    y: top + 6,
    color: ctx.colors.muted,
    size: 6.5,
  });
  drawWrapped(page, notice, {
    ...noticeOpts,
    x: opts.x,
    y: top - 8,
    color: ctx.colors.muted,
  });
  return top;
}

/** Office eyebrow, name, address and T/E lines; returns the next baseline. */
function drawOfficeBlock(
  page: PDFPage,
  ctx: RenderCtx,
  office: OfficeDetails,
  opts: { x: number; y: number; width: number },
): number {
  const banded = hasBands(ctx);
  let by = opts.y;
  drawEyebrow(page, ctx, 'Office', {
    x: opts.x,
    y: by,
    color: banded ? ctx.colors.accent : ctx.colors.primary,
  });
  by -= banded ? 26 : 22;
  if (office.name) {
    drawText(page, office.name, {
      x: opts.x,
      y: by,
      size: banded ? 17 : 14,
      font: banded ? ctx.headingBold : ctx.fontBold,
      color: ctx.colors.ink,
    });
    by -= banded ? 21 : 18;
  }
  if (office.address) {
    by = drawWrapped(page, office.address, {
      x: opts.x,
      y: by,
      font: ctx.font,
      size: 9.5,
      color: ctx.colors.ink,
      maxWidth: opts.width,
      lineHeight: 13.5,
      maxLines: 4,
      paragraphGap: 0,
    });
    by -= 6;
  }
  for (const [label, value] of [
    ['T', office.phone],
    ['E', office.email],
  ] as const) {
    if (!value) continue;
    drawText(page, label, {
      x: opts.x,
      y: by,
      size: 7.5,
      font: ctx.fontBold,
      color: ctx.colors.accent,
    });
    drawText(page, value, {
      x: opts.x + 14,
      y: by,
      size: 9.5,
      font: ctx.font,
      color: ctx.colors.ink,
    });
    by -= 14;
  }
  return by;
}

/** Accent disc with the agent's initials. */
function drawAvatar(
  page: PDFPage,
  ctx: RenderCtx,
  name: string,
  cx: number,
  cy: number,
) {
  page.drawCircle({ x: cx, y: cy, size: 17, color: ctx.colors.accent });
  const initials = nameInitials(name);
  if (!initials) return;
  const size = 11;
  drawText(page, initials, {
    x: cx - ctx.headingBold.widthOfTextAtSize(initials, size) / 2,
    y: cy - size * 0.35,
    size,
    font: ctx.headingBold,
    color: ctx.colors.paper,
  });
}

/**
 * Landscape contact: office, shopfront and notice on the left; a full-height
 * navy viewing panel with the agents and links on the right.
 */
function renderContactSplit(
  page: PDFPage,
  ctx: RenderCtx,
  opts: {
    title: string;
    office: OfficeDetails;
    shopfrontImg: PDFImage | null;
    notice: string;
  },
) {
  const { width } = page.getSize();
  const frame = contentFrame(page, ctx);
  const panelX = Math.round(width * 0.53);
  const leftW = panelX - frame.left - 44;

  // Left: office, shopfront, notice.
  const noticeTop = drawContactNotice(page, ctx, opts.notice, {
    x: frame.left,
    width: leftW,
  });
  const by = drawOfficeBlock(page, ctx, opts.office, {
    x: frame.left,
    y: frame.top - 7,
    width: leftW,
  });
  if (opts.shopfrontImg) {
    const top = by - 6;
    const bottom = noticeTop + 30;
    const area = {
      x: frame.left,
      y: Math.max(bottom, top - 170),
      width: leftW,
      height: Math.min(170, top - bottom),
    };
    if (area.height >= 60) {
      drawPhoto(page, ctx, opts.shopfrontImg, area, {
        align: 'top',
        maxCrop: 0.3,
        anchorLeft: true,
      });
    }
  }

  // Right: viewing panel.
  const panel = bleedArea(page, panelX);
  page.drawRectangle({ ...panel, color: ctx.colors.primary });
  const px = panelX + 40;
  const pw = frame.right - px;
  let y = frame.top - 7;
  drawEyebrow(page, ctx, PAGE_EYEBROWS.contact ?? 'Viewing', {
    x: px,
    y,
    color: ctx.colors.paperMuted,
    opacity: 0.85,
  });
  const titleSize = 22;
  y = drawWrapped(page, opts.title, {
    x: px,
    y: y - 12 - titleSize * 0.72,
    font: ctx.headingBold,
    size: titleSize,
    lineHeight: titleSize * 1.12,
    color: ctx.colors.paper,
    maxWidth: pw,
    maxLines: 2,
  });

  const links = brochureLinks(ctx);
  const linksY = FOOTER_BAND_H + 28;
  const floor = links.length > 0 ? linksY + 22 + 20 : FOOTER_BAND_H + 24;
  let rowTop = y + titleSize * 1.12 - 34;

  const agents = ctx.data.agents.slice(0, 4);
  const rowH = 62;
  if (agents.length === 0) {
    drawHairline(page, ctx, px, px + pw, rowTop, ctx.colors.paper, 0.16);
    let line = rowTop - 26;
    for (const value of [opts.office.phone, opts.office.email]) {
      if (!value || line < floor) continue;
      drawText(page, fitLine(value, ctx.fontBold, 12, pw), {
        x: px,
        y: line,
        size: 12,
        font: ctx.fontBold,
        color: ctx.colors.paper,
      });
      line -= 22;
    }
  }
  for (const agent of agents) {
    if (rowTop - rowH < floor) break;
    drawHairline(page, ctx, px, px + pw, rowTop, ctx.colors.paper, 0.16);
    drawAvatar(page, ctx, agent.name, px + 17, rowTop - rowH / 2);
    const tx = px + 48;
    const tw = pw - 48;
    const lines = [agent.phone, agent.email].filter((v): v is string =>
      Boolean(v?.trim()),
    );
    let line = rowTop - rowH / 2 + (lines.length * 12) / 2 + 3;
    drawText(page, fitLine(agent.name, ctx.fontBold, 11, tw), {
      x: tx,
      y: line,
      size: 11,
      font: ctx.fontBold,
      color: ctx.colors.paper,
    });
    for (const value of lines) {
      line -= 12.5;
      drawText(page, fitLine(value, ctx.font, 8.5, tw), {
        x: tx,
        y: line,
        size: 8.5,
        font: ctx.font,
        color: ctx.colors.paperMuted,
      });
    }
    rowTop -= rowH;
  }
  if (agents.length > 0) {
    drawHairline(page, ctx, px, px + pw, rowTop, ctx.colors.paper, 0.16);
  }

  if (links.length > 0) {
    drawLinkButtons(page, ctx, links, {
      x: px,
      y: linksY,
      maxWidth: pw,
      fill: ctx.colors.accent,
      text: ctx.colors.paper,
      outline: ctx.colors.paperMuted,
      outlineText: ctx.colors.paper,
    });
  }
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

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
    case 'details_columns':
      await renderDetails(page, brochurePage, ctx);
      break;
    case 'photo_full':
      await renderPhotoFull(page, brochurePage, ctx);
      break;
    case 'photo_grid_2':
      await renderPhotoGrid(page, brochurePage, ctx, ['photo1', 'photo2']);
      break;
    case 'photo_grid_3':
      await renderPhotoGrid(page, brochurePage, ctx, [
        'photo1',
        'photo2',
        'photo3',
      ]);
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

function runningTitleFor(data: PublicBrochureData): string {
  const { listing } = data;
  const { title } = coverTitleParts(
    listing.name,
    formatBrochureAddress(listing),
  );
  const place = listing.addressLine2?.trim() || listing.town?.trim() || '';
  return place && !title.toLowerCase().includes(place.toLowerCase())
    ? `${title}, ${place}`
    : title;
}

/** Listing photos (non-cover) that no page slot references. */
function spareImageUrls(
  document: BrochureDocument,
  data: PublicBrochureData,
): string[] {
  const usedIds = new Set<string>();
  const usedUrls = new Set<string>();
  for (const page of document.pages) {
    for (const slot of Object.values(page.slots)) {
      if (slot.type !== 'image') continue;
      if (slot.mediaId) usedIds.add(slot.mediaId);
      if (slot.url) usedUrls.add(slot.url);
    }
  }
  return data.images
    .filter(
      (item) =>
        !item.isCover && !usedIds.has(item.id) && !usedUrls.has(item.url),
    )
    .map((item) => item.url);
}

type EmbeddedFontPair = { regular: PDFFont; bold: PDFFont };

/** Embeds a bundled brand font; Helvetica stands in when it can't load. */
async function embedBrandFont(
  pdf: PDFDocument,
  id: BrandFontId,
  fallback: EmbeddedFontPair,
): Promise<EmbeddedFontPair> {
  const files = await loadBrandFontFiles(id);
  if (!files) return fallback;
  try {
    const [regular, bold] = await Promise.all([
      pdf.embedFont(files.regular, { subset: true }),
      pdf.embedFont(files.bold, { subset: true }),
    ]);
    return { regular, bold };
  } catch (error) {
    console.error(`[brochure-pdf] ${id} embed failed; using Helvetica`, error);
    return fallback;
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
  pdf.registerFontkit(fontkit);
  const [helvetica, helveticaBold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);
  const fallback = { regular: helvetica, bold: helveticaBold };
  const brandFonts = data.brand.fonts;
  const [body, heading] = await Promise.all([
    embedBrandFont(pdf, brandFonts?.body ?? DEFAULT_PDF_BODY_FONT, fallback),
    embedBrandFont(
      pdf,
      brandFonts?.heading ?? DEFAULT_PDF_HEADING_FONT,
      fallback,
    ),
  ]);
  const size = pageSize(document.orientation);

  const colors: BrandColors = {
    primary: hexToRgb(data.brand.primaryColor, rgb(0.21, 0.12, 0.16)),
    secondary: hexToRgb(data.brand.secondaryColor, rgb(0.25, 0.38, 0.44)),
    accent: hexToRgb(data.brand.accentColor, rgb(1, 0.36, 0.2)),
    ink: rgb(0.11, 0.1, 0.11),
    muted: rgb(0.44, 0.42, 0.43),
    paper: rgb(1, 1, 1),
    paperMuted: rgb(0.86, 0.86, 0.88),
    soft: rgb(0.95, 0.94, 0.92),
    hairline: rgb(0.86, 0.85, 0.84),
  };

  const logoBytes = await fetchImageBytes(resolveBrochurePlateLogo(data.brand));
  const logo = await embedImage(pdf, logoBytes);

  if (document.pages.length > 30) {
    throw new Error('Brochure exceeds maximum page count');
  }

  const ctx: RenderCtx = {
    pdf,
    data,
    colors,
    font: body.regular,
    fontBold: body.bold,
    heading: heading.regular,
    headingBold: heading.bold,
    orientation: document.orientation,
    templateId: document.templateId,
    imageCache: new Map(),
    imageById: new Map(data.images.map((item) => [item.id, item.url])),
    floorplanById: new Map(data.floorplans.map((item) => [item.id, item.url])),
    logo,
    runningTitle: runningTitleFor(data),
    spareImageUrls: spareImageUrls(document, data),
    pageNumber: 0,
    totalPages: document.pages.length,
  };

  for (const [index, brochurePage] of document.pages.entries()) {
    const pdfPage = pdf.addPage([size.width, size.height]);
    ctx.pageNumber = index + 1;
    await renderPage(pdfPage, brochurePage, ctx);
  }

  if (document.pages.length === 0) {
    const pdfPage = pdf.addPage([size.width, size.height]);
    pdfPage.drawText('Empty brochure', {
      x: 40,
      y: size.height / 2,
      size: 14,
      font: body.regular,
      color: colors.muted,
    });
  }

  return pdf.save();
}
