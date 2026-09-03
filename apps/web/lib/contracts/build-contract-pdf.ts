import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  PDFString,
  StandardFonts,
  rgb,
} from 'pdf-lib';

import {
  type HtmlBlock,
  type HtmlTextRun,
  htmlToBlocks,
} from '~/lib/contracts/html-blocks';
import { sanitizePdfText } from '~/lib/invoices/pdf-text';

export type ContractPdfPaymentItem = { label: string; percent: number };

export type ContractForPdf = {
  id?: string | null;
  title: string;
  status: string;
  content_html: string;
  total_pence: number;
  currency: string;
  created_at?: string | null;
  updated_at?: string | null;
  payment_plan?: ContractPdfPaymentItem[];
  author_name?: string | null;
  author_company?: string | null;
  author_type?: string | null;
  author_signature_type?: string | null;
  author_signature_data?: string | null;
  author_signed_at?: string | null;
  recipient_name?: string | null;
  recipient_company?: string | null;
  recipient_type?: string | null;
  recipient_signature_type?: string | null;
  recipient_signature_data?: string | null;
  recipient_signed_at?: string | null;
  brand_name?: string | null;
  generated_at?: string | null;
  client?: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
    email?: string | null;
  } | null;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const FOOTER_RESERVE = 40;
const COLORS = {
  ink: rgb(0.12, 0.12, 0.14),
  muted: rgb(0.42, 0.42, 0.46),
  faint: rgb(0.62, 0.62, 0.66),
  line: rgb(0.88, 0.88, 0.9),
  tableHead: rgb(0.96, 0.96, 0.97),
  link: rgb(0.12, 0.35, 0.62),
  heading: rgb(0.1, 0.1, 0.12),
};

function formatPence(pence: number, currency = 'gbp'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(pence / 100);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function parseDataUrl(
  dataUrl: string,
): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(Buffer.from(match[2]!, 'base64'));
    return { mime: match[1]!, bytes };
  } catch {
    return null;
  }
}

type FontSet = {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
};

function fontForRun(fonts: FontSet, run: HtmlTextRun): PDFFont {
  if (run.bold && run.italic) return fonts.boldItalic;
  if (run.bold) return fonts.bold;
  if (run.italic) return fonts.italic;
  return fonts.regular;
}

function headingSize(level: number): number {
  if (level <= 1) return 16;
  if (level === 2) return 14;
  if (level === 3) return 12;
  return 11;
}

type DrawnPiece = {
  text: string;
  run: HtmlTextRun;
  width: number;
};

function wrapRuns(
  runs: HtmlTextRun[],
  fonts: FontSet,
  size: number,
  maxWidth: number,
): DrawnPiece[][] {
  const lines: DrawnPiece[][] = [];
  let line: DrawnPiece[] = [];
  let lineWidth = 0;

  const pushLine = () => {
    if (line.length === 0) {
      lines.push([]);
    } else {
      lines.push(line);
    }
    line = [];
    lineWidth = 0;
  };

  const appendPiece = (text: string, run: HtmlTextRun) => {
    const safe = sanitizePdfText(text);
    if (!safe) return;
    const font = fontForRun(fonts, run);
    let remaining = safe;
    while (remaining) {
      const width = font.widthOfTextAtSize(remaining, size);
      if (lineWidth + width <= maxWidth || line.length === 0) {
        if (line.length === 0 && width > maxWidth) {
          let chunk = '';
          for (const char of remaining) {
            const next = chunk + char;
            if (font.widthOfTextAtSize(next, size) > maxWidth && chunk) {
              line.push({
                text: chunk,
                run,
                width: font.widthOfTextAtSize(chunk, size),
              });
              pushLine();
              chunk = char;
            } else {
              chunk = next;
            }
          }
          if (chunk) {
            const w = font.widthOfTextAtSize(chunk, size);
            line.push({ text: chunk, run, width: w });
            lineWidth = w;
          }
          remaining = '';
          break;
        }
        line.push({ text: remaining, run, width });
        lineWidth += width;
        remaining = '';
        break;
      }
      pushLine();
    }
  };

  for (const run of runs) {
    const parts = run.text.split(/(\n)/);
    for (const part of parts) {
      if (part === '\n') {
        pushLine();
        continue;
      }
      const tokens = part.split(/(\s+)/);
      for (const token of tokens) {
        if (!token) continue;
        appendPiece(token, run);
      }
    }
  }

  if (line.length > 0) lines.push(line);
  return lines.length > 0 ? lines : [[]];
}

function addLinkAnnotation(
  page: PDFPage,
  box: { x: number; y: number; width: number; height: number },
  url: string,
) {
  const annot = page.doc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [box.x, box.y, box.x + box.width, box.y + box.height],
    Border: [0, 0, 0],
    A: {
      Type: 'Action',
      S: 'URI',
      URI: PDFString.of(url),
    },
  });
  page.node.addAnnot(page.doc.context.register(annot));
}

export function contractPdfFilename(title: string | null | undefined): string {
  const slug = (title?.trim() || 'agreement')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `contract-${slug || 'agreement'}.pdf`;
}

export async function buildContractPdf(
  contract: ContractForPdf,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts: FontSet = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
  };

  const generatedAt = contract.generated_at ?? new Date().toISOString();
  const title = contract.title?.trim() || 'Agreement';
  doc.setTitle(title);
  if (contract.brand_name) doc.setAuthor(contract.brand_name);
  doc.setSubject(`Contract ${contract.id ?? ''} · ${contract.status}`.trim());
  doc.setCreator('Ozer Contracts');
  try {
    doc.setCreationDate(new Date(generatedAt));
    doc.setModificationDate(new Date(contract.updated_at ?? generatedAt));
  } catch {
    /* ignore invalid dates */
  }

  const pages: PDFPage[] = [];
  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  const contentFloor = MARGIN + FOOTER_RESERVE;
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let y = PAGE_HEIGHT - MARGIN;

  const startPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed >= contentFloor) return;
    startPage();
  };

  const drawTextLine = (
    text: string,
    opts: { size: number; font: PDFFont; color?: ReturnType<typeof rgb> },
  ) => {
    const safe = sanitizePdfText(text);
    if (!safe) {
      y -= opts.size + 4;
      return;
    }
    ensureSpace(opts.size + 6);
    page.drawText(safe, {
      x: MARGIN,
      y,
      size: opts.size,
      font: opts.font,
      color: opts.color ?? COLORS.ink,
    });
    y -= opts.size + 4;
  };

  const drawRunLines = (
    runs: HtmlTextRun[],
    opts: { size: number; lineHeight: number; x?: number; width?: number },
  ) => {
    const x = opts.x ?? MARGIN;
    const width = opts.width ?? contentWidth;
    const lines = wrapRuns(runs, fonts, opts.size, width);
    for (const line of lines) {
      ensureSpace(opts.lineHeight);
      let cursorX = x;
      if (line.length === 0) {
        y -= opts.lineHeight * 0.6;
        continue;
      }
      for (const piece of line) {
        const font = fontForRun(fonts, piece.run);
        const color = piece.run.href ? COLORS.link : COLORS.ink;
        page.drawText(piece.text, {
          x: cursorX,
          y,
          size: opts.size,
          font,
          color,
        });
        if (piece.run.underline || piece.run.href) {
          page.drawLine({
            start: { x: cursorX, y: y - 1 },
            end: { x: cursorX + piece.width, y: y - 1 },
            thickness: 0.5,
            color,
          });
        }
        if (piece.run.href) {
          addLinkAnnotation(
            page,
            {
              x: cursorX,
              y: y - 2,
              width: Math.max(piece.width, 4),
              height: opts.size + 3,
            },
            piece.run.href,
          );
        }
        cursorX += piece.width;
      }
      y -= opts.lineHeight;
    }
  };

  const drawBlock = (block: HtmlBlock) => {
    if (block.type === 'spacer') {
      y -= 10;
      return;
    }
    if (block.type === 'heading') {
      y -= 8;
      drawRunLines(block.runs, {
        size: headingSize(block.level),
        lineHeight: headingSize(block.level) + 5,
      });
      y -= 4;
      return;
    }
    if (block.type === 'paragraph') {
      drawRunLines(block.runs, { size: 10, lineHeight: 14 });
      y -= 6;
      return;
    }
    if (block.type === 'list') {
      block.items.forEach((item, index) => {
        const marker = block.ordered ? `${index + 1}.` : '•';
        ensureSpace(16);
        page.drawText(sanitizePdfText(marker), {
          x: MARGIN,
          y,
          size: 10,
          font: fonts.regular,
          color: COLORS.ink,
        });
        drawRunLines(item, {
          size: 10,
          lineHeight: 14,
          x: MARGIN + 18,
          width: contentWidth - 18,
        });
        y -= 2;
      });
      y -= 4;
      return;
    }

    const colCount = Math.max(...block.rows.map((row) => row.length), 1);
    const colWidth = contentWidth / colCount;
    block.rows.forEach((row, rowIndex) => {
      const cellLines = row.map((cell) =>
        wrapRuns(cell, fonts, 9, Math.max(24, colWidth - 12)),
      );
      const rowHeight = Math.max(
        18,
        ...cellLines.map((lines) => Math.max(lines.length, 1) * 12 + 8),
      );
      ensureSpace(rowHeight);
      const rowBottom = y - rowHeight + 4;
      page.drawRectangle({
        x: MARGIN,
        y: rowBottom,
        width: contentWidth,
        height: rowHeight,
        borderColor: COLORS.line,
        borderWidth: 0.5,
        color: rowIndex === 0 ? COLORS.tableHead : undefined,
      });
      cellLines.forEach((lines, colIndex) => {
        let cellY = y - 10;
        const cellX = MARGIN + colIndex * colWidth + 6;
        for (const line of lines) {
          let cursorX = cellX;
          for (const piece of line) {
            page.drawText(piece.text, {
              x: cursorX,
              y: cellY,
              size: 9,
              font: fontForRun(fonts, piece.run),
              color: COLORS.ink,
            });
            cursorX += piece.width;
          }
          cellY -= 12;
        }
      });
      y -= rowHeight;
    });
    y -= 8;
  };

  if (contract.brand_name) {
    drawTextLine(contract.brand_name, {
      size: 11,
      font: fonts.bold,
      color: COLORS.muted,
    });
  }
  drawTextLine(title, { size: 18, font: fonts.bold });

  const meta: string[] = [
    `Status: ${contract.status.replace(/_/g, ' ')}`,
    `Total: ${formatPence(contract.total_pence, contract.currency)}`,
  ];
  if (contract.id) meta.push(`Contract ID: ${contract.id}`);
  meta.push(`Generated: ${formatDateTime(generatedAt)}`);
  if (contract.created_at)
    meta.push(`Created: ${formatDate(contract.created_at)}`);
  drawTextLine(meta.join('  ·  '), {
    size: 8,
    font: fonts.regular,
    color: COLORS.muted,
  });
  y -= 6;

  if (contract.client) {
    drawTextLine('Client', { size: 11, font: fonts.bold });
    const name =
      contract.client.display_name ??
      ([contract.client.first_name, contract.client.last_name]
        .filter(Boolean)
        .join(' ') ||
        '—');
    drawTextLine(name, { size: 10, font: fonts.regular });
    if (contract.client.company_name) {
      drawTextLine(contract.client.company_name, {
        size: 10,
        font: fonts.regular,
      });
    }
    if (contract.client.email) {
      drawTextLine(contract.client.email, { size: 10, font: fonts.regular });
    }
    y -= 6;
  }

  drawTextLine('Agreement', { size: 12, font: fonts.bold });
  y -= 2;

  const bodyBlocks = htmlToBlocks(contract.content_html || '');
  if (bodyBlocks.length === 0) {
    drawTextLine('No agreement text.', {
      size: 10,
      font: fonts.italic,
      color: COLORS.muted,
    });
  } else {
    for (const block of bodyBlocks) drawBlock(block);
  }

  if ((contract.payment_plan?.length ?? 0) > 0) {
    y -= 6;
    drawTextLine('Payment plan', { size: 12, font: fonts.bold });
    for (const item of contract.payment_plan ?? []) {
      const amount = formatPence(
        Math.round((contract.total_pence * item.percent) / 100),
        contract.currency,
      );
      drawTextLine(`${item.label}: ${item.percent}% (${amount})`, {
        size: 10,
        font: fonts.regular,
      });
    }
  }

  const signatureNeeded = 150;
  ensureSpace(signatureNeeded);
  y -= 12;
  page.drawLine({
    start: { x: MARGIN, y: y + 8 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + 8 },
    thickness: 0.6,
    color: COLORS.line,
  });
  drawTextLine('Signatures', { size: 12, font: fonts.bold });

  const columnWidth = (contentWidth - 20) / 2;
  const signatureTop = y;

  const drawSignatureBlock = async (params: {
    x: number;
    label: string;
    name?: string | null;
    company?: string | null;
    signatureType?: string | null;
    signatureData?: string | null;
    signedAt?: string | null;
  }): Promise<number> => {
    let cursorY = signatureTop;
    page.drawText(sanitizePdfText(params.label), {
      x: params.x,
      y: cursorY,
      size: 11,
      font: fonts.bold,
      color: COLORS.ink,
    });
    cursorY -= 16;
    if (params.name) {
      page.drawText(sanitizePdfText(params.name), {
        x: params.x,
        y: cursorY,
        size: 10,
        font: fonts.regular,
        color: COLORS.ink,
      });
      cursorY -= 13;
    }
    if (params.company) {
      page.drawText(sanitizePdfText(params.company), {
        x: params.x,
        y: cursorY,
        size: 9,
        font: fonts.regular,
        color: COLORS.muted,
      });
      cursorY -= 13;
    }

    if (params.signatureType === 'typed' && params.signatureData) {
      page.drawText(sanitizePdfText(params.signatureData), {
        x: params.x,
        y: cursorY,
        size: 14,
        font: fonts.italic,
        color: rgb(0.05, 0.05, 0.35),
      });
      cursorY -= 22;
    } else if (
      params.signatureData &&
      (params.signatureType === 'drawn' || params.signatureType === 'uploaded')
    ) {
      const parsed = parseDataUrl(params.signatureData);
      if (parsed?.mime.includes('png')) {
        try {
          const image = await doc.embedPng(parsed.bytes);
          const maxWidth = columnWidth;
          const maxHeight = 48;
          const scale = Math.min(
            1,
            maxWidth / image.width,
            maxHeight / image.height,
          );
          const height = image.height * scale;
          const width = image.width * scale;
          page.drawImage(image, {
            x: params.x,
            y: cursorY - height,
            width,
            height,
          });
          cursorY -= height + 8;
        } catch {
          page.drawText('[Signature image]', {
            x: params.x,
            y: cursorY,
            size: 9,
            font: fonts.regular,
            color: COLORS.muted,
          });
          cursorY -= 14;
        }
      } else {
        page.drawText('[Signature on file]', {
          x: params.x,
          y: cursorY,
          size: 9,
          font: fonts.regular,
          color: COLORS.muted,
        });
        cursorY -= 14;
      }
    } else {
      page.drawText('Not yet signed', {
        x: params.x,
        y: cursorY,
        size: 9,
        font: fonts.italic,
        color: COLORS.muted,
      });
      cursorY -= 14;
    }

    page.drawText(
      sanitizePdfText(`Signed: ${formatDateTime(params.signedAt ?? null)}`),
      {
        x: params.x,
        y: cursorY,
        size: 8,
        font: fonts.regular,
        color: COLORS.muted,
      },
    );
    cursorY -= 12;
    return cursorY;
  };

  const authorBottom = await drawSignatureBlock({
    x: MARGIN,
    label: 'Author signature',
    name: contract.author_name,
    company: contract.author_company,
    signatureType: contract.author_signature_type,
    signatureData: contract.author_signature_data,
    signedAt: contract.author_signed_at,
  });

  const recipientBottom = await drawSignatureBlock({
    x: MARGIN + columnWidth + 20,
    label: 'Recipient signature',
    name: contract.recipient_name ?? contract.client?.display_name,
    company: contract.recipient_company ?? contract.client?.company_name,
    signatureType: contract.recipient_signature_type,
    signatureData: contract.recipient_signature_data,
    signedAt: contract.recipient_signed_at,
  });

  y = Math.min(authorBottom, recipientBottom, y);

  const pageCount = pages.length;
  const idLabel = contract.id ? `ID ${contract.id}` : 'Unsigned draft';
  pages.forEach((target, index) => {
    const label = `${idLabel}  ·  ${contract.status.replace(/_/g, ' ')}  ·  Page ${index + 1} of ${pageCount}`;
    const safe = sanitizePdfText(label);
    const width = fonts.regular.widthOfTextAtSize(safe, 8);
    target.drawText(safe, {
      x: (PAGE_WIDTH - width) / 2,
      y: 28,
      size: 8,
      font: fonts.regular,
      color: COLORS.faint,
    });
  });

  return doc.save();
}
