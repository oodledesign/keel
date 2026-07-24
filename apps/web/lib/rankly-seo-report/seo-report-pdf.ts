import 'server-only';

import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  type RGB,
  PDFString,
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
import {
  buildOverallPotential,
  buildPillarPotentials,
  scoreTone,
} from './report-visuals';
import type { SeoReportSnapshot } from './types';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 44;
/** Breathing room between major report sections */
const SECTION_GAP = 22;
/** Space between cards in a row / stack */
const CARD_GAP = 10;

const COLORS = {
  ink: rgb(0.15, 0.09, 0.12),
  muted: rgb(0.42, 0.36, 0.39),
  line: rgb(0.88, 0.84, 0.8),
  card: rgb(0.99, 0.97, 0.94),
  cream: rgb(0.984, 0.965, 0.925),
  plum: rgb(0.208, 0.118, 0.157),
  plumSoft: rgb(0.3, 0.18, 0.22),
  coral: rgb(1, 0.361, 0.204),
  coralSoft: rgb(1, 0.92, 0.88),
  white: rgb(1, 1, 1),
  potential: rgb(0.12, 0.55, 0.48),
  potentialSoft: rgb(0.88, 0.96, 0.94),
  track: rgb(0.91, 0.88, 0.85),
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

function pdfRgb(tone: { r: number; g: number; b: number }): RGB {
  return rgb(tone.r, tone.g, tone.b);
}

function drawRoundedCard(
  page: PDFPage,
  x: number,
  yBottom: number,
  width: number,
  height: number,
  fill: RGB,
  border?: RGB,
) {
  page.drawRectangle({
    x,
    y: yBottom,
    width,
    height,
    color: fill,
    borderColor: border,
    borderWidth: border ? 0.8 : 0,
  });
}

function drawBar(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  fillRatio: number,
  fill: RGB,
  track = COLORS.track,
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: track,
  });
  const filled = Math.max(0, Math.min(1, fillRatio)) * width;
  if (filled > 0) {
    page.drawRectangle({
      x,
      y,
      width: filled,
      height,
      color: fill,
    });
  }
}

function drawLegendDot(
  page: PDFPage,
  x: number,
  y: number,
  color: RGB,
  label: string,
  font: PDFFont,
) {
  page.drawCircle({ x: x + 4, y: y + 3, size: 4, color });
  drawText(page, label, x + 12, y, 8, font, COLORS.muted);
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
    if (y - needed < MARGIN + 16) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      // Soft cream page wash
      page.drawRectangle({
        x: 0,
        y: 0,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        color: COLORS.cream,
      });
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const writeParagraph = (
    text: string,
    size: number,
    useFont: PDFFont,
    color = COLORS.ink,
    gapAfter = 8,
    indent = 0,
  ) => {
    const lines = wrapText(text, useFont, size, contentWidth - indent);
    for (const line of lines) {
      ensureSpace(size + 4);
      drawText(page, line, MARGIN + indent, y, size, useFont, color);
      y -= size + 4;
    }
    y -= gapAfter;
  };

  // First page cream background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: COLORS.cream,
  });

  const headline =
    params.snapshot.clientHeadline?.trim() ||
    buildClientHeadline(params.snapshot);
  const storedSteps = params.snapshot.nextSteps ?? [];
  const nextSteps =
    storedSteps.length > 0
      ? storedSteps
      : buildClientNextSteps(params.snapshot);
  const pillars = params.snapshot.pillars.map(enrichPillarForClient);
  const pillarPotentials = buildPillarPotentials(params.snapshot);
  const overall = buildOverallPotential(params.snapshot, pillarPotentials);
  const overallTone = scoreTone(overall.current);

  // ——— Hero band ———
  const heroHeight = 118;
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - heroHeight,
    width: PAGE_WIDTH,
    height: heroHeight,
    color: COLORS.plum,
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - heroHeight,
    width: 6,
    height: heroHeight,
    color: COLORS.coral,
  });

  const brand = sanitizePdfText(params.brandName?.trim() || 'Rankly');
  drawText(page, brand, MARGIN, PAGE_HEIGHT - 28, 10, fontBold, COLORS.coral);
  drawText(
    page,
    'SEO + AI Search Report',
    MARGIN,
    PAGE_HEIGHT - 52,
    26,
    fontBold,
    COLORS.white,
  );
  drawText(
    page,
    params.snapshot.targetDomain,
    MARGIN,
    PAGE_HEIGHT - 72,
    11,
    font,
    rgb(0.85, 0.78, 0.8),
  );
  drawText(
    page,
    new Date(params.snapshot.generatedAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    MARGIN,
    PAGE_HEIGHT - 88,
    9,
    font,
    rgb(0.72, 0.64, 0.67),
  );

  // Score chip on hero
  const scoreBoxX = PAGE_WIDTH - MARGIN - 110;
  page.drawRectangle({
    x: scoreBoxX,
    y: PAGE_HEIGHT - 98,
    width: 110,
    height: 64,
    color: COLORS.plumSoft,
  });
  drawText(
    page,
    'TODAY',
    scoreBoxX + 10,
    PAGE_HEIGHT - 48,
    8,
    fontBold,
    COLORS.coral,
  );
  drawText(
    page,
    `${overall.current ?? '—'}`,
    scoreBoxX + 10,
    PAGE_HEIGHT - 74,
    28,
    fontBold,
    COLORS.white,
  );
  drawText(
    page,
    '/100',
    scoreBoxX +
      10 +
      fontBold.widthOfTextAtSize(`${overall.current ?? '—'}`, 28) +
      4,
    PAGE_HEIGHT - 68,
    10,
    font,
    rgb(0.75, 0.68, 0.7),
  );

  y = PAGE_HEIGHT - heroHeight - 24;

  // ——— Current vs potential card ———
  const compareCardH = overall.uplift && overall.uplift > 0 ? 118 : 92;
  ensureSpace(compareCardH + 10);
  drawRoundedCard(
    page,
    MARGIN,
    y - compareCardH,
    contentWidth,
    compareCardH,
    COLORS.white,
    COLORS.line,
  );

  drawText(
    page,
    'Where you are vs where you could be',
    MARGIN + 14,
    y - 18,
    11,
    fontBold,
    COLORS.ink,
  );
  drawText(
    page,
    scoreBandLabel(scoreBand(overall.current)),
    MARGIN + 14,
    y - 32,
    9,
    font,
    COLORS.muted,
  );

  const barX = MARGIN + 14;
  const barW = contentWidth - 140;
  const barH = 10;

  drawText(page, 'Today', barX, y - 50, 8, fontBold, COLORS.muted);
  drawBar(
    page,
    barX + 48,
    y - 52,
    barW,
    barH,
    (overall.current ?? 0) / 100,
    pdfRgb(overallTone.pdf),
  );
  drawText(
    page,
    `${overall.current ?? '—'}/100`,
    barX + 48 + barW + 8,
    y - 50,
    9,
    fontBold,
    pdfRgb(overallTone.pdf),
  );

  if (overall.potential != null) {
    drawText(page, 'With fixes', barX, y - 72, 8, fontBold, COLORS.muted);
    drawBar(
      page,
      barX + 48,
      y - 74,
      barW,
      barH,
      overall.potential / 100,
      COLORS.potential,
      COLORS.potentialSoft,
    );
    drawText(
      page,
      `${overall.potential}/100`,
      barX + 48 + barW + 8,
      y - 72,
      9,
      fontBold,
      COLORS.potential,
    );
  }

  if (overall.uplift && overall.uplift > 0) {
    page.drawRectangle({
      x: MARGIN + 14,
      y: y - compareCardH + 12,
      width: 150,
      height: 18,
      color: COLORS.potentialSoft,
    });
    drawText(
      page,
      `+${overall.uplift} points possible`,
      MARGIN + 20,
      y - compareCardH + 17,
      9,
      fontBold,
      COLORS.potential,
    );
    drawText(
      page,
      'Estimate if recommended actions are completed.',
      MARGIN + 170,
      y - compareCardH + 17,
      8,
      font,
      COLORS.muted,
    );
  }

  y -= compareCardH + SECTION_GAP;

  writeParagraph(headline, 11, font, COLORS.ink, 6);

  if (
    params.snapshot.executiveSummary &&
    params.snapshot.executiveSummary.trim() !== headline.trim()
  ) {
    writeParagraph(params.snapshot.executiveSummary, 9, font, COLORS.muted, 8);
  }

  if (nextSteps.length > 0) {
    y -= 6;
    ensureSpace(36);
    drawText(page, 'What to do next', MARGIN, y, 12, fontBold, COLORS.ink);
    y -= 16;
    nextSteps.forEach((step, index) => {
      ensureSpace(28);
      page.drawCircle({
        x: MARGIN + 7,
        y: y + 2,
        size: 7,
        color: COLORS.coral,
      });
      drawText(
        page,
        `${index + 1}`,
        MARGIN + 4.5,
        y - 1,
        8,
        fontBold,
        COLORS.white,
      );
      writeParagraph(step, 9, font, COLORS.ink, 8, 20);
    });
    y -= SECTION_GAP - 8;
  } else {
    y -= SECTION_GAP;
  }

  // ——— Pillar score chart (2 columns) ———
  ensureSpace(40);
  drawText(page, 'How your site scores', MARGIN, y, 12, fontBold, COLORS.ink);
  y -= 14;
  writeParagraph(
    "Each bar shows today's score and the estimated score after recommended fixes.",
    8,
    font,
    COLORS.muted,
    4,
  );

  drawLegendDot(page, MARGIN, y, pdfRgb(overallTone.pdf), 'Today', font);
  drawLegendDot(page, MARGIN + 70, y, COLORS.potential, 'With fixes', font);
  y -= 18;

  const colGap = CARD_GAP;
  const colWidth = (contentWidth - colGap) / 2;
  const cardPad = 10;
  const textWidth = colWidth - cardPad * 2 - 4;

  type PillarCardLayout = {
    pillar: (typeof pillars)[number];
    pot: ReturnType<typeof buildPillarPotentials>[number] | undefined;
    bodyLines: string[];
    height: number;
  };

  const pillarLayouts: PillarCardLayout[] = pillars.map((pillar) => {
    const pot = pillarPotentials.find((p) => p.id === pillar.id);
    const body = `${pillar.whatItMeans} Why it matters: ${pillar.whyItMatters}`;
    let bodyLines = wrapText(body, font, 7.5, textWidth);
    const maxBodyLines = 5;
    if (bodyLines.length > maxBodyLines) {
      bodyLines = bodyLines.slice(0, maxBodyLines);
      const last = bodyLines[maxBodyLines - 1]!;
      bodyLines[maxBodyLines - 1] =
        last.length > 3 ? `${last.slice(0, Math.max(0, last.length - 1))}…` : '…';
    }
    const hasUplift =
      pillar.available &&
      pot?.current != null &&
      pot.potential != null &&
      (pot.uplift ?? 0) > 0;
    const barsH = pillar.available ? (hasUplift ? 28 : 16) : 14;
    const height = 18 + barsH + 8 + bodyLines.length * 9.5 + 12;
    return { pillar, pot, bodyLines, height };
  });

  const drawPillarCard = (
    layout: PillarCardLayout,
    x: number,
    topY: number,
    height: number,
  ) => {
    const { pillar, pot, bodyLines } = layout;
    const tone = scoreTone(pillar.available ? pillar.score : null);
    const bottom = topY - height;

    drawRoundedCard(page, x, bottom, colWidth, height, COLORS.white, COLORS.line);
    page.drawRectangle({
      x,
      y: bottom,
      width: 3.5,
      height,
      color: pdfRgb(tone.pdf),
    });

    const labelX = x + cardPad;
    drawText(page, pillar.label, labelX, topY - 13, 8, fontBold, COLORS.ink);
    const band = pillar.available ? pillar.bandLabel : 'Not measured';
    drawText(page, band, labelX, topY - 24, 7, font, COLORS.muted);

    const pBarX = labelX;
    const pBarW = colWidth - cardPad * 2 - 28;
    let barY = topY - 38;

    if (pillar.available && pot?.current != null) {
      drawBar(
        page,
        pBarX,
        barY,
        pBarW,
        6,
        pot.current / 100,
        pdfRgb(tone.pdf),
      );
      drawText(
        page,
        `${pot.current}`,
        pBarX + pBarW + 4,
        barY,
        8,
        fontBold,
        pdfRgb(tone.pdf),
      );
      barY -= 12;

      if (pot.potential != null && pot.uplift && pot.uplift > 0) {
        drawBar(
          page,
          pBarX,
          barY,
          pBarW,
          6,
          pot.potential / 100,
          COLORS.potential,
          COLORS.potentialSoft,
        );
        drawText(
          page,
          `+${pot.uplift}`,
          pBarX + pBarW + 4,
          barY,
          7,
          fontBold,
          COLORS.potential,
        );
        barY -= 10;
      }
    } else {
      drawText(page, '—', pBarX, barY, 9, font, COLORS.muted);
      barY -= 12;
    }

    let ty = barY - 4;
    for (const line of bodyLines) {
      drawText(page, line, labelX, ty, 7.5, font, COLORS.muted);
      ty -= 9.5;
    }
  };

  for (let i = 0; i < pillarLayouts.length; i += 2) {
    const left = pillarLayouts[i]!;
    const right = pillarLayouts[i + 1];
    const rowHeight = Math.max(left.height, right?.height ?? 0);

    ensureSpace(rowHeight + CARD_GAP);
    drawPillarCard(left, MARGIN, y, rowHeight);
    if (right) {
      drawPillarCard(right, MARGIN + colWidth + colGap, y, rowHeight);
    }
    y -= rowHeight + CARD_GAP;
  }

  y -= SECTION_GAP - CARD_GAP;

  if (params.snapshot.recommendations.length > 0) {
    ensureSpace(30);
    drawText(page, 'Recommended actions', MARGIN, y, 12, fontBold, COLORS.ink);
    y -= 14;
    writeParagraph(
      'Practical fixes, ordered by impact. Start at the top.',
      8,
      font,
      COLORS.muted,
      10,
    );

    for (const rec of params.snapshot.recommendations) {
      const titleLines = wrapText(rec.title, fontBold, 10, contentWidth - 24);
      const bodyLines = wrapText(rec.description, font, 8, contentWidth - 24);
      const outcomeLines = rec.outcome
        ? wrapText(
            `If you fix this: ${rec.outcome}`,
            font,
            8,
            contentWidth - 24,
          )
        : [];
      const blockH =
        28 +
        titleLines.length * 12 +
        bodyLines.length * 10 +
        outcomeLines.length * 10 +
        10;
      ensureSpace(blockH + CARD_GAP);

      drawRoundedCard(
        page,
        MARGIN,
        y - blockH,
        contentWidth,
        blockH,
        COLORS.white,
        COLORS.line,
      );

      const priorityColor =
        rec.priority === 'high'
          ? rgb(0.85, 0.22, 0.28)
          : rec.priority === 'medium'
            ? rgb(0.85, 0.55, 0.08)
            : rgb(0.45, 0.45, 0.48);
      const priorityBg =
        rec.priority === 'high'
          ? rgb(1, 0.92, 0.92)
          : rec.priority === 'medium'
            ? rgb(1, 0.95, 0.88)
            : rgb(0.94, 0.94, 0.95);

      const badgeLabel = `${rec.priority.toUpperCase()} PRIORITY`;
      const badgeW = fontBold.widthOfTextAtSize(badgeLabel, 7) + 12;
      page.drawRectangle({
        x: MARGIN + 12,
        y: y - 22,
        width: badgeW,
        height: 14,
        color: priorityBg,
      });
      drawText(
        page,
        badgeLabel,
        MARGIN + 18,
        y - 18,
        7,
        fontBold,
        priorityColor,
      );

      if (rec.isQuickWin) {
        const qwX = MARGIN + 18 + badgeW;
        page.drawRectangle({
          x: qwX,
          y: y - 22,
          width: 58,
          height: 14,
          color: COLORS.coralSoft,
        });
        drawText(page, 'QUICK WIN', qwX + 6, y - 18, 7, fontBold, COLORS.coral);
      }

      let ty = y - 36;
      for (const line of titleLines) {
        drawText(page, line, MARGIN + 12, ty, 10, fontBold, COLORS.ink);
        ty -= 12;
      }
      for (const line of bodyLines) {
        drawText(page, line, MARGIN + 12, ty, 8, font, COLORS.muted);
        ty -= 10;
      }
      for (const line of outcomeLines) {
        drawText(page, line, MARGIN + 12, ty, 8, font, COLORS.potential);
        ty -= 10;
      }
      y -= blockH + CARD_GAP;
    }
    y -= SECTION_GAP - CARD_GAP;
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
      8,
      font,
      COLORS.muted,
      10,
    );

    const maxCount = Math.max(
      ...params.snapshot.appendix.crawlIssues.map((i) => i.count),
      1,
    );

    for (const issue of params.snapshot.appendix.crawlIssues) {
      const label =
        issue.label ||
        CRAWL_ISSUE_PLAIN[issue.code] ||
        issue.code.replace(/_/g, ' ');
      const labelLines = wrapText(label, font, 8, contentWidth - 80);
      ensureSpace(22 + labelLines.length * 10);

      let ty = y;
      for (const line of labelLines) {
        drawText(page, line, MARGIN, ty, 8, font, COLORS.ink);
        ty -= 10;
      }
      drawBar(
        page,
        MARGIN,
        ty - 4,
        contentWidth - 48,
        6,
        issue.count / maxCount,
        COLORS.coral,
        COLORS.coralSoft,
      );
      drawText(
        page,
        `${issue.count}`,
        MARGIN + contentWidth - 40,
        ty - 4,
        8,
        fontBold,
        COLORS.coral,
      );
      y = ty - 20;
    }
  }

  ensureSpace(24);
  const footerY = MARGIN - 4;
  const prepared = 'Prepared with Rankly by Ozer';
  const disclaimer =
    '  ·  Potential scores are estimates based on recommended actions';
  drawText(page, prepared, MARGIN, footerY, 7, font, COLORS.muted);
  const preparedWidth = font.widthOfTextAtSize(prepared, 7);
  drawText(
    page,
    disclaimer,
    MARGIN + preparedWidth,
    footerY,
    7,
    font,
    COLORS.muted,
  );

  // Clickable “Ozer” → homepage
  const ozerLabel = 'Ozer';
  const ozerWidth = font.widthOfTextAtSize(ozerLabel, 7);
  const ozerX =
    MARGIN + font.widthOfTextAtSize('Prepared with Rankly by ', 7);
  const link = doc.context.register(
    doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [ozerX, footerY - 2, ozerX + ozerWidth, footerY + 9],
      Border: [0, 0, 0],
      C: [1, 0.36, 0.2],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of('https://ozer.so'),
      },
    }),
  );
  page.node.addAnnot(link);

  return doc.save();
}
