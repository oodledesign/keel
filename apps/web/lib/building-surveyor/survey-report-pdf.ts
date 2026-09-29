import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
  StandardFonts,
  clip,
  closePath,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
} from 'pdf-lib';

import { sanitizePdfText } from '~/lib/invoices/pdf-text';

import {
  CONDITION_RATING_COLORS,
  type ConditionRating,
} from './condition-rating';
import type {
  SurveyReportBlock,
  SurveyReportDocument,
} from './survey-report-document';

export type SurveyPdfImage = { bytes: Uint8Array; kind: 'png' | 'jpg' };

export type SurveyReportPdfInput = {
  title: string;
  document: SurveyReportDocument;
  imageBytesById?: Record<string, Uint8Array>;
  loadImage?: (src: string) => Promise<SurveyPdfImage | null>;
  logo?: SurveyPdfImage | null;
  brandName?: string | null;
  brandColor?: string | null;
  propertyAddress?: string | null;
  clientName?: string | null;
  reportDate?: string | null;
  /** RICS Home Survey level; drives the cover kicker and numeral. */
  surveyLevel?: 2 | 3 | null;
  /** Running footer label, e.g. "RICS Home Survey - Level 3". */
  reportLabel?: string | null;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const LEFT = 85;
const RIGHT = PAGE_W - 50;
const CONTENT_W = RIGHT - LEFT;
const TOP = 72;
const BOTTOM = 84;
const BOX_PAD = 10;
const CONTENTS_PER_PAGE = 18;
const BODY_SIZE = 10;
const BODY_LEADING = 14;
const ELEMENT_CODE_RE = /^[A-Z]\d+$/;
const DIVIDER_TITLE_RE = /^([A-Z])\s+(.+)$/;

type HeadingBlock = Extract<SurveyReportBlock, { type: 'heading' }>;
type ImageBlock = Extract<SurveyReportBlock, { type: 'image' }>;
type PageKind = 'cover' | 'contents' | 'divider' | 'content';

type Palette = {
  brand: RGB;
  brandTint: RGB;
  brandWash: RGB;
  ink: RGB;
  muted: RGB;
  rule: RGB;
  border: RGB;
  headerFill: RGB;
  white: RGB;
};

type Ctx = {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  boldItalic: PDFFont;
  palette: Palette;
  logo: PDFImage | null;
  pages: Array<{ page: PDFPage; kind: PageKind }>;
  page: PDFPage | null;
  onContent: boolean;
  y: number;
  box: { top: number } | null;
  pendingTab: { letter: string; title: string } | null;
  sectionTitle: string | null;
  contents: Array<{ label: string; pageIndex: number }>;
};

type TextItem =
  | { kind: 'para'; text: string; bold?: boolean; bullet?: boolean }
  | { kind: 'table'; header: string[] | null; rows: string[][] }
  | { kind: 'fields'; rows: Array<[string, string]> };

const RATING_GROUPS: Array<{
  rating: ConditionRating;
  title: string;
  description: string;
}> = [
  {
    rating: '3',
    title: 'Elements that require urgent attention',
    description:
      'These elements have defects that are serious and/or need to be repaired, replaced or investigated urgently. Failure to do so could risk serious safety issues or severe long-term damage to your property.',
  },
  {
    rating: '2',
    title: 'Elements that require attention but are not serious or urgent',
    description:
      'These elements have defects that need repairing or replacing, but are not considered to be either serious or urgent. These elements must also be maintained in the normal way.',
  },
  {
    rating: '1',
    title: 'Elements with no current issues',
    description:
      'No repair is currently needed. These elements must be maintained in the normal way.',
  },
  {
    rating: 'NI',
    title: 'Elements not inspected',
    description:
      'We carry out a visual inspection, so a number of elements may not have been inspected.',
  },
  {
    rating: 'NA',
    title: 'Elements not applicable',
    description: 'These elements do not apply to this property.',
  },
];

const MERGE_FIELD_LABELS: Record<string, string> = {
  'client.name': "Client's name",
  'property.address': 'Full address and postcode of the property',
  'inspection.date': 'Date of the inspection',
  'report.producedDate': 'Date the report was produced',
  'report.reference': 'Report reference',
  weather: 'Weather conditions when the inspection took place',
  occupancy: 'Status of the property when the inspection took place',
  'surveyor.name': "Surveyor's name",
  'surveyor.ricsNumber': "Surveyor's RICS number",
  'company.name': 'Company name',
};

function hexToRgb(hex: string | null | undefined, fallback: RGB): RGB {
  const cleaned = (hex ?? '').replace('#', '').trim();
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((char) => char + char)
          .join('')
      : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return fallback;
  const n = Number.parseInt(full, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function mix(a: RGB, b: RGB, amount: number): RGB {
  return rgb(
    a.red + (b.red - a.red) * amount,
    a.green + (b.green - a.green) * amount,
    a.blue + (b.blue - a.blue) * amount,
  );
}

function buildPalette(brandColor: string | null | undefined): Palette {
  const white = rgb(1, 1, 1);
  const brand = hexToRgb(brandColor, rgb(0.05, 0.14, 0.27));
  return {
    brand,
    brandTint: mix(brand, white, 0.4),
    brandWash: mix(brand, white, 0.88),
    ink: rgb(0.13, 0.13, 0.15),
    muted: rgb(0.45, 0.45, 0.48),
    rule: rgb(0.8, 0.8, 0.82),
    border: rgb(0.74, 0.74, 0.77),
    headerFill: rgb(0.91, 0.91, 0.92),
    white,
  };
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/&amp;/gi, '&');
}

function htmlInlineText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function paragraphItems(html: string): TextItem[] {
  const marked = html
    .replace(
      /<p\b[^>]*>\s*<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>\s*<\/p>/gi,
      '\n\uE000$2\n',
    )
    .replace(/<li\b[^>]*>/gi, '\n\uE001')
    .replace(/<h[1-6]\b[^>]*>/gi, '\n\uE000')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|ul|ol|blockquote)>/gi, '\n');

  const items: TextItem[] = [];
  for (const raw of decodeEntities(marked.replace(/<[^>]+>/g, '')).split(
    '\n',
  )) {
    const bold = raw.startsWith('\uE000');
    const bullet = raw.startsWith('\uE001');
    const text = raw
      .replace(/^[\uE000\uE001]/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) continue;
    items.push({ kind: 'para', text, bold, bullet });
  }
  return items;
}

function tableRows(html: string): { cells: string[]; header: boolean }[] {
  const rows: { cells: string[]; header: boolean }[] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: string[] = [];
    let header = true;
    for (const cell of row[1]!.matchAll(
      /<(th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi,
    )) {
      if (cell[1]!.toLowerCase() === 'td') header = false;
      cells.push(htmlInlineText(cell[2]!));
    }
    if (cells.length > 0) rows.push({ cells, header });
  }
  return rows;
}

/** Splits report HTML into paragraphs, tables and label/value field lists. */
export function surveyHtmlToPdfItems(html: string): TextItem[] {
  const items: TextItem[] = [];
  let cursor = 0;
  for (const match of html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)) {
    items.push(...paragraphItems(html.slice(cursor, match.index)));
    cursor = (match.index ?? 0) + match[0].length;
    const rows = tableRows(match[2]!);
    if (rows.length === 0) continue;

    if (/survey-merge-fields/.test(match[1] ?? '')) {
      items.push({
        kind: 'fields',
        rows: rows.map(({ cells }) => [
          MERGE_FIELD_LABELS[cells[0] ?? ''] ?? cells[0] ?? '',
          cells[1] ?? '',
        ]),
      });
      continue;
    }

    const [first, ...rest] = rows;
    items.push({
      kind: 'table',
      header: first!.header ? first!.cells : null,
      rows: first!.header
        ? rest.map((row) => row.cells)
        : rows.map((row) => row.cells),
    });
  }
  items.push(...paragraphItems(html.slice(cursor)));
  return items;
}

function wrap(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = sanitizePdfText(text).replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (!word) continue;
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      line = word;
      continue;
    }
    let chunk = '';
    for (const char of word) {
      if (font.widthOfTextAtSize(chunk + char, size) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk += char;
      }
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines;
}

function headingText(block: HeadingBlock): string {
  return htmlInlineText(block.text);
}

function isElementHeading(block: HeadingBlock): boolean {
  return (
    Boolean(block.conditionRating) || ELEMENT_CODE_RE.test(block.ricsCode ?? '')
  );
}

function isRatingSummaryHtml(html: string): boolean {
  return (
    html.includes('survey-rating-badge') ||
    html.includes('No condition ratings recorded yet')
  );
}

function detectImageKind(bytes: Uint8Array): 'png' | 'jpg' {
  return bytes[0] === 0x89 && bytes[1] === 0x50 ? 'png' : 'jpg';
}

async function embedImage(
  doc: PDFDocument,
  image: SurveyPdfImage,
): Promise<PDFImage | null> {
  try {
    return image.kind === 'png'
      ? await doc.embedPng(image.bytes)
      : await doc.embedJpg(image.bytes);
  } catch {
    return null;
  }
}

/**
 * The builder and assembler put section photos before their heading. The
 * printed report reads heading, findings, then photos, so photos tagged with
 * the next heading's section move after that heading's text.
 */
function orderForPrint(blocks: SurveyReportBlock[]): SurveyReportBlock[] {
  const result: SurveyReportBlock[] = [];
  let index = 0;
  while (index < blocks.length) {
    const block = blocks[index]!;
    if (block.type !== 'image') {
      result.push(block);
      index += 1;
      continue;
    }
    let end = index;
    while (blocks[end]?.type === 'image') end += 1;
    const run = blocks.slice(index, end) as ImageBlock[];
    const heading = blocks[end];
    const matches =
      heading?.type === 'heading' &&
      heading.sectionKey &&
      run.every((image) => image.sectionKey === heading.sectionKey);
    if (!matches) {
      result.push(...run);
      index = end;
      continue;
    }
    result.push(heading);
    let next = end + 1;
    if (blocks[next]?.type === 'text') {
      result.push(blocks[next]!);
      next += 1;
    }
    result.push(...run);
    index = next;
  }
  return result;
}

function addPage(ctx: Ctx, kind: PageKind): PDFPage {
  const page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.pages.push({ page, kind });
  ctx.page = page;
  ctx.onContent = kind === 'content';
  return page;
}

function currentPage(ctx: Ctx): PDFPage {
  if (!ctx.page) throw new Error('No page');
  return ctx.page;
}

function drawBoxSegment(ctx: Ctx, bottom: number) {
  if (!ctx.box) return;
  currentPage(ctx).drawRectangle({
    x: LEFT,
    y: bottom,
    width: CONTENT_W,
    height: ctx.box.top - bottom,
    borderColor: ctx.palette.border,
    borderWidth: 0.7,
  });
}

function startContentPage(ctx: Ctx) {
  addPage(ctx, 'content');
  ctx.y = PAGE_H - TOP;
  if (ctx.pendingTab) {
    drawSectionTab(ctx, ctx.pendingTab);
    ctx.pendingTab = null;
  }
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.onContent && ctx.y - needed >= BOTTOM) return;
  if (ctx.onContent && ctx.box) drawBoxSegment(ctx, BOTTOM - 6);
  startContentPage(ctx);
  if (ctx.box) {
    ctx.box.top = ctx.y;
    ctx.y -= BOX_PAD;
  }
}

function textX(ctx: Ctx): number {
  return ctx.box ? LEFT + BOX_PAD : LEFT;
}

function textWidth(ctx: Ctx): number {
  return ctx.box ? CONTENT_W - BOX_PAD * 2 : CONTENT_W;
}

function drawTextLine(
  ctx: Ctx,
  text: string,
  options: {
    x: number;
    size: number;
    font: PDFFont;
    color?: RGB;
    leading: number;
  },
) {
  ensure(ctx, options.leading);
  currentPage(ctx).drawText(text, {
    x: options.x,
    y: ctx.y - options.size * 0.85,
    size: options.size,
    font: options.font,
    color: options.color ?? ctx.palette.ink,
  });
  ctx.y -= options.leading;
}

function drawParagraph(ctx: Ctx, item: Extract<TextItem, { kind: 'para' }>) {
  const indent = item.bullet ? 16 : 0;
  const font = item.bold ? ctx.bold : ctx.font;
  const lines = wrap(item.text, font, BODY_SIZE, textWidth(ctx) - indent);
  lines.forEach((line, index) => {
    ensure(ctx, BODY_LEADING);
    if (item.bullet && index === 0) {
      currentPage(ctx).drawCircle({
        x: textX(ctx) + 4,
        y: ctx.y - BODY_SIZE * 0.5,
        size: 1.6,
        color: ctx.palette.ink,
      });
    }
    drawTextLine(ctx, line, {
      x: textX(ctx) + indent,
      size: BODY_SIZE,
      font,
      leading: BODY_LEADING,
    });
  });
  ctx.y -= item.bullet ? 3 : 7;
}

function openBox(ctx: Ctx) {
  ensure(ctx, BOX_PAD * 2 + BODY_LEADING * 2);
  ctx.box = { top: ctx.y };
  ctx.y -= BOX_PAD;
}

function closeBox(ctx: Ctx, after = 16) {
  ctx.y -= BOX_PAD - 7;
  drawBoxSegment(ctx, ctx.y);
  ctx.box = null;
  ctx.y -= after;
}

function drawTable(
  ctx: Ctx,
  columns: number[],
  header: string[] | null,
  rows: string[][],
) {
  const size = 9.5;
  const leading = 12.5;
  const pad = 7;
  const x0 = textX(ctx);

  const measure = (cells: string[], font: PDFFont) => {
    const wrapped = columns.map((width, index) =>
      wrap(cells[index] ?? '', font, size, width - pad * 2),
    );
    const height =
      Math.max(1, ...wrapped.map((lines) => lines.length)) * leading + pad * 2;
    return { wrapped, height };
  };

  const drawRow = (cells: string[], isHeader: boolean) => {
    const font = isHeader ? ctx.bold : ctx.font;
    const { wrapped, height } = measure(cells, font);
    const pageBefore = ctx.page;
    ensure(ctx, height);
    if (!isHeader && header && ctx.page !== pageBefore) {
      drawRow(header, true);
      ensure(ctx, height);
    }
    const page = currentPage(ctx);
    let x = x0;
    columns.forEach((width, index) => {
      page.drawRectangle({
        x,
        y: ctx.y - height,
        width,
        height,
        color: isHeader ? ctx.palette.headerFill : undefined,
        borderColor: ctx.palette.border,
        borderWidth: 0.6,
      });
      wrapped[index]!.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: x + pad,
          y: ctx.y - pad - size * 0.85 - lineIndex * leading,
          size,
          font,
          color: ctx.palette.ink,
        });
      });
      x += width;
    });
    ctx.y -= height;
  };

  if (header) drawRow(header, true);
  for (const row of rows) drawRow(row, false);
  ctx.y -= 14;
}

function drawFields(ctx: Ctx, rows: Array<[string, string]>) {
  for (const [label, value] of rows) {
    ensure(ctx, BODY_LEADING * 3 + BOX_PAD * 2);
    drawParagraph(ctx, { kind: 'para', text: label, bold: true });
    openBox(ctx);
    drawParagraph(ctx, { kind: 'para', text: value || '-' });
    closeBox(ctx, 12);
  }
}

function drawTextItems(ctx: Ctx, items: TextItem[]) {
  for (const item of items) {
    if (item.kind === 'para') {
      drawParagraph(ctx, item);
    } else if (item.kind === 'fields') {
      drawFields(ctx, item.rows);
    } else {
      const count = Math.max(
        item.header?.length ?? 0,
        ...item.rows.map((row) => row.length),
      );
      if (count === 0) continue;
      const width = textWidth(ctx) / count;
      drawTable(
        ctx,
        Array.from({ length: count }, () => width),
        item.header,
        item.rows,
      );
    }
  }
}

function drawRatingBadge(
  ctx: Ctx,
  page: PDFPage,
  rating: ConditionRating,
  cx: number,
  cy: number,
  radius: number,
) {
  const numeric = rating === '1' || rating === '2' || rating === '3';
  const size = numeric ? radius * 1.05 : radius * 0.78;
  const width = ctx.bold.widthOfTextAtSize(rating, size);
  if (numeric) {
    page.drawCircle({
      x: cx,
      y: cy,
      size: radius,
      color: hexToRgb(CONDITION_RATING_COLORS[rating], ctx.palette.muted),
    });
  } else {
    page.drawCircle({
      x: cx,
      y: cy,
      size: radius,
      color: ctx.palette.white,
      borderColor: ctx.palette.ink,
      borderWidth: Math.max(0.8, radius / 10),
    });
  }
  page.drawText(rating, {
    x: cx - width / 2,
    y: cy - size * 0.36,
    size,
    font: ctx.bold,
    color: numeric ? ctx.palette.white : ctx.palette.ink,
  });
}

function drawSectionTab(ctx: Ctx, tab: { letter: string; title: string }) {
  const page = currentPage(ctx);
  const tabTop = PAGE_H - 86;
  const tabHeight = 58;
  if (tab.letter) {
    page.drawRectangle({
      x: 0,
      y: tabTop - tabHeight,
      width: 67,
      height: tabHeight,
      color: ctx.palette.brandTint,
    });
    const size = 44;
    const width = ctx.bold.widthOfTextAtSize(tab.letter, size);
    page.drawText(tab.letter, {
      x: (67 - width) / 2,
      y: tabTop - tabHeight + 13,
      size,
      font: ctx.bold,
      color: ctx.palette.white,
    });
  }
  const lines = wrap(tab.title, ctx.bold, 20, CONTENT_W);
  let baseline = tabTop - 38;
  for (const line of lines) {
    page.drawText(line, {
      x: LEFT,
      y: baseline,
      size: 20,
      font: ctx.bold,
      color: ctx.palette.brand,
    });
    baseline -= 24;
  }
  ctx.y = baseline + 6;
}

function drawSubsectionBar(ctx: Ctx, text: string) {
  const height = 22;
  ensure(ctx, height + 60);
  const page = currentPage(ctx);
  page.drawRectangle({
    x: LEFT,
    y: ctx.y - height,
    width: CONTENT_W,
    height,
    color: ctx.palette.brand,
  });
  const label = text.replace(/^[A-Z]\s*[·\-–]\s*/, '');
  const line = wrap(label, ctx.bold, 11, CONTENT_W - 20)[0] ?? '';
  page.drawText(line, {
    x: LEFT + 10,
    y: ctx.y - height + 7,
    size: 11,
    font: ctx.bold,
    color: ctx.palette.white,
  });
  ctx.y -= height + 10;
}

function drawElementHeading(ctx: Ctx, block: HeadingBlock) {
  const size = 10.5;
  const text = headingText(block);
  const code = block.ricsCode ?? '';
  const label =
    ELEMENT_CODE_RE.test(code) && !text.startsWith(code)
      ? `${code} ${text}`
      : text;
  const lines = wrap(label, ctx.bold, size, CONTENT_W - 32);
  ensure(ctx, lines.length * 15 + 70);
  const top = ctx.y;
  for (const line of lines) {
    drawTextLine(ctx, line, { x: LEFT, size, font: ctx.bold, leading: 15 });
  }
  if (block.conditionRating) {
    drawRatingBadge(
      ctx,
      currentPage(ctx),
      block.conditionRating,
      RIGHT - 9,
      top - 5,
      8.5,
    );
  }
  ctx.y -= 6;
}

function elementNameAndCode(block: HeadingBlock): {
  code: string;
  name: string;
} {
  const text = headingText(block);
  const code = block.ricsCode ?? text.split(' ')[0] ?? '';
  const name = text.startsWith(code) ? text.slice(code.length).trim() : text;
  return { code, name: name.replace(/^[·\-\s]+/, '') };
}

function drawRatingSummary(ctx: Ctx, blocks: SurveyReportBlock[]) {
  const elements = blocks.filter(
    (block): block is HeadingBlock =>
      block.type === 'heading' && Boolean(block.conditionRating),
  );

  drawParagraph(ctx, {
    kind: 'para',
    text: "To determine the condition of the property, we assess the main parts (the 'elements') of the building, garage and some outside areas. These elements are rated on the urgency of maintenance needed, ranging from 'very urgent' to 'no issues recorded'.",
  });
  ctx.y -= 6;

  if (elements.length === 0) {
    drawParagraph(ctx, {
      kind: 'para',
      text: 'No condition ratings recorded yet.',
    });
    return;
  }

  for (const group of RATING_GROUPS) {
    const items = elements.filter(
      (block) => block.conditionRating === group.rating,
    );
    if (items.length === 0) continue;

    const descLines = wrap(group.description, ctx.font, 9.5, CONTENT_W - 50);
    const introHeight = Math.max(38, 16 + descLines.length * 12.5) + 12;
    ensure(ctx, introHeight + 60);
    const page = currentPage(ctx);
    const top = ctx.y;
    drawRatingBadge(ctx, page, group.rating, LEFT + 18, top - 19, 17);
    page.drawText(sanitizePdfText(group.title), {
      x: LEFT + 50,
      y: top - 11,
      size: 11,
      font: ctx.bold,
      color: ctx.palette.brand,
    });
    descLines.forEach((line, index) => {
      page.drawText(line, {
        x: LEFT + 50,
        y: top - 26 - index * 12.5,
        size: 9.5,
        font: ctx.font,
        color: ctx.palette.ink,
      });
    });
    ctx.y = top - introHeight;

    drawTable(
      ctx,
      [92, 190, CONTENT_W - 282],
      ['Element no.', 'Element name', 'Comments (if applicable)'],
      items.map((block) => {
        const { code, name } = elementNameAndCode(block);
        return [code, name, ''];
      }),
    );
    ctx.y -= 6;
  }
}

function drawImages(
  ctx: Ctx,
  run: ImageBlock[],
  images: Map<string, PDFImage | null>,
) {
  const embedded = run
    .map((block) => ({ block, image: images.get(block.id) ?? null }))
    .filter(
      (entry): entry is { block: ImageBlock; image: PDFImage } =>
        entry.image !== null,
    );

  const captionSize = 9;
  const captionLeading = 11.5;

  for (let index = 0; index < embedded.length; index += 2) {
    const row = embedded.slice(index, index + 2);
    const gap = 16;
    const cellWidth = row.length === 2 ? (CONTENT_W - gap) / 2 : 300;
    const maxHeight = row.length === 2 ? 210 : 300;
    const laid = row.map(({ block, image }) => {
      const scale = Math.min(
        cellWidth / image.width,
        maxHeight / image.height,
        1.6,
      );
      const caption = (block.caption || block.alt || '').trim();
      return {
        image,
        width: image.width * scale,
        height: image.height * scale,
        captionLines: caption
          ? wrap(caption, ctx.boldItalic, captionSize, cellWidth)
          : [],
      };
    });
    const rowHeight =
      Math.max(...laid.map((item) => item.height)) +
      Math.max(...laid.map((item) => item.captionLines.length)) *
        captionLeading +
      10;
    ensure(ctx, rowHeight);
    const page = currentPage(ctx);
    const imageBottom = ctx.y - Math.max(...laid.map((item) => item.height));

    laid.forEach((item, cellIndex) => {
      const cellX =
        row.length === 2
          ? LEFT + cellIndex * (cellWidth + gap)
          : LEFT + (CONTENT_W - cellWidth) / 2;
      page.drawImage(item.image, {
        x: cellX + (cellWidth - item.width) / 2,
        y: imageBottom + (Math.max(...laid.map((l) => l.height)) - item.height),
        width: item.width,
        height: item.height,
      });
      item.captionLines.forEach((line, lineIndex) => {
        const width = ctx.boldItalic.widthOfTextAtSize(line, captionSize);
        page.drawText(line, {
          x: cellX + (cellWidth - width) / 2,
          y: imageBottom - 13 - lineIndex * captionLeading,
          size: captionSize,
          font: ctx.boldItalic,
          color: ctx.palette.ink,
        });
      });
    });
    ctx.y -= rowHeight + 10;
  }
}

function drawLogo(
  ctx: Ctx,
  page: PDFPage,
  box: { x: number; top: number; maxWidth: number; maxHeight: number },
  align: 'left' | 'right',
) {
  if (!ctx.logo) return;
  const scale = Math.min(
    box.maxWidth / ctx.logo.width,
    box.maxHeight / ctx.logo.height,
    1,
  );
  const width = ctx.logo.width * scale;
  const height = ctx.logo.height * scale;
  page.drawImage(ctx.logo, {
    x: align === 'left' ? box.x : box.x - width,
    y: box.top - height,
    width,
    height,
  });
}

function drawDividerPage(ctx: Ctx, title: string, blurbHtml: string | null) {
  const match = DIVIDER_TITLE_RE.exec(title);
  const letter = match?.[1] ?? '';
  const name = match?.[2] ?? title;
  const page = addPage(ctx, 'divider');
  ctx.contents.push({ label: title, pageIndex: ctx.pages.length - 1 });

  page.drawRectangle({
    x: PAGE_W - 220,
    y: PAGE_H - 84,
    width: 220,
    height: 28,
    color: ctx.palette.brand,
  });
  drawLogo(
    ctx,
    page,
    { x: RIGHT, top: PAGE_H - 100, maxWidth: 130, maxHeight: 44 },
    'right',
  );

  if (letter) {
    page.drawText(letter, {
      x: LEFT - 4,
      y: PAGE_H - 280,
      size: 120,
      font: ctx.bold,
      color: ctx.palette.brand,
    });
  }

  let baseline = PAGE_H - 352;
  for (const line of wrap(name, ctx.bold, 24, CONTENT_W)) {
    page.drawText(line, {
      x: LEFT,
      y: baseline,
      size: 24,
      font: ctx.bold,
      color: ctx.palette.brand,
    });
    baseline -= 28;
  }

  if (blurbHtml) {
    baseline -= 4;
    for (const item of paragraphItems(blurbHtml)) {
      if (item.kind !== 'para') continue;
      for (const line of wrap(item.text, ctx.font, 11, CONTENT_W)) {
        page.drawText(line, {
          x: LEFT,
          y: baseline,
          size: 11,
          font: ctx.font,
          color: ctx.palette.brand,
        });
        baseline -= 15;
      }
      baseline -= 6;
    }
  }

  ctx.pendingTab = { letter, title: name };
  ctx.sectionTitle = name;
}

function drawCover(
  ctx: Ctx,
  input: SurveyReportPdfInput,
  hero: PDFImage | null,
) {
  const page = addPage(ctx, 'cover');
  const { palette } = ctx;

  page.drawRectangle({
    x: PAGE_W - 220,
    y: PAGE_H - 30,
    width: 220,
    height: 30,
    color: palette.brand,
  });
  drawLogo(
    ctx,
    page,
    { x: 40, top: PAGE_H - 42, maxWidth: 160, maxHeight: 60 },
    'left',
  );

  const heroBox = { x: 0, y: PAGE_H - 720, width: 397, height: 587 };
  if (hero) {
    const scale = Math.max(
      heroBox.width / hero.width,
      heroBox.height / hero.height,
    );
    const width = hero.width * scale;
    const height = hero.height * scale;
    page.pushOperators(
      pushGraphicsState(),
      moveTo(heroBox.x, heroBox.y),
      lineTo(heroBox.x + heroBox.width, heroBox.y),
      lineTo(heroBox.x + heroBox.width, heroBox.y + heroBox.height),
      lineTo(heroBox.x, heroBox.y + heroBox.height),
      closePath(),
      clip(),
      endPath(),
    );
    page.drawImage(hero, {
      x: heroBox.x + (heroBox.width - width) / 2,
      y: heroBox.y + (heroBox.height - height) / 2,
      width,
      height,
    });
    page.pushOperators(popGraphicsState());
  } else {
    page.drawRectangle({ ...heroBox, color: palette.brandWash });
  }

  const panel = { x: 318, y: PAGE_H - 658, width: PAGE_W - 318, height: 438 };
  page.drawRectangle({ ...panel, color: palette.brand });

  const textLeft = panel.x + 28;
  const textMax = PAGE_W - textLeft - 28;
  let baseline = panel.y + panel.height - 44;

  const kicker = input.surveyLevel
    ? `LEVEL ${input.surveyLevel === 3 ? 'THREE' : 'TWO'}`
    : (input.reportLabel ?? 'Building survey').toUpperCase();
  page.drawText(sanitizePdfText(kicker), {
    x: textLeft,
    y: baseline,
    size: 12,
    font: ctx.font,
    color: palette.white,
  });
  baseline -= 34;

  for (const line of wrap('Your survey report', ctx.bold, 28, textMax)) {
    page.drawText(line, {
      x: textLeft,
      y: baseline,
      size: 28,
      font: ctx.bold,
      color: palette.white,
    });
    baseline -= 33;
  }
  baseline -= 14;

  const numeralSize = 140;
  const numeralTop = panel.y + 26 + numeralSize * 0.72;
  const fields: Array<[string, string | null | undefined]> = [
    ['Property address', input.propertyAddress || input.title],
    ["Client's name", input.clientName],
    ['Report date', input.reportDate],
    ['Prepared by', input.brandName],
  ];
  for (const [label, value] of fields) {
    if (!value?.trim()) continue;
    page.drawText(label, {
      x: textLeft,
      y: baseline,
      size: 9.5,
      font: ctx.bold,
      color: palette.white,
    });
    baseline -= 17;
    const width =
      input.surveyLevel && baseline < numeralTop + 12 ? textMax - 96 : textMax;
    for (const line of wrap(value, ctx.font, 9.5, width).slice(0, 4)) {
      page.drawText(line, {
        x: textLeft,
        y: baseline,
        size: 9.5,
        font: ctx.font,
        color: palette.white,
      });
      baseline -= 12.5;
    }
    baseline -= 10;
  }

  if (input.surveyLevel) {
    const numeral = String(input.surveyLevel);
    page.drawText(numeral, {
      x: PAGE_W - 30 - ctx.font.widthOfTextAtSize(numeral, numeralSize),
      y: panel.y + 26,
      size: numeralSize,
      font: ctx.font,
      color: palette.white,
    });
  }
}

function drawContentsPage(
  ctx: Ctx,
  page: PDFPage,
  entries: Ctx['contents'],
  footnote: string | null,
) {
  const { palette } = ctx;
  page.drawText('Contents', {
    x: 92,
    y: PAGE_H - 150,
    size: 24,
    font: ctx.bold,
    color: palette.brand,
  });

  const tableLeft = 152;
  const tableRight = PAGE_W - 102;
  let y = PAGE_H - 186;
  page.drawLine({
    start: { x: tableLeft, y },
    end: { x: tableRight, y },
    thickness: 0.6,
    color: palette.rule,
  });

  for (const entry of entries) {
    const pageLabel = String(entry.pageIndex + 1);
    const pageWidth = ctx.bold.widthOfTextAtSize(pageLabel, 10);
    const lines = wrap(
      entry.label,
      ctx.bold,
      10,
      tableRight - tableLeft - pageWidth - 16,
    );
    const rowHeight = lines.length * 13 + 9;
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: tableLeft,
        y: y - 15 - index * 13,
        size: 10,
        font: ctx.bold,
        color: palette.ink,
      });
    });
    page.drawText(pageLabel, {
      x: tableRight - pageWidth,
      y: y - 15 - (lines.length - 1) * 13,
      size: 10,
      font: ctx.bold,
      color: palette.ink,
    });
    y -= rowHeight;
    page.drawLine({
      start: { x: tableLeft, y },
      end: { x: tableRight, y },
      thickness: 0.6,
      color: palette.rule,
    });
  }

  if (footnote) {
    let baseline = 118;
    for (const line of wrap(footnote, ctx.font, 8.5, PAGE_W - 92 * 2)) {
      page.drawText(line, {
        x: 92,
        y: baseline,
        size: 8.5,
        font: ctx.font,
        color: palette.ink,
      });
      baseline -= 11;
    }
  }
}

function drawFooters(ctx: Ctx, label: string) {
  ctx.pages.forEach(({ page, kind }, index) => {
    if (kind === 'cover' || kind === 'divider') return;
    page.drawLine({
      start: { x: 0, y: 58 },
      end: { x: LEFT - 9, y: 58 },
      thickness: 0.9,
      color: ctx.palette.muted,
    });
    page.drawLine({
      start: { x: LEFT + 3, y: 57 },
      end: { x: PAGE_W, y: 57 },
      thickness: 0.6,
      color: ctx.palette.rule,
    });
    page.drawText(sanitizePdfText(label), {
      x: LEFT + 3,
      y: 34,
      size: 9,
      font: ctx.font,
      color: ctx.palette.muted,
    });
    const pageLabel = String(index + 1);
    page.drawText(pageLabel, {
      x: RIGHT - ctx.font.widthOfTextAtSize(pageLabel, 9),
      y: 34,
      size: 9,
      font: ctx.font,
      color: ctx.palette.muted,
    });
  });
}

async function resolveImages(
  doc: PDFDocument,
  blocks: SurveyReportBlock[],
  input: SurveyReportPdfInput,
): Promise<Map<string, PDFImage | null>> {
  const images = new Map<string, PDFImage | null>();
  for (const block of blocks) {
    if (block.type !== 'image') continue;
    const key = block.documentId ?? block.src;
    const stored = key ? input.imageBytesById?.[key] : undefined;
    const source = stored
      ? { bytes: stored, kind: detectImageKind(stored) }
      : block.src && input.loadImage
        ? await input.loadImage(block.src)
        : null;
    images.set(block.id, source ? await embedImage(doc, source) : null);
  }
  return images;
}

/**
 * Renders a survey report in the RICS Home Survey layout: cover, contents,
 * lettered section dividers, boxed element findings with condition-rating
 * badges, rating summary tables and a running footer with page numbers.
 */
export async function buildSurveyReportPdf(
  input: SurveyReportPdfInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(sanitizePdfText(input.title || 'Survey report'));
  if (input.brandName) doc.setAuthor(sanitizePdfText(input.brandName));

  const ctx: Ctx = {
    doc,
    font: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
    palette: buildPalette(input.brandColor),
    logo: input.logo ? await embedImage(doc, input.logo) : null,
    pages: [],
    page: null,
    onContent: false,
    y: 0,
    box: null,
    pendingTab: null,
    sectionTitle: null,
    contents: [],
  };

  let blocks = orderForPrint(input.document.blocks);

  const first = blocks[0];
  if (
    first?.type === 'heading' &&
    first.level === 1 &&
    !DIVIDER_TITLE_RE.test(headingText(first)) &&
    blocks[1]?.type === 'text'
  ) {
    blocks = blocks.slice(2);
  }

  let contentsFootnote: string | null = null;
  const contentsHeading = blocks[0];
  if (
    contentsHeading?.type === 'heading' &&
    headingText(contentsHeading).toLowerCase() === 'contents'
  ) {
    const next = blocks[1];
    if (next?.type === 'text') {
      contentsFootnote =
        paragraphItems(next.html.replace(/<ol\b[\s\S]*?<\/ol>/gi, ''))
          .map((item) => (item.kind === 'para' ? item.text : ''))
          .join(' ')
          .trim() || null;
      blocks = blocks.slice(2);
    } else {
      blocks = blocks.slice(1);
    }
  }

  const images = await resolveImages(doc, blocks, input);
  const hero =
    blocks
      .filter((block): block is ImageBlock => block.type === 'image')
      .map((block) => images.get(block.id) ?? null)
      .find((image) => image !== null) ?? null;

  drawCover(ctx, input, hero);

  const dividerCount = blocks.filter(
    (block) => block.type === 'heading' && block.level === 1,
  ).length;
  const contentsPages = Array.from(
    { length: Math.ceil(dividerCount / CONTENTS_PER_PAGE) },
    () => addPage(ctx, 'contents'),
  );

  let boxNextText = false;
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!;

    if (block.type === 'heading') {
      const text = headingText(block);
      boxNextText = false;
      if (!text) continue;
      if (block.level === 1) {
        const next = blocks[index + 1];
        const blurb = next?.type === 'text' ? next.html : null;
        if (blurb !== null) index += 1;
        drawDividerPage(ctx, text, blurb);
        continue;
      }
      if (isElementHeading(block)) {
        drawElementHeading(ctx, block);
        boxNextText = true;
        continue;
      }
      const next = blocks[index + 1];
      const isEmpty =
        next?.type === 'text' &&
        !isRatingSummaryHtml(next.html) &&
        surveyHtmlToPdfItems(next.html).length === 0 &&
        blocks[index + 2]?.type !== 'image';
      if (isEmpty || next === undefined || next.type === 'heading') continue;
      if (
        text.toLowerCase() !== ctx.sectionTitle?.toLowerCase() ||
        ctx.onContent
      ) {
        drawSubsectionBar(ctx, text);
      }
      boxNextText = true;
      continue;
    }

    if (block.type === 'text') {
      if (isRatingSummaryHtml(block.html)) {
        drawRatingSummary(ctx, blocks);
        boxNextText = false;
        continue;
      }
      const items = surveyHtmlToPdfItems(block.html);
      if (items.length === 0) {
        boxNextText = false;
        continue;
      }
      if (boxNextText && items.every((item) => item.kind === 'para')) {
        openBox(ctx);
        drawTextItems(ctx, items);
        closeBox(ctx);
      } else {
        ensure(ctx, BODY_LEADING * 2);
        drawTextItems(ctx, items);
        ctx.y -= 6;
      }
      boxNextText = false;
      continue;
    }

    boxNextText = false;

    if (block.type === 'image') {
      let end = index;
      while (blocks[end + 1]?.type === 'image') end += 1;
      drawImages(ctx, blocks.slice(index, end + 1) as ImageBlock[], images);
      index = end;
      continue;
    }

    ensure(ctx, 20);
    currentPage(ctx).drawLine({
      start: { x: LEFT, y: ctx.y - 6 },
      end: { x: RIGHT, y: ctx.y - 6 },
      thickness: 0.6,
      color: ctx.palette.rule,
    });
    ctx.y -= 18;
  }

  contentsPages.forEach((page, pageIndex) => {
    drawContentsPage(
      ctx,
      page,
      ctx.contents.slice(
        pageIndex * CONTENTS_PER_PAGE,
        (pageIndex + 1) * CONTENTS_PER_PAGE,
      ),
      pageIndex === contentsPages.length - 1 ? contentsFootnote : null,
    );
  });

  drawFooters(
    ctx,
    input.reportLabel ||
      (input.brandName ? `${input.brandName} survey report` : 'Survey report'),
  );

  return doc.save();
}
