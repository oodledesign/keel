import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib';

import { sanitizePdfText } from '~/lib/invoices/pdf-text';

import type { ExportTextTable } from './disposals-export';

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 28;
const PAD = 4;
const MAX_CELL_LINES = 8;

const INK = rgb(0.07, 0.07, 0.07);
const MUTED = rgb(0.38, 0.38, 0.4);
const HEADER_FILL = rgb(0.12, 0.16, 0.22);
const GROUP_FILL = rgb(0.9, 0.91, 0.92);
const ZEBRA_FILL = rgb(0.968, 0.968, 0.972);
const RULE = rgb(0.85, 0.85, 0.87);
const TONE_FILL = {
  new: rgb(0.863, 0.988, 0.906),
  changed: rgb(0.996, 0.953, 0.78),
  removed: rgb(0.953, 0.957, 0.965),
} as const;

function clean(value: string): string {
  return sanitizePdfText(value).replace(/[\t\r]/g, ' ');
}

/** Greedy word wrap that also splits words too long for the column. */
function wrap(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of clean(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ').filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (
          cut > 1 &&
          font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth
        ) {
          cut -= 1;
        }
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines.length ? lines : [''];
}

function limitLines(lines: string[]): string[] {
  if (lines.length <= MAX_CELL_LINES) return lines;
  const kept = lines.slice(0, MAX_CELL_LINES);
  kept[MAX_CELL_LINES - 1] =
    `${kept[MAX_CELL_LINES - 1]!.replace(/.{0,3}$/, '')}...`;
  return kept;
}

/** Landscape A4 table with a repeating header, group bands and page numbers. */
export async function buildExportPdf(
  table: ExportTextTable,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(table.title);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Many columns need smaller type to stay readable on one page width.
  const size =
    table.columns.length > 9 ? 6.5 : table.columns.length > 6 ? 7.5 : 8.5;
  const lineHeight = size * 1.28;
  const usable = PAGE_WIDTH - MARGIN * 2;
  const totalWeight =
    table.columns.reduce((sum, column) => sum + column.width, 0) || 1;
  const widths = table.columns.map(
    (column) => (column.width / totalWeight) * usable,
  );
  const offsets = widths.map((_, index) =>
    widths.slice(0, index).reduce((sum, width) => sum + width, MARGIN),
  );

  let page!: PDFPage;
  let y = 0;

  const drawCell = (
    lines: string[],
    index: number,
    top: number,
    font: PDFFont,
    color = INK,
  ) => {
    const align = table.columns[index]?.align ?? 'left';
    lines.forEach((line, lineIndex) => {
      const width = font.widthOfTextAtSize(line, size);
      const x =
        align === 'right'
          ? offsets[index]! + widths[index]! - PAD - width
          : offsets[index]! + PAD;
      page.drawText(line, {
        x,
        y: top - PAD - size - lineIndex * lineHeight,
        size,
        font,
        color,
      });
    });
  };

  const drawTableHeader = () => {
    const wrapped = table.columns.map((column, index) =>
      limitLines(wrap(column.label, bold, size, widths[index]! - PAD * 2)),
    );
    const height =
      Math.max(...wrapped.map((lines) => lines.length)) * lineHeight + PAD * 2;
    page.drawRectangle({
      x: MARGIN,
      y: y - height,
      width: usable,
      height,
      color: HEADER_FILL,
    });
    wrapped.forEach((lines, index) =>
      drawCell(lines, index, y, bold, rgb(1, 1, 1)),
    );
    y -= height;
  };

  const newPage = (first: boolean) => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    if (first) {
      page.drawText(clean(table.title), {
        x: MARGIN,
        y: y - 14,
        size: 15,
        font: bold,
        color: INK,
      });
      y -= 22;
      const meta = clean(
        `${table.filters.join('   |   ')}   |   ${table.rowCount} disposal${table.rowCount === 1 ? '' : 's'}`,
      );
      page.drawText(meta, {
        x: MARGIN,
        y: y - 8,
        size: 8,
        font: regular,
        color: MUTED,
      });
      y -= 20;
    }
    drawTableHeader();
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN + 14) newPage(false);
  };

  newPage(true);

  for (const group of table.groups) {
    if (group.label !== null) {
      const bandHeight = size + PAD * 2 + 2;
      // Keep the heading with at least its first row.
      ensureSpace(bandHeight + lineHeight + PAD * 2);
      page.drawRectangle({
        x: MARGIN,
        y: y - bandHeight,
        width: usable,
        height: bandHeight,
        color: GROUP_FILL,
      });
      const label = clean(group.label);
      page.drawText(label, {
        x: MARGIN + PAD,
        y: y - PAD - size,
        size,
        font: bold,
        color: INK,
      });
      page.drawText(String(group.rows.length), {
        x: MARGIN + PAD + bold.widthOfTextAtSize(label, size) + 6,
        y: y - PAD - size,
        size,
        font: regular,
        color: MUTED,
      });
      y -= bandHeight;
    }

    group.rows.forEach((row, rowIndex) => {
      const wrapped = row.map((cell, index) =>
        limitLines(wrap(cell, regular, size, widths[index]! - PAD * 2)),
      );
      const height =
        Math.max(...wrapped.map((lines) => lines.length)) * lineHeight +
        PAD * 2;
      ensureSpace(height);
      const tone = group.tones?.[rowIndex] ?? null;
      if (tone || rowIndex % 2 === 1) {
        page.drawRectangle({
          x: MARGIN,
          y: y - height,
          width: usable,
          height,
          color: tone ? TONE_FILL[tone] : ZEBRA_FILL,
        });
      }
      page.drawLine({
        start: { x: MARGIN, y: y - height },
        end: { x: MARGIN + usable, y: y - height },
        thickness: 0.4,
        color: RULE,
      });
      wrapped.forEach((lines, index) => drawCell(lines, index, y, regular));
      y -= height;
    });
  }

  const pages = doc.getPages();
  const stamp = clean(`Generated ${table.generatedAt}`);
  pages.forEach((p, index) => {
    p.drawText(stamp, {
      x: MARGIN,
      y: 14,
      size: 7,
      font: regular,
      color: MUTED,
    });
    const label = `Page ${index + 1} of ${pages.length}`;
    p.drawText(label, {
      x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(label, 7),
      y: 14,
      size: 7,
      font: regular,
      color: MUTED,
    });
  });

  return doc.save();
}
