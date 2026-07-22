import 'server-only';

import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib';

import { sanitizePdfText } from '~/lib/invoices/pdf-text';

import type { SeoReportSnapshot } from './types';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;

const COLORS = {
  ink: rgb(0.08, 0.1, 0.14),
  muted: rgb(0.4, 0.43, 0.48),
  line: rgb(0.88, 0.89, 0.91),
  card: rgb(0.97, 0.97, 0.98),
  accent: rgb(0.34, 0.78, 0.5),
};

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const safe = sanitizePdfText(text);
  const words = safe.replace(/\s+/g, ' ').trim().split(' ');
  if (!words.length || (words.length === 1 && words[0] === '')) return [''];

  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = COLORS.ink,
) {
  page.drawText(sanitizePdfText(text), { x, y, size, font, color });
}

export async function buildSeoReportPdf(params: {
  snapshot: SeoReportSnapshot;
  brandName?: string | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const brand = sanitizePdfText(params.brandName?.trim() || 'SEO Report');
  drawText(page, brand, MARGIN, y, 10, font, COLORS.muted);
  y -= 28;

  drawText(page, 'SEO Report', MARGIN, y, 26, fontBold, COLORS.ink);
  y -= 22;
  drawText(
    page,
    params.snapshot.targetDomain,
    MARGIN,
    y,
    12,
    font,
    COLORS.muted,
  );
  y -= 16;
  drawText(
    page,
    new Date(params.snapshot.generatedAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    MARGIN,
    y,
    10,
    font,
    COLORS.muted,
  );
  y -= 28;

  ensureSpace(50);
  drawText(page, 'Overall score', MARGIN, y, 10, fontBold, COLORS.muted);
  y -= 22;
  drawText(
    page,
    `${params.snapshot.overallScore ?? '—'}/100`,
    MARGIN,
    y,
    28,
    fontBold,
    COLORS.ink,
  );
  y -= 28;

  if (params.snapshot.executiveSummary) {
    ensureSpace(80);
    drawText(page, 'Summary', MARGIN, y, 12, fontBold, COLORS.ink);
    y -= 16;
    const summaryLines = wrapText(
      params.snapshot.executiveSummary,
      font,
      10,
      PAGE_WIDTH - MARGIN * 2,
    );
    for (const line of summaryLines) {
      ensureSpace(14);
      drawText(page, line, MARGIN, y, 10, font, COLORS.ink);
      y -= 14;
    }
    y -= 12;
  }

  ensureSpace(40);
  drawText(page, 'Pillar scores', MARGIN, y, 12, fontBold, COLORS.ink);
  y -= 18;

  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  const colWidth = contentWidth / 2 - 6;

  for (let i = 0; i < params.snapshot.pillars.length; i += 2) {
    ensureSpace(52);
    const left = params.snapshot.pillars[i]!;
    const right = params.snapshot.pillars[i + 1];

    const drawCard = (
      card: (typeof params.snapshot.pillars)[number],
      x: number,
    ) => {
      page.drawRectangle({
        x,
        y: y - 36,
        width: colWidth,
        height: 44,
        color: COLORS.card,
        borderColor: COLORS.line,
        borderWidth: 0.5,
      });
      drawText(page, card.label, x + 10, y - 14, 8, font, COLORS.muted);
      const scoreLabel = card.available
        ? `${card.score ?? '—'}/100`
        : 'Not yet run';
      drawText(page, scoreLabel, x + 10, y - 30, 14, fontBold, COLORS.ink);
    };

    drawCard(left, MARGIN);
    if (right) drawCard(right, MARGIN + colWidth + 12);
    y -= 56;
  }

  if (params.snapshot.recommendations.length > 0) {
    y -= 8;
    ensureSpace(30);
    drawText(page, 'Top recommendations', MARGIN, y, 12, fontBold, COLORS.ink);
    y -= 18;

    for (const rec of params.snapshot.recommendations) {
      const titleLines = wrapText(
        `${rec.priority.toUpperCase()} · ${rec.title}`,
        fontBold,
        10,
        contentWidth,
      );
      const bodyLines = wrapText(rec.description, font, 9, contentWidth);
      ensureSpace(titleLines.length * 13 + bodyLines.length * 12 + 20);

      for (const line of titleLines) {
        drawText(page, line, MARGIN, y, 10, fontBold, COLORS.ink);
        y -= 13;
      }
      for (const line of bodyLines) {
        drawText(page, line, MARGIN, y, 9, font, COLORS.muted);
        y -= 12;
      }
      if (rec.outcome) {
        const outcomeLines = wrapText(
          `Outcome: ${rec.outcome}`,
          font,
          9,
          contentWidth,
        );
        for (const line of outcomeLines) {
          ensureSpace(12);
          drawText(page, line, MARGIN, y, 9, font, COLORS.accent);
          y -= 12;
        }
      }
      y -= 10;
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 0.5,
        color: COLORS.line,
      });
      y -= 14;
    }
  }

  ensureSpace(40);
  drawText(
    page,
    'Generated with Rankly',
    MARGIN,
    MARGIN - 8,
    8,
    font,
    COLORS.muted,
  );

  return doc.save();
}
