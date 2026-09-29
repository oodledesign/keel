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
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
} from 'pdf-lib';

import { sanitizePdfText } from '~/lib/invoices/pdf-text';
import {
  type PdfOutlineEntry,
  addInternalLink,
  addUriLink,
  buildOutline,
} from '~/lib/pdf/pdf-links';

import {
  CONDITION_RATING_COLORS,
  type ConditionRating,
} from './condition-rating';
import type {
  SurveyReportBlock,
  SurveyReportDocument,
} from './survey-report-document';

export type SurveyPdfImage = { bytes: Uint8Array; kind: 'png' | 'jpg' };

export type SurveyPdfFonts = {
  regular: Uint8Array;
  bold: Uint8Array;
  italic: Uint8Array;
  boldItalic: Uint8Array;
};

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
  inspectionDate?: string | null;
  surveyorName?: string | null;
  surveyorRicsNumber?: string | null;
  /** RICS Home Survey level; drives the cover kicker and numeral. */
  surveyLevel?: 2 | 3 | null;
  /** Running footer label, e.g. "RICS Home Survey - Level 3". */
  reportLabel?: string | null;
  /** Unicode font files; Helvetica with ASCII fallbacks is used without them. */
  fonts?: SurveyPdfFonts | null;
  /** Shown top right on the cover and every divider when provided. */
  ricsLogo?: SurveyPdfImage | null;
  /** Static artwork referenced by `<figure data-asset="…">` in report HTML. */
  assets?: Record<string, SurveyPdfImage | null | undefined>;
  draft?: boolean;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const LEFT = 85;
const RIGHT = PAGE_W - 50;
const CONTENT_W = RIGHT - LEFT;
const TOP = 72;
const BOTTOM = 84;
const CONTENTS_PER_PAGE = 18;
const BODY_SIZE = 10;
const BODY_LEADING = 14;
const IMAGE_CONCURRENCY = 6;
const ELEMENT_CODE_RE = /^[A-Z]\d+$/;
const DIVIDER_TITLE_RE = /^([A-Z])\s+(.+)$/;
const SECTION_PREFIX_RE = /^[A-Z]\s*[·\-–]\s*/;
const URL_RE = /\b(https?:\/\/[^\s<>"')]+|www\.[^\s<>"')]+)/gi;
const RULE_LINE_RE = /^[\s.\-_–—=·•*]{4,}$/;
const SUBHEADING_RE = /(\s[-–—]|:)$/;
const HYPHEN_BULLET_RE = /^\s*[-•*–]\s+/;

type HeadingBlock = Extract<SurveyReportBlock, { type: 'heading' }>;
type ImageBlock = Extract<SurveyReportBlock, { type: 'image' }>;
type PageKind = 'cover' | 'contents' | 'divider' | 'content';
type FontStyle = 'regular' | 'bold' | 'italic' | 'boldItalic';
type BadgeRating = ConditionRating | 'R';

type Palette = {
  brand: RGB;
  brandTint: RGB;
  brandWash: RGB;
  ink: RGB;
  muted: RGB;
  rule: RGB;
  border: RGB;
  headerFill: RGB;
  panel: RGB;
  danger: RGB;
  white: RGB;
};

export type PdfRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
};

type ParaItem = {
  kind: 'para';
  text: string;
  runs: PdfRun[];
  bold: boolean;
  bullet: boolean;
};

type TableVariant =
  | 'generic'
  | 'accommodation'
  | 'documents'
  | 'repairs'
  | 'qualifications';

type TextItem =
  | ParaItem
  | { kind: 'rule' }
  | {
      kind: 'table';
      header: string[] | null;
      rows: string[][];
      variant: TableVariant;
    }
  | { kind: 'fields'; rows: Array<[string, string]> }
  | { kind: 'field'; label: string; items: TextItem[] }
  | { kind: 'callout'; variant: string; title: string; items: TextItem[] }
  | {
      kind: 'checklist';
      title: string;
      note: string | null;
      options: Array<{ label: string; checked: boolean }>;
    }
  | { kind: 'documents'; title: string; intro: TextItem[]; rows: string[][] }
  | { kind: 'diagram'; asset: string };

type PageEntry = { page: PDFPage; kind: PageKind; marker: string | null };

type SectionEntry = {
  label: string;
  pageIndex: number;
  children: Array<{ label: string; pageIndex: number }>;
};

type TextStyle = { size: number; leading: number; color: RGB };

type Ctx = {
  doc: PDFDocument;
  fonts: Record<FontStyle, PDFFont>;
  unicode: boolean;
  palette: Palette;
  logo: PDFImage | null;
  ricsLogo: PDFImage | null;
  assets: Map<string, PDFImage | null>;
  pages: PageEntry[];
  page: PDFPage | null;
  /** True while the current page accepts flowing content. */
  flowing: boolean;
  y: number;
  frame: { x: number; width: number };
  style: TextStyle;
  pendingTab: { letter: string; title: string } | null;
  sectionLetter: string;
  sectionTitle: string | null;
  subsection: string | null;
  contents: SectionEntry[];
};

type RatingGroup = {
  rating: ConditionRating;
  title: string;
  description: string;
};

const RATING_GROUPS: RatingGroup[] = [
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

const DEFAULT_RATING_INTRO =
  "To determine the condition of the property, we assess the main parts (the 'elements') of the building, garage and some outside areas. These elements are rated on the urgency of maintenance needed, ranging from 'very urgent' to 'no issues recorded'.";

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
    panel: rgb(0.93, 0.93, 0.94),
    danger: hexToRgb(CONDITION_RATING_COLORS['3'], rgb(0.78, 0.16, 0.16)),
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
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&amp;/gi, '&');
}

function htmlInlineText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag);
  return match ? decodeEntities(match[1]!) : null;
}

function safeHref(href: string | null): string | undefined {
  if (!href) return undefined;
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  if (/^www\./i.test(href)) return `https://${href}`;
  return undefined;
}

function linkifyRuns(runs: PdfRun[]): PdfRun[] {
  const result: PdfRun[] = [];
  for (const run of runs) {
    if (run.href) {
      result.push(run);
      continue;
    }
    let cursor = 0;
    for (const match of run.text.matchAll(URL_RE)) {
      const start = match.index ?? 0;
      const url = match[0].replace(/[.,;:]+$/, '');
      if (start > cursor) {
        result.push({ ...run, text: run.text.slice(cursor, start) });
      }
      result.push({ ...run, text: url, href: safeHref(url) });
      cursor = start + url.length;
    }
    if (cursor < run.text.length) {
      result.push({ ...run, text: run.text.slice(cursor) });
    }
  }
  return result;
}

function finishParagraph(
  runs: PdfRun[],
  flags: { bullet: boolean; heading: boolean },
): TextItem | null {
  const collapsed = runs
    .map((run) => ({ ...run, text: run.text.replace(/\s+/g, ' ') }))
    .filter((run) => run.text.length > 0);
  if (collapsed.length === 0) return null;
  collapsed[0]!.text = collapsed[0]!.text.trimStart();
  collapsed[collapsed.length - 1]!.text =
    collapsed[collapsed.length - 1]!.text.trimEnd();

  let text = collapsed.map((run) => run.text).join('');
  if (!text.trim()) return null;
  if (RULE_LINE_RE.test(text)) return { kind: 'rule' };

  let bullet = flags.bullet;
  if (!bullet && HYPHEN_BULLET_RE.test(text)) {
    bullet = true;
    collapsed[0]!.text = collapsed[0]!.text.replace(HYPHEN_BULLET_RE, '');
    text = collapsed.map((run) => run.text).join('');
  }

  const words = text.split(' ').length;
  const subheading =
    !bullet && !flags.heading && words <= 8 && SUBHEADING_RE.test(text);
  const finalRuns = linkifyRuns(
    collapsed
      .filter((run) => run.text.length > 0)
      .map((run) =>
        flags.heading || subheading ? { ...run, bold: true } : run,
      ),
  );
  return {
    kind: 'para',
    text,
    runs: finalRuns,
    bold: finalRuns.every((run) => run.bold),
    bullet,
  };
}

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'blockquote',
  'ul',
  'ol',
  'section',
  'aside',
  'figure',
  'figcaption',
  'table',
  'tr',
  'br',
  'hr',
]);

/** Paragraphs with inline bold, italic and link runs. */
function flowItems(html: string): TextItem[] {
  const items: TextItem[] = [];
  let runs: PdfRun[] = [];
  let flags = { bullet: false, heading: false };
  let bold = 0;
  let italic = 0;
  let href: string | undefined;

  const flush = () => {
    const item = finishParagraph(runs, flags);
    if (item) items.push(item);
    runs = [];
    flags = { bullet: false, heading: false };
  };

  for (const token of html.matchAll(
    /<(\/?)([a-zA-Z0-9]+)\b([^>]*)>|([^<]+)/g,
  )) {
    const [, closing, rawName, tagAttrs, rawText] = token;
    if (rawText !== undefined) {
      const segments = decodeEntities(rawText).split('\n');
      segments.forEach((segment, index) => {
        if (index > 0) flush();
        runs.push({
          text: segment,
          bold: bold > 0 || flags.heading,
          italic: italic > 0,
          href,
        });
      });
      continue;
    }
    const name = rawName!.toLowerCase();
    const isClosing = closing === '/';
    if (BLOCK_TAGS.has(name)) {
      flush();
      if (name === 'hr') items.push({ kind: 'rule' });
    } else if (name === 'li') {
      flush();
      if (!isClosing) flags.bullet = true;
    } else if (/^h[1-6]$/.test(name)) {
      flush();
      if (!isClosing) flags.heading = true;
    } else if (name === 'strong' || name === 'b') {
      bold = Math.max(0, bold + (isClosing ? -1 : 1));
    } else if (name === 'em' || name === 'i') {
      italic = Math.max(0, italic + (isClosing ? -1 : 1));
    } else if (name === 'a') {
      href = isClosing ? undefined : safeHref(attr(tagAttrs ?? '', 'href'));
    }
  }
  flush();
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

function tableItem(attrs: string, inner: string): TextItem | null {
  const className = attr(attrs, 'class') ?? '';
  if (className.includes('survey-rating-unrated')) return null;
  const rows = tableRows(inner);
  if (rows.length === 0) return null;

  if (className.includes('survey-merge-fields')) {
    return {
      kind: 'fields',
      rows: rows.map(({ cells }) => [
        MERGE_FIELD_LABELS[cells[0] ?? ''] ?? cells[0] ?? '',
        cells[1] ?? '',
      ]),
    };
  }

  const variant: TableVariant = className.includes('survey-accommodation')
    ? 'accommodation'
    : className.includes('survey-documents-table')
      ? 'documents'
      : className.includes('survey-repairs-table')
        ? 'repairs'
        : className.includes('survey-qualifications')
          ? 'qualifications'
          : 'generic';
  const [first, ...rest] = rows;
  return {
    kind: 'table',
    header: first!.header ? first!.cells : null,
    rows: first!.header
      ? rest.map((row) => row.cells)
      : rows.map((row) => row.cells),
    variant,
  };
}

function splitTitle(inner: string): { title: string; body: string } {
  const match = /^\s*<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(inner);
  if (!match) return { title: '', body: inner };
  return {
    title: htmlInlineText(match[1]!),
    body: inner.slice(match[0].length),
  };
}

const STRUCTURED_RE =
  /<aside\b([^>]*)>([\s\S]*?)<\/aside>|<section\b([^>]*class="survey-field"[^>]*)>([\s\S]*?)<\/section>|<div\b([^>]*class="survey-checklist"[^>]*)>([\s\S]*?)<\/div>|<div\b([^>]*class="survey-documents"[^>]*)>([\s\S]*?)<\/div>|<figure\b([^>]*)>([\s\S]*?)<\/figure>|<table\b([^>]*)>([\s\S]*?)<\/table>/gi;

/**
 * Splits report HTML into paragraphs, tables, label/value fields, callout
 * panels, service checklists, the documents table and diagram figures.
 */
export function surveyHtmlToPdfItems(html: string): TextItem[] {
  const items: TextItem[] = [];
  let cursor = 0;
  for (const match of html.matchAll(STRUCTURED_RE)) {
    items.push(...flowItems(html.slice(cursor, match.index)));
    cursor = (match.index ?? 0) + match[0].length;
    const [
      ,
      asideAttrs,
      asideInner,
      fieldAttrs,
      fieldInner,
      checklistAttrs,
      checklistInner,
      documentsAttrs,
      documentsInner,
      figureAttrs,
      figureInner,
      tableAttrs,
      tableInner,
    ] = match;

    if (asideAttrs !== undefined) {
      const { title, body } = splitTitle(asideInner!);
      items.push({
        kind: 'callout',
        variant: attr(asideAttrs, 'data-variant') ?? 'important',
        title,
        items: surveyHtmlToPdfItems(body),
      });
    } else if (fieldAttrs !== undefined) {
      const { title, body } = splitTitle(fieldInner!);
      const value = surveyHtmlToPdfItems(body);
      items.push({
        kind: 'field',
        label: title,
        items: value.length > 0 ? value : flowItems('<p>n/a</p>'),
      });
    } else if (checklistAttrs !== undefined) {
      const { title, body } = splitTitle(checklistInner!);
      const note = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(body);
      items.push({
        kind: 'checklist',
        title,
        note: note ? htmlInlineText(note[1]!) : null,
        options: Array.from(
          body.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi),
          (option) => ({
            label: htmlInlineText(option[2]!).replace(/^[☒☐✓✔x]\s*/i, ''),
            checked: attr(option[1]!, 'data-checked') === 'true',
          }),
        ),
      });
    } else if (documentsAttrs !== undefined) {
      const { title, body } = splitTitle(documentsInner!);
      const table = /<table\b([^>]*)>([\s\S]*?)<\/table>/i.exec(body);
      const parsed = table ? tableItem(table[1]!, table[2]!) : null;
      items.push({
        kind: 'documents',
        title: title.replace(/^R\s+/, ''),
        intro: flowItems(table ? body.slice(0, table.index) : body),
        rows: parsed?.kind === 'table' ? parsed.rows : [],
      });
    } else if (figureAttrs !== undefined) {
      const asset = attr(figureAttrs, 'data-asset');
      if (asset) items.push({ kind: 'diagram', asset });
      else items.push(...flowItems(figureInner!));
    } else if (tableAttrs !== undefined) {
      const item = tableItem(tableAttrs, tableInner!);
      if (item) items.push(item);
    }
  }
  items.push(...flowItems(html.slice(cursor)));
  return items;
}

function clean(ctx: Ctx, text: string): string {
  if (!ctx.unicode) return sanitizePdfText(text);
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001F\u007F]/g, ' ');
}

function wrap(
  ctx: Ctx,
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = clean(ctx, text).replace(/\s+/g, ' ').trim().split(' ');
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

type LaidWord = {
  text: string;
  style: FontStyle;
  href?: string;
  width: number;
  spaceBefore: boolean;
};

function runStyle(run: PdfRun): FontStyle {
  if (run.bold && run.italic) return 'boldItalic';
  if (run.bold) return 'bold';
  if (run.italic) return 'italic';
  return 'regular';
}

function layoutRuns(
  ctx: Ctx,
  runs: PdfRun[],
  size: number,
  maxWidth: number,
): LaidWord[][] {
  const words: LaidWord[] = [];
  let pendingSpace = false;
  for (const run of runs) {
    const style = runStyle(run);
    const font = ctx.fonts[style];
    for (const part of clean(ctx, run.text).split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        pendingSpace = words.length > 0;
        continue;
      }
      const pieces: string[] = [];
      if (font.widthOfTextAtSize(part, size) <= maxWidth) {
        pieces.push(part);
      } else {
        let chunk = '';
        for (const char of part) {
          if (font.widthOfTextAtSize(chunk + char, size) > maxWidth && chunk) {
            pieces.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        if (chunk) pieces.push(chunk);
      }
      pieces.forEach((piece, index) => {
        words.push({
          text: piece,
          style,
          href: run.href,
          width: font.widthOfTextAtSize(piece, size),
          spaceBefore: index === 0 && pendingSpace,
        });
      });
      pendingSpace = false;
    }
  }

  const lines: LaidWord[][] = [];
  let line: LaidWord[] = [];
  let width = 0;
  for (const word of words) {
    const space =
      line.length > 0 && word.spaceBefore
        ? ctx.fonts[word.style].widthOfTextAtSize(' ', size)
        : 0;
    if (line.length > 0 && width + space + word.width > maxWidth) {
      lines.push(line);
      line = [{ ...word, spaceBefore: false }];
      width = word.width;
      continue;
    }
    line.push(line.length === 0 ? { ...word, spaceBefore: false } : word);
    width += space + word.width;
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

function drawLaidLine(
  ctx: Ctx,
  page: PDFPage,
  line: LaidWord[],
  options: { x: number; baseline: number; size: number; color: RGB },
) {
  let x = options.x;
  let index = 0;
  while (index < line.length) {
    const first = line[index]!;
    let text = first.text;
    let next = index + 1;
    while (
      next < line.length &&
      line[next]!.style === first.style &&
      line[next]!.href === first.href
    ) {
      text += `${line[next]!.spaceBefore ? ' ' : ''}${line[next]!.text}`;
      next += 1;
    }
    const font = ctx.fonts[first.style];
    if (first.spaceBefore) x += font.widthOfTextAtSize(' ', options.size);
    const width = font.widthOfTextAtSize(text, options.size);
    const color = first.href ? ctx.palette.brand : options.color;
    page.drawText(text, {
      x,
      y: options.baseline,
      size: options.size,
      font,
      color,
    });
    if (first.href) {
      page.drawLine({
        start: { x, y: options.baseline - 1.5 },
        end: { x: x + width, y: options.baseline - 1.5 },
        thickness: 0.5,
        color,
      });
      addUriLink(
        page,
        {
          x,
          y: options.baseline - 3,
          width,
          height: options.size + 3,
        },
        first.href,
      );
    }
    x += width;
    index = next;
  }
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
    /data-rating="(?:1|2|3|NI|NA)"/.test(html) ||
    html.includes('survey-rating-unrated') ||
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

function sectionMarker(ctx: Ctx): string | null {
  const title = ctx.subsection ?? ctx.sectionTitle;
  if (!title) return null;
  return ctx.sectionLetter ? `${ctx.sectionLetter}  ${title}` : title;
}

function addPage(ctx: Ctx, kind: PageKind): PDFPage {
  const page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.pages.push({
    page,
    kind,
    marker: kind === 'content' ? sectionMarker(ctx) : null,
  });
  ctx.page = page;
  ctx.flowing = kind === 'content';
  return page;
}

function currentPage(ctx: Ctx): PDFPage {
  if (!ctx.page) throw new Error('No page');
  return ctx.page;
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
  if (ctx.flowing && ctx.y - needed >= BOTTOM) return;
  startContentPage(ctx);
}

function drawParagraph(ctx: Ctx, item: ParaItem) {
  const { size, leading, color } = ctx.style;
  const indent = item.bullet ? 16 : 0;
  const lines = layoutRuns(ctx, item.runs, size, ctx.frame.width - indent);
  lines.forEach((line, index) => {
    ensure(ctx, leading);
    const page = currentPage(ctx);
    if (item.bullet && index === 0) {
      page.drawCircle({
        x: ctx.frame.x + 4,
        y: ctx.y - size * 0.5,
        size: 1.6,
        color,
      });
    }
    drawLaidLine(ctx, page, line, {
      x: ctx.frame.x + indent,
      baseline: ctx.y - size * 0.85,
      size,
      color,
    });
    ctx.y -= leading;
  });
  ctx.y -= item.bullet ? 3 : 7;
}

function paragraphHeight(ctx: Ctx, item: ParaItem, width: number): number {
  const lines = layoutRuns(
    ctx,
    item.runs,
    ctx.style.size,
    width - (item.bullet ? 16 : 0),
  );
  return lines.length * ctx.style.leading + (item.bullet ? 3 : 7);
}

function drawRule(ctx: Ctx) {
  ensure(ctx, 16);
  currentPage(ctx).drawLine({
    start: { x: ctx.frame.x, y: ctx.y - 6 },
    end: { x: ctx.frame.x + ctx.frame.width, y: ctx.y - 6 },
    thickness: 0.6,
    color: ctx.palette.rule,
  });
  ctx.y -= 16;
}

type TableOptions = {
  size?: number;
  headerFill?: RGB;
  headerColor?: RGB;
  rowHeaderFill?: RGB;
  align?: 'left' | 'center';
};

function drawTable(
  ctx: Ctx,
  columns: number[],
  header: string[] | null,
  rows: string[][],
  options: TableOptions = {},
) {
  const baseSize = options.size ?? 9.5;
  const pad = baseSize < 9 ? 4 : 7;
  const x0 = ctx.frame.x;
  const headerSize = header
    ? Math.min(
        baseSize,
        ...columns.flatMap((width, index) =>
          clean(ctx, header[index] ?? '')
            .split(/\s+/)
            .filter(Boolean)
            .map(
              (word) =>
                ((width - pad * 2) /
                  ctx.fonts.bold.widthOfTextAtSize(word, baseSize)) *
                baseSize,
            ),
        ),
      )
    : baseSize;

  const measure = (cells: string[], font: PDFFont, isHeader: boolean) => {
    const size = isHeader ? headerSize : baseSize;
    const wrapped = columns.map((width, index) =>
      wrap(ctx, cells[index] ?? '', font, size, width - pad * 2),
    );
    const height =
      Math.max(1, ...wrapped.map((lines) => lines.length)) * size * 1.3 +
      pad * 2;
    return { wrapped, height, size };
  };

  const drawRow = (cells: string[], isHeader: boolean) => {
    const pageBefore = ctx.page;
    const probe = measure(
      cells,
      isHeader ? ctx.fonts.bold : ctx.fonts.regular,
      isHeader,
    );
    ensure(ctx, probe.height);
    if (!isHeader && header && ctx.page !== pageBefore) {
      drawRow(header, true);
      ensure(ctx, probe.height);
    }
    const page = currentPage(ctx);
    let x = x0;
    columns.forEach((width, index) => {
      const rowHeader = !isHeader && index === 0 && options.rowHeaderFill;
      const font = isHeader || rowHeader ? ctx.fonts.bold : ctx.fonts.regular;
      const { wrapped, height, size } = measure(cells, font, isHeader);
      const leading = size * 1.3;
      const lines = wrapped[index]!;
      page.drawRectangle({
        x,
        y: ctx.y - probe.height,
        width,
        height: Math.max(height, probe.height),
        color: isHeader
          ? (options.headerFill ?? ctx.palette.headerFill)
          : rowHeader
            ? options.rowHeaderFill
            : undefined,
        borderColor: ctx.palette.border,
        borderWidth: 0.6,
      });
      const centred =
        options.align === 'center' && !(index === 0 && options.rowHeaderFill);
      lines.forEach((line, lineIndex) => {
        const lineWidth = font.widthOfTextAtSize(line, size);
        page.drawText(line, {
          x: centred ? x + (width - lineWidth) / 2 : x + pad,
          y: ctx.y - pad - size * 0.85 - lineIndex * leading,
          size,
          font,
          color: isHeader
            ? (options.headerColor ?? ctx.palette.ink)
            : ctx.palette.ink,
        });
      });
      x += width;
    });
    ctx.y -= probe.height;
  };

  if (header) drawRow(header, true);
  for (const row of rows) drawRow(row, false);
  ctx.y -= 14;
}

function drawVariantTable(
  ctx: Ctx,
  item: Extract<TextItem, { kind: 'table' }>,
) {
  const width = ctx.frame.width;
  const count = Math.max(
    item.header?.length ?? 0,
    ...item.rows.map((row) => row.length),
  );
  if (count === 0) return;

  if (item.variant === 'accommodation') {
    const first = 70;
    const rest = (width - first) / Math.max(1, count - 1);
    drawTable(
      ctx,
      [first, ...Array.from({ length: count - 1 }, () => rest)],
      item.header,
      item.rows,
      {
        size: 8,
        headerFill: ctx.palette.brand,
        headerColor: ctx.palette.white,
        rowHeaderFill: ctx.palette.headerFill,
        align: 'center',
      },
    );
    return;
  }
  if (item.variant === 'documents') {
    drawTable(ctx, [56, width - 136, 80], item.header, item.rows);
    return;
  }
  if (item.variant === 'repairs') {
    drawTable(ctx, [width - 140, 140], item.header, item.rows);
    return;
  }
  if (item.variant === 'qualifications') {
    drawTable(
      ctx,
      [60, (width - 60) / 2, (width - 60) / 2],
      item.header,
      item.rows,
    );
    return;
  }
  drawTable(
    ctx,
    Array.from({ length: count }, () => width / count),
    item.header,
    item.rows,
  );
}

function drawFieldLabel(ctx: Ctx, label: string) {
  ensure(ctx, BODY_LEADING * 3);
  drawParagraph(ctx, {
    kind: 'para',
    text: label,
    runs: [{ text: label, bold: true }],
    bold: true,
    bullet: false,
  });
  ctx.y += 3;
}

function drawFields(ctx: Ctx, rows: Array<[string, string]>) {
  for (const [label, value] of rows) {
    drawFieldLabel(ctx, label);
    const text = value || 'n/a';
    drawParagraph(ctx, {
      kind: 'para',
      text,
      runs: linkifyRuns([{ text }]),
      bold: false,
      bullet: false,
    });
    ctx.y -= 4;
  }
}

function measureItems(ctx: Ctx, items: TextItem[], width: number): number {
  let height = 0;
  for (const item of items) {
    if (item.kind === 'para') height += paragraphHeight(ctx, item, width);
    else if (item.kind === 'rule') height += 16;
    else height += 40;
  }
  return height;
}

function drawCallout(ctx: Ctx, item: Extract<TextItem, { kind: 'callout' }>) {
  const pad = 14;
  const outer = { ...ctx.frame };
  const inner = { x: outer.x + pad, width: outer.width - pad * 2 };
  const bodyHeight = measureItems(ctx, item.items, inner.width);
  const height = pad + 24 + bodyHeight + pad - 7;
  const capacity = PAGE_H - TOP - BOTTOM - 60;
  const panelled = height <= capacity;

  ensure(ctx, panelled ? height + 8 : 60);
  const page = currentPage(ctx);
  const top = ctx.y;
  if (panelled) {
    page.drawRectangle({
      x: outer.x,
      y: top - height,
      width: outer.width,
      height,
      color: ctx.palette.panel,
    });
  }
  const badgeColor =
    item.variant === 'warning' ? ctx.palette.danger : ctx.palette.brand;
  const badgeY = top - pad - 8;
  page.drawCircle({
    x: inner.x + 8,
    y: badgeY,
    size: 8,
    color: badgeColor,
  });
  page.drawText('!', {
    x: inner.x + 8 - ctx.fonts.bold.widthOfTextAtSize('!', 10) / 2,
    y: badgeY - 3.5,
    size: 10,
    font: ctx.fonts.bold,
    color: ctx.palette.white,
  });
  if (item.title) {
    page.drawText(clean(ctx, item.title), {
      x: inner.x + 24,
      y: badgeY - 4,
      size: 11,
      font: ctx.fonts.bold,
      color: badgeColor,
    });
  }
  ctx.y = top - pad - 24;
  ctx.frame = inner;
  drawTextItems(ctx, item.items);
  ctx.frame = outer;
  ctx.y = panelled ? Math.min(ctx.y, top - height) - 14 : ctx.y - 8;
}

function drawChecklist(
  ctx: Ctx,
  item: Extract<TextItem, { kind: 'checklist' }>,
) {
  if (item.title) drawFieldLabel(ctx, item.title);
  if (item.note) {
    drawParagraph(ctx, {
      kind: 'para',
      text: item.note,
      runs: [{ text: item.note }],
      bold: false,
      bullet: false,
    });
    ctx.y += 2;
  }
  const perRow = 4;
  const box = 18;
  const columnWidth = ctx.frame.width / perRow;
  for (let index = 0; index < item.options.length; index += perRow) {
    ensure(ctx, box + 10);
    const page = currentPage(ctx);
    item.options.slice(index, index + perRow).forEach((option, column) => {
      const x = ctx.frame.x + column * columnWidth;
      page.drawRectangle({
        x,
        y: ctx.y - box,
        width: box,
        height: box,
        color: option.checked ? ctx.palette.brand : ctx.palette.white,
        borderColor: ctx.palette.border,
        borderWidth: 0.8,
      });
      page.drawText(clean(ctx, option.label), {
        x: x + box + 8,
        y: ctx.y - box / 2 - BODY_SIZE * 0.35,
        size: 9.5,
        font: ctx.fonts.regular,
        color: ctx.palette.ink,
      });
    });
    ctx.y -= box + 8;
  }
  ctx.y -= 8;
}

function drawGroupHeader(
  ctx: Ctx,
  rating: BadgeRating,
  title: string,
  description: string,
) {
  const descLines = wrap(
    ctx,
    description,
    ctx.fonts.regular,
    9.5,
    CONTENT_W - 50,
  );
  const introHeight = Math.max(38, 16 + descLines.length * 12.5) + 12;
  ensure(ctx, introHeight + 60);
  const page = currentPage(ctx);
  const top = ctx.y;
  drawRatingBadge(ctx, page, rating, LEFT + 18, top - 19, 17);
  page.drawText(clean(ctx, title), {
    x: LEFT + 50,
    y: top - 11,
    size: 11,
    font: ctx.fonts.bold,
    color: ctx.palette.brand,
  });
  descLines.forEach((line, index) => {
    page.drawText(line, {
      x: LEFT + 50,
      y: top - 26 - index * 12.5,
      size: 9.5,
      font: ctx.fonts.regular,
      color: ctx.palette.ink,
    });
  });
  ctx.y = top - introHeight;
}

function drawDocuments(
  ctx: Ctx,
  item: Extract<TextItem, { kind: 'documents' }>,
) {
  if (item.rows.length === 0) return;
  const description = item.intro
    .map((entry) => (entry.kind === 'para' ? entry.text : ''))
    .join(' ')
    .trim();
  drawGroupHeader(
    ctx,
    'R',
    item.title ||
      'Documents we may suggest you request before you sign contracts',
    description,
  );
  drawTable(
    ctx,
    [56, CONTENT_W - 136, 80],
    ['Element no.', 'Document name', 'Received'],
    item.rows,
  );
  ctx.y -= 6;
}

function drawDiagram(ctx: Ctx, asset: string) {
  const image = ctx.assets.get(asset);
  if (!image) return;
  const maxHeight = PAGE_H - TOP - BOTTOM - 120;
  const scale = Math.min(
    ctx.frame.width / image.width,
    maxHeight / image.height,
  );
  const width = image.width * scale;
  const height = image.height * scale;
  ensure(ctx, height + 12);
  currentPage(ctx).drawImage(image, {
    x: ctx.frame.x + (ctx.frame.width - width) / 2,
    y: ctx.y - height,
    width,
    height,
  });
  ctx.y -= height + 16;
}

function drawTextItems(ctx: Ctx, items: TextItem[]) {
  for (const item of items) {
    switch (item.kind) {
      case 'para':
        drawParagraph(ctx, item);
        break;
      case 'rule':
        drawRule(ctx);
        break;
      case 'fields':
        drawFields(ctx, item.rows);
        break;
      case 'field':
        drawFieldLabel(ctx, item.label);
        drawTextItems(ctx, item.items);
        ctx.y -= 4;
        break;
      case 'callout':
        drawCallout(ctx, item);
        break;
      case 'checklist':
        drawChecklist(ctx, item);
        break;
      case 'documents':
        drawDocuments(ctx, item);
        break;
      case 'diagram':
        drawDiagram(ctx, item.asset);
        break;
      case 'table':
        drawVariantTable(ctx, item);
        break;
    }
  }
}

function drawRatingBadge(
  ctx: Ctx,
  page: PDFPage,
  rating: BadgeRating,
  cx: number,
  cy: number,
  radius: number,
) {
  const numeric = rating === '1' || rating === '2' || rating === '3';
  const size = numeric || rating === 'R' ? radius * 1.05 : radius * 0.78;
  const bold = ctx.fonts.bold;
  const width = bold.widthOfTextAtSize(rating, size);
  const outline = rating === 'R' ? ctx.palette.danger : ctx.palette.ink;
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
      borderColor: outline,
      borderWidth: Math.max(0.8, radius / 10),
    });
  }
  page.drawText(rating, {
    x: cx - width / 2,
    y: cy - size * 0.36,
    size,
    font: bold,
    color: numeric ? ctx.palette.white : outline,
  });
}

function drawSectionTab(ctx: Ctx, tab: { letter: string; title: string }) {
  const page = currentPage(ctx);
  const tabTop = PAGE_H - 86;
  const tabHeight = 58;
  const bold = ctx.fonts.bold;
  if (tab.letter) {
    page.drawRectangle({
      x: 0,
      y: tabTop - tabHeight,
      width: 67,
      height: tabHeight,
      color: ctx.palette.brandTint,
    });
    const size = 44;
    const width = bold.widthOfTextAtSize(tab.letter, size);
    page.drawText(tab.letter, {
      x: (67 - width) / 2,
      y: tabTop - tabHeight + 13,
      size,
      font: bold,
      color: ctx.palette.white,
    });
  }
  const lines = wrap(ctx, tab.title, bold, 20, CONTENT_W);
  let baseline = tabTop - 38;
  for (const line of lines) {
    page.drawText(line, {
      x: LEFT,
      y: baseline,
      size: 20,
      font: bold,
      color: ctx.palette.brand,
    });
    baseline -= 24;
  }
  ctx.y = baseline + 6;
}

function drawSubsectionBar(ctx: Ctx, label: string) {
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
  const line = wrap(ctx, label, ctx.fonts.bold, 11, CONTENT_W - 20)[0] ?? '';
  page.drawText(line, {
    x: LEFT + 10,
    y: ctx.y - height + 7,
    size: 11,
    font: ctx.fonts.bold,
    color: ctx.palette.white,
  });
  ctx.y -= height + 10;
}

/** Sub-sections of a lettered section (C) start a page with their own tab. */
function startSubsection(ctx: Ctx, label: string) {
  ctx.subsection = label;
  ctx.contents.at(-1)?.children.push({ label, pageIndex: ctx.pages.length });
  if (ctx.pendingTab) {
    ctx.pendingTab.title = label;
    return;
  }
  ctx.pendingTab = { letter: ctx.sectionLetter, title: label };
  startContentPage(ctx);
}

function drawElementHeading(ctx: Ctx, block: HeadingBlock) {
  const size = 10.5;
  const text = headingText(block);
  const code = block.ricsCode ?? '';
  const label =
    ELEMENT_CODE_RE.test(code) && !text.startsWith(code)
      ? `${code} ${text}`
      : text;
  const lines = wrap(ctx, label, ctx.fonts.bold, size, CONTENT_W - 32);
  ensure(ctx, lines.length * 15 + 70);
  ctx.contents
    .at(-1)
    ?.children.push({ label, pageIndex: ctx.pages.length - 1 });
  const page = currentPage(ctx);
  const top = ctx.y;
  for (const line of lines) {
    page.drawText(line, {
      x: LEFT,
      y: ctx.y - size * 0.85,
      size,
      font: ctx.fonts.bold,
      color: ctx.palette.ink,
    });
    ctx.y -= 15;
  }
  if (block.conditionRating) {
    drawRatingBadge(ctx, page, block.conditionRating, RIGHT - 9, top - 5, 8.5);
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

const RATING_GROUPS_START_RE =
  /<h3\b[^>]*>\s*(?:Condition rating|Not yet rated)|<p>No condition ratings recorded yet/i;

function drawRatingSummary(
  ctx: Ctx,
  blocks: SurveyReportBlock[],
  html: string,
) {
  const start = RATING_GROUPS_START_RE.exec(html);
  const intro = surveyHtmlToPdfItems(
    start ? html.slice(0, start.index) : html,
  ).filter((item) => item.kind === 'para' || item.kind === 'documents');
  if (!intro.some((item) => item.kind === 'para')) {
    intro.unshift({
      kind: 'para',
      text: DEFAULT_RATING_INTRO,
      runs: [{ text: DEFAULT_RATING_INTRO }],
      bold: false,
      bullet: false,
    });
  }
  drawTextItems(ctx, intro);
  ctx.y -= 6;

  const elements = blocks.filter(
    (block): block is HeadingBlock =>
      block.type === 'heading' && Boolean(block.conditionRating),
  );
  if (elements.length === 0) {
    drawParagraph(ctx, {
      kind: 'para',
      text: 'No condition ratings recorded yet.',
      runs: [{ text: 'No condition ratings recorded yet.' }],
      bold: false,
      bullet: false,
    });
    return;
  }

  for (const group of RATING_GROUPS) {
    const items = elements.filter(
      (block) => block.conditionRating === group.rating,
    );
    if (items.length === 0) continue;
    drawGroupHeader(ctx, group.rating, group.title, group.description);
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

function drawCaption(
  ctx: Ctx,
  page: PDFPage,
  lines: string[],
  centreX: number,
  top: number,
) {
  const size = 9;
  lines.forEach((line, index) => {
    const width = ctx.fonts.boldItalic.widthOfTextAtSize(line, size);
    page.drawText(line, {
      x: centreX - width / 2,
      y: top - index * 11.5,
      size,
      font: ctx.fonts.boldItalic,
      color: ctx.palette.ink,
    });
  });
}

function captionFor(block: ImageBlock): string {
  return (block.caption || block.alt || '').trim();
}

/**
 * Landscape shots print full width, one under another; portrait and square
 * shots sit two to a row.
 */
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
  const captionLeading = 11.5;
  const isLandscape = (image: PDFImage) => image.width / image.height >= 1.25;

  let index = 0;
  while (index < embedded.length) {
    const current = embedded[index]!;
    const next = embedded[index + 1];

    if (isLandscape(current.image) || !next || isLandscape(next.image)) {
      const maxWidth = isLandscape(current.image) ? CONTENT_W : 300;
      const scale = Math.min(
        maxWidth / current.image.width,
        320 / current.image.height,
        1.6,
      );
      const width = current.image.width * scale;
      const height = current.image.height * scale;
      const caption = captionFor(current.block);
      const lines = caption
        ? wrap(ctx, caption, ctx.fonts.boldItalic, 9, CONTENT_W)
        : [];
      ensure(ctx, height + lines.length * captionLeading + 14);
      const page = currentPage(ctx);
      page.drawImage(current.image, {
        x: LEFT + (CONTENT_W - width) / 2,
        y: ctx.y - height,
        width,
        height,
      });
      drawCaption(ctx, page, lines, LEFT + CONTENT_W / 2, ctx.y - height - 13);
      ctx.y -= height + lines.length * captionLeading + 22;
      index += 1;
      continue;
    }

    const gap = 16;
    const cellWidth = (CONTENT_W - gap) / 2;
    const laid = [current, next].map(({ block, image }) => {
      const scale = Math.min(cellWidth / image.width, 240 / image.height, 1.6);
      const caption = captionFor(block);
      return {
        image,
        width: image.width * scale,
        height: image.height * scale,
        lines: caption
          ? wrap(ctx, caption, ctx.fonts.boldItalic, 9, cellWidth)
          : [],
      };
    });
    const imageHeight = Math.max(...laid.map((item) => item.height));
    const rowHeight =
      imageHeight +
      Math.max(...laid.map((item) => item.lines.length)) * captionLeading +
      10;
    ensure(ctx, rowHeight);
    const page = currentPage(ctx);
    const imageBottom = ctx.y - imageHeight;
    laid.forEach((item, cellIndex) => {
      const cellX = LEFT + cellIndex * (cellWidth + gap);
      page.drawImage(item.image, {
        x: cellX + (cellWidth - item.width) / 2,
        y: imageBottom + (imageHeight - item.height),
        width: item.width,
        height: item.height,
      });
      drawCaption(
        ctx,
        page,
        item.lines,
        cellX + cellWidth / 2,
        imageBottom - 13,
      );
    });
    ctx.y -= rowHeight + 10;
    index += 2;
  }
}

function drawImageInBox(
  page: PDFPage,
  image: PDFImage | null,
  box: { x: number; top: number; maxWidth: number; maxHeight: number },
  align: 'left' | 'right',
) {
  if (!image) return;
  const scale = Math.min(
    box.maxWidth / image.width,
    box.maxHeight / image.height,
    1,
  );
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, {
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
  ctx.sectionLetter = letter;
  ctx.sectionTitle = name;
  ctx.subsection = null;
  ctx.pendingTab = null;
  const page = addPage(ctx, 'divider');
  ctx.contents.push({
    label: title,
    pageIndex: ctx.pages.length - 1,
    children: [],
  });

  page.drawRectangle({
    x: PAGE_W - 220,
    y: PAGE_H - 84,
    width: 220,
    height: 28,
    color: ctx.palette.brand,
  });
  if (ctx.ricsLogo) {
    drawImageInBox(
      page,
      ctx.ricsLogo,
      { x: RIGHT, top: PAGE_H - 100, maxWidth: 120, maxHeight: 44 },
      'right',
    );
    drawImageInBox(
      page,
      ctx.logo,
      { x: RIGHT, top: 110, maxWidth: 120, maxHeight: 40 },
      'right',
    );
  } else {
    drawImageInBox(
      page,
      ctx.logo,
      { x: RIGHT, top: PAGE_H - 100, maxWidth: 130, maxHeight: 44 },
      'right',
    );
  }

  const bold = ctx.fonts.bold;
  if (letter) {
    page.drawText(letter, {
      x: LEFT - 4,
      y: PAGE_H - 280,
      size: 120,
      font: bold,
      color: ctx.palette.brand,
    });
  }

  let baseline = PAGE_H - 352;
  for (const line of wrap(ctx, name, bold, 24, CONTENT_W)) {
    page.drawText(line, {
      x: LEFT,
      y: baseline,
      size: 24,
      font: bold,
      color: ctx.palette.brand,
    });
    baseline -= 28;
  }

  if (blurbHtml) {
    ctx.flowing = true;
    ctx.y = baseline - 4 + 11;
    ctx.style = { size: 11, leading: 15, color: ctx.palette.brand };
    drawTextItems(ctx, surveyHtmlToPdfItems(blurbHtml));
    ctx.style = {
      size: BODY_SIZE,
      leading: BODY_LEADING,
      color: ctx.palette.ink,
    };
  }
  ctx.flowing = false;
  ctx.pendingTab = { letter, title: name };
}

function drawCover(
  ctx: Ctx,
  input: SurveyReportPdfInput,
  hero: PDFImage | null,
) {
  const page = addPage(ctx, 'cover');
  const { palette, fonts } = ctx;

  page.drawRectangle({
    x: PAGE_W - 220,
    y: PAGE_H - 30,
    width: 220,
    height: 30,
    color: palette.brand,
  });
  drawImageInBox(
    page,
    ctx.logo,
    { x: 40, top: PAGE_H - 42, maxWidth: 160, maxHeight: 60 },
    'left',
  );
  drawImageInBox(
    page,
    ctx.ricsLogo,
    { x: RIGHT, top: PAGE_H - 46, maxWidth: 120, maxHeight: 44 },
    'right',
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
  page.drawText(clean(ctx, input.draft ? `${kicker}  ·  DRAFT` : kicker), {
    x: textLeft,
    y: baseline,
    size: 12,
    font: fonts.regular,
    color: palette.white,
  });
  baseline -= 34;

  for (const line of wrap(ctx, 'Your survey report', fonts.bold, 28, textMax)) {
    page.drawText(line, {
      x: textLeft,
      y: baseline,
      size: 28,
      font: fonts.bold,
      color: palette.white,
    });
    baseline -= 33;
  }
  baseline -= 12;

  const numeralSize = 140;
  const numeralTop = panel.y + 26 + numeralSize * 0.72;
  const fields: Array<[string, string | null | undefined]> = [
    ['Property address', input.propertyAddress || input.title],
    ["Client's name", input.clientName],
    ['Inspection date', input.inspectionDate],
    ["Surveyor's RICS number", input.surveyorRicsNumber],
    ['Prepared by', input.surveyorName || input.brandName],
  ];
  for (const [label, value] of fields) {
    if (!value?.trim()) continue;
    if (baseline < panel.y + 30) break;
    page.drawText(label, {
      x: textLeft,
      y: baseline,
      size: 9.5,
      font: fonts.bold,
      color: palette.white,
    });
    baseline -= 15;
    const width =
      input.surveyLevel && baseline < numeralTop + 12 ? textMax - 96 : textMax;
    for (const line of wrap(ctx, value, fonts.regular, 9.5, width).slice(
      0,
      3,
    )) {
      page.drawText(line, {
        x: textLeft,
        y: baseline,
        size: 9.5,
        font: fonts.regular,
        color: palette.white,
      });
      baseline -= 12.5;
    }
    baseline -= 9;
  }

  if (input.surveyLevel) {
    const numeral = String(input.surveyLevel);
    page.drawText(numeral, {
      x: PAGE_W - 30 - fonts.regular.widthOfTextAtSize(numeral, numeralSize),
      y: panel.y + 26,
      size: numeralSize,
      font: fonts.regular,
      color: palette.white,
    });
  }
}

function drawContentsPage(
  ctx: Ctx,
  page: PDFPage,
  entries: SectionEntry[],
  footnote: string | null,
) {
  const { palette, fonts } = ctx;
  page.drawText('Contents', {
    x: 92,
    y: PAGE_H - 150,
    size: 24,
    font: fonts.bold,
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
    const pageWidth = fonts.bold.widthOfTextAtSize(pageLabel, 10);
    const lines = wrap(
      ctx,
      entry.label,
      fonts.bold,
      10,
      tableRight - tableLeft - pageWidth - 16,
    );
    const rowHeight = lines.length * 13 + 9;
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: tableLeft,
        y: y - 15 - index * 13,
        size: 10,
        font: fonts.bold,
        color: palette.ink,
      });
    });
    page.drawText(pageLabel, {
      x: tableRight - pageWidth,
      y: y - 15 - (lines.length - 1) * 13,
      size: 10,
      font: fonts.bold,
      color: palette.ink,
    });
    const target = ctx.pages[entry.pageIndex]?.page;
    if (target) {
      addInternalLink(
        page,
        {
          x: tableLeft,
          y: y - rowHeight,
          width: tableRight - tableLeft,
          height: rowHeight,
        },
        target,
      );
    }
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
    for (const line of wrap(
      ctx,
      footnote,
      fonts.regular,
      8.5,
      PAGE_W - 92 * 2,
    )) {
      page.drawText(line, {
        x: 92,
        y: baseline,
        size: 8.5,
        font: fonts.regular,
        color: palette.ink,
      });
      baseline -= 11;
    }
  }
}

function drawBackToContents(ctx: Ctx, contentsPage: PDFPage | undefined) {
  if (!contentsPage) return;
  const { fonts, palette } = ctx;
  ctx.pages.forEach(({ page, kind }) => {
    if (kind !== 'divider') return;
    const label = 'Contents';
    const size = 9;
    const width = fonts.bold.widthOfTextAtSize(label, size);
    const x = RIGHT - width;
    const y = PAGE_H - 74;
    page.drawText(label, {
      x,
      y,
      size,
      font: fonts.bold,
      color: palette.white,
    });
    addInternalLink(
      page,
      { x: x - 6, y: y - 6, width: width + 12, height: size + 12 },
      contentsPage,
    );
  });
}

function drawFooters(
  ctx: Ctx,
  label: string,
  contentsPage: PDFPage | undefined,
  draft: boolean,
) {
  const { fonts, palette } = ctx;
  const text = clean(ctx, label);
  const size = 9;
  const labelWidth = fonts.regular.widthOfTextAtSize(text, size);
  ctx.pages.forEach(({ page, kind, marker }, index) => {
    if (kind === 'cover' || kind === 'divider') return;
    page.drawLine({
      start: { x: 0, y: 58 },
      end: { x: LEFT - 9, y: 58 },
      thickness: 0.9,
      color: palette.muted,
    });
    page.drawLine({
      start: { x: LEFT + 3, y: 57 },
      end: { x: PAGE_W, y: 57 },
      thickness: 0.6,
      color: palette.rule,
    });
    page.drawText(text, {
      x: LEFT + 3,
      y: 34,
      size,
      font: fonts.regular,
      color: palette.muted,
    });
    if (contentsPage && kind !== 'contents') {
      addInternalLink(
        page,
        { x: LEFT, y: 28, width: labelWidth + 6, height: size + 10 },
        contentsPage,
      );
    }
    let x = LEFT + 3 + labelWidth + 18;
    if (marker) {
      const markerText = clean(ctx, marker);
      const markerLine =
        wrap(ctx, markerText, fonts.bold, size, RIGHT - x - 80)[0] ?? '';
      page.drawText(markerLine, {
        x,
        y: 34,
        size,
        font: fonts.bold,
        color: palette.brand,
      });
      x += fonts.bold.widthOfTextAtSize(markerLine, size) + 14;
    }
    if (draft) {
      const draftWidth = fonts.bold.widthOfTextAtSize('DRAFT', 8);
      const draftX = RIGHT - 44 - draftWidth;
      page.drawRectangle({
        x: draftX - 5,
        y: 30,
        width: draftWidth + 10,
        height: 14,
        borderColor: palette.danger,
        borderWidth: 0.8,
      });
      page.drawText('DRAFT', {
        x: draftX,
        y: 34,
        size: 8,
        font: fonts.bold,
        color: palette.danger,
      });
    }
    const pageLabel = String(index + 1);
    page.drawText(pageLabel, {
      x: RIGHT - fonts.regular.widthOfTextAtSize(pageLabel, size),
      y: 34,
      size,
      font: fonts.regular,
      color: palette.muted,
    });
  });
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await task(items[index]!);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

async function resolveImages(
  doc: PDFDocument,
  blocks: SurveyReportBlock[],
  input: SurveyReportPdfInput,
): Promise<Map<string, PDFImage | null>> {
  const imageBlocks = blocks.filter(
    (block): block is ImageBlock => block.type === 'image',
  );
  const sources = await mapWithConcurrency(
    imageBlocks,
    IMAGE_CONCURRENCY,
    async (block): Promise<SurveyPdfImage | null> => {
      const key = block.documentId ?? block.src;
      const stored = key ? input.imageBytesById?.[key] : undefined;
      if (stored) return { bytes: stored, kind: detectImageKind(stored) };
      if (block.src && input.loadImage) return input.loadImage(block.src);
      return null;
    },
  );
  const images = new Map<string, PDFImage | null>();
  for (let index = 0; index < imageBlocks.length; index += 1) {
    const source = sources[index];
    images.set(
      imageBlocks[index]!.id,
      source ? await embedImage(doc, source) : null,
    );
  }
  return images;
}

async function embedFonts(
  doc: PDFDocument,
  fonts: SurveyPdfFonts | null | undefined,
): Promise<{ fonts: Record<FontStyle, PDFFont>; unicode: boolean }> {
  if (fonts) {
    try {
      doc.registerFontkit(fontkit);
      const [regular, bold, italic, boldItalic] = await Promise.all([
        doc.embedFont(fonts.regular, { subset: true }),
        doc.embedFont(fonts.bold, { subset: true }),
        doc.embedFont(fonts.italic, { subset: true }),
        doc.embedFont(fonts.boldItalic, { subset: true }),
      ]);
      return {
        fonts: { regular, bold, italic, boldItalic },
        unicode: true,
      };
    } catch {
      // Fall through to the standard fonts.
    }
  }
  const [regular, bold, italic, boldItalic] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.HelveticaOblique),
    doc.embedFont(StandardFonts.HelveticaBoldOblique),
  ]);
  return { fonts: { regular, bold, italic, boldItalic }, unicode: false };
}

function plainText(items: TextItem[]): string {
  return items
    .map((item) => (item.kind === 'para' ? item.text : ''))
    .join(' ')
    .trim();
}

/**
 * Renders a survey report in the RICS Home Survey layout: cover, linked
 * contents, lettered section dividers, element findings with condition-rating
 * badges, rating summary tables, a running footer with the section marker and
 * page numbers, and a bookmark outline.
 */
export async function buildSurveyReportPdf(
  input: SurveyReportPdfInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const embedded = await embedFonts(doc, input.fonts);
  const title = input.title || 'Survey report';
  doc.setTitle(embedded.unicode ? title : sanitizePdfText(title));
  if (input.brandName) {
    doc.setAuthor(
      embedded.unicode ? input.brandName : sanitizePdfText(input.brandName),
    );
  }

  const palette = buildPalette(input.brandColor);
  const assetEntries = await Promise.all(
    Object.entries(input.assets ?? {}).map(
      async ([key, image]) =>
        [key, image ? await embedImage(doc, image) : null] as const,
    ),
  );

  const ctx: Ctx = {
    doc,
    fonts: embedded.fonts,
    unicode: embedded.unicode,
    palette,
    logo: input.logo ? await embedImage(doc, input.logo) : null,
    ricsLogo: input.ricsLogo ? await embedImage(doc, input.ricsLogo) : null,
    assets: new Map(assetEntries),
    pages: [],
    page: null,
    flowing: false,
    y: 0,
    frame: { x: LEFT, width: CONTENT_W },
    style: { size: BODY_SIZE, leading: BODY_LEADING, color: palette.ink },
    pendingTab: null,
    sectionLetter: '',
    sectionTitle: null,
    subsection: null,
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
        plainText(flowItems(next.html.replace(/<ol\b[\s\S]*?<\/ol>/gi, ''))) ||
        null;
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

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!;

    if (block.type === 'heading') {
      const text = headingText(block);
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
        continue;
      }
      const label = text.replace(SECTION_PREFIX_RE, '');
      if (block.role === 'subsection') {
        startSubsection(ctx, label);
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
        label.toLowerCase() === ctx.sectionTitle?.toLowerCase() ||
        label.toLowerCase() === ctx.subsection?.toLowerCase()
      ) {
        continue;
      }
      drawSubsectionBar(ctx, label);
      continue;
    }

    if (block.type === 'text') {
      if (isRatingSummaryHtml(block.html)) {
        drawRatingSummary(ctx, blocks, block.html);
        continue;
      }
      const items = surveyHtmlToPdfItems(block.html);
      if (items.length === 0) continue;
      ensure(ctx, BODY_LEADING * 2);
      drawTextItems(ctx, items);
      ctx.y -= 6;
      continue;
    }

    if (block.type === 'image') {
      let end = index;
      while (blocks[end + 1]?.type === 'image') end += 1;
      drawImages(ctx, blocks.slice(index, end + 1) as ImageBlock[], images);
      index = end;
      continue;
    }

    drawRule(ctx);
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

  const contentsPage = contentsPages[0];
  drawBackToContents(ctx, contentsPage);
  drawFooters(
    ctx,
    input.reportLabel ||
      (input.brandName ? `${input.brandName} survey report` : 'Survey report'),
    contentsPage,
    Boolean(input.draft),
  );

  const outline: PdfOutlineEntry[] = [];
  if (contentsPage) outline.push({ title: 'Contents', page: contentsPage });
  for (const section of ctx.contents) {
    const page = ctx.pages[section.pageIndex]?.page;
    if (!page) continue;
    outline.push({
      title: section.label,
      page,
      children: section.children.flatMap((child) => {
        const childPage = ctx.pages[child.pageIndex]?.page;
        return childPage ? [{ title: child.label, page: childPage }] : [];
      }),
    });
  }
  buildOutline(doc, outline);

  return doc.save();
}
