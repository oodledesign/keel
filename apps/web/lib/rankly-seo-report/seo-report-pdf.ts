import 'server-only';

import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib';

import { sanitizePdfText } from '~/lib/invoices/pdf-text';

import {
  CRAWL_ISSUE_PLAIN,
  buildClientHeadline,
  buildClientNextSteps,
  enrichPillarForClient,
  scoreBand,
  scoreBandLabel,
} from './client-copy';
import type { SeoReportSnapshot } from './types';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;

const COLORS = {
  ink: rgb(0.08, 0.1, 0.14),
  muted: rgb(0.4, 0.43, 0.48),
  line: rgb(0.88, 0.89, 0.91),
  card: rgb(0.97, 0.97, 0.98),
  accent: rgb(0.05, 0.45, 0.35),
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
  const contentWidth = PAGE_WIDTH - MARGIN * 2;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const writeParagraph = (
    text: string,
    size: number,
    useFont: PDFFont,
    color = COLORS.ink,
    gapAfter = 8,
  ) => {
    const lines = wrapText(text, useFont, size, contentWidth);
    for (const line of lines) {
      ensureSpace(size + 4);
      drawText(page, line, MARGIN, y, size, useFont, color);
      y -= size + 4;
    }
    y -= gapAfter;
  };

  const headline =
    params.snapshot.clientHeadline?.trim() ||
    buildClientHeadline(params.snapshot);
  const storedSteps = params.snapshot.nextSteps ?? [];
  const nextSteps =
    storedSteps.length > 0
      ? storedSteps
      : buildClientNextSteps(params.snapshot);
  const pillars = params.snapshot.pillars.map(enrichPillarForClient);

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
  y -= 18;
  drawText(
    page,
    scoreBandLabel(scoreBand(params.snapshot.overallScore)),
    MARGIN,
    y,
    10,
    font,
    COLORS.muted,
  );
  y -= 20;

  writeParagraph(
    'Scores are out of 100. Higher is better. Rough guide: 75+ is in good shape, 50-74 has room to improve, below 50 needs attention.',
    9,
    font,
    COLORS.muted,
    10,
  );

  writeParagraph(headline, 11, font, COLORS.ink, 10);

  if (
    params.snapshot.executiveSummary &&
    params.snapshot.executiveSummary.trim() !== headline.trim()
  ) {
    writeParagraph(params.snapshot.executiveSummary, 10, font, COLORS.muted, 12);
  }

  if (nextSteps.length > 0) {
    ensureSpace(30);
    drawText(page, 'What to do next', MARGIN, y, 12, fontBold, COLORS.ink);
    y -= 16;
    nextSteps.forEach((step, index) => {
      writeParagraph(`${index + 1}. ${step}`, 10, font, COLORS.ink, 6);
    });
    y -= 6;
  }

  ensureSpace(30);
  drawText(page, 'How your site scores', MARGIN, y, 12, fontBold, COLORS.ink);
  y -= 14;
  writeParagraph(
    'Each score is one part of how customers find you in Google and AI answers.',
    9,
    font,
    COLORS.muted,
    10,
  );

  for (const pillar of pillars) {
    const scoreLabel = pillar.available
      ? `${pillar.score ?? '—'}/100 · ${pillar.bandLabel}`
      : 'Not measured yet';
    const body = [
      pillar.whatItMeans,
      `Why it matters: ${pillar.whyItMatters}`,
      pillar.scoreExplainer,
    ].join(' ');
    const bodyLines = wrapText(body, font, 9, contentWidth);
    ensureSpace(28 + bodyLines.length * 12);

    page.drawRectangle({
      x: MARGIN,
      y: y - (18 + bodyLines.length * 12),
      width: contentWidth,
      height: 26 + bodyLines.length * 12,
      color: COLORS.card,
      borderColor: COLORS.line,
      borderWidth: 0.5,
    });
    drawText(page, pillar.label, MARGIN + 10, y - 12, 9, fontBold, COLORS.ink);
    drawText(
      page,
      scoreLabel,
      MARGIN + 10,
      y - 24,
      10,
      fontBold,
      COLORS.ink,
    );
    y -= 34;
    for (const line of bodyLines) {
      drawText(page, line, MARGIN + 10, y, 9, font, COLORS.muted);
      y -= 12;
    }
    y -= 14;
  }

  if (params.snapshot.recommendations.length > 0) {
    ensureSpace(30);
    drawText(page, 'Recommended actions', MARGIN, y, 12, fontBold, COLORS.ink);
    y -= 14;
    writeParagraph(
      'Practical fixes, ordered by impact. Start at the top.',
      9,
      font,
      COLORS.muted,
      8,
    );

    for (const rec of params.snapshot.recommendations) {
      const titleLines = wrapText(
        `${rec.priority.toUpperCase()} PRIORITY · ${rec.title}`,
        fontBold,
        10,
        contentWidth,
      );
      const bodyLines = wrapText(rec.description, font, 9, contentWidth);
      const outcomeLines = rec.outcome
        ? wrapText(`If you fix this: ${rec.outcome}`, font, 9, contentWidth)
        : [];
      ensureSpace(
        titleLines.length * 13 + bodyLines.length * 12 + outcomeLines.length * 12 + 20,
      );

      for (const line of titleLines) {
        drawText(page, line, MARGIN, y, 10, fontBold, COLORS.ink);
        y -= 13;
      }
      for (const line of bodyLines) {
        drawText(page, line, MARGIN, y, 9, font, COLORS.muted);
        y -= 12;
      }
      for (const line of outcomeLines) {
        drawText(page, line, MARGIN, y, 9, font, COLORS.accent);
        y -= 12;
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

  if (params.snapshot.appendix.crawlIssues.length > 0) {
    ensureSpace(40);
    drawText(
      page,
      'Common technical issues found',
      MARGIN,
      y,
      12,
      fontBold,
      COLORS.ink,
    );
    y -= 14;
    writeParagraph(
      'How many pages have each problem — the main reasons Technical SEO may be low.',
      9,
      font,
      COLORS.muted,
      8,
    );
    for (const issue of params.snapshot.appendix.crawlIssues) {
      const label =
        issue.label ||
        CRAWL_ISSUE_PLAIN[issue.code] ||
        issue.code.replace(/_/g, ' ');
      writeParagraph(
        `${label}: ${issue.count} page${issue.count === 1 ? '' : 's'}`,
        10,
        font,
        COLORS.ink,
        4,
      );
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
