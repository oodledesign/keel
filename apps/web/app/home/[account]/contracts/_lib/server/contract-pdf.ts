import 'server-only';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type ContractForPdf = {
  title: string;
  status: string;
  content_html: string;
  total_pence: number;
  currency: string;
  payment_plan?: Array<{ label: string; percent: number }>;
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
  client?: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
    email?: string | null;
  } | null;
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

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

async function drawSignatureBlock(params: {
  doc: PDFDocument;
  page: ReturnType<PDFDocument['addPage']>;
  x: number;
  y: number;
  width: number;
  label: string;
  name?: string | null;
  company?: string | null;
  signatureType?: string | null;
  signatureData?: string | null;
  signedAt?: string | null;
  font: Awaited<ReturnType<PDFDocument['embedFont']>>;
  fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>;
}): Promise<number> {
  let cursorY = params.y;
  const lineHeight = 12;

  params.page.drawText(params.label, {
    x: params.x,
    y: cursorY,
    size: 11,
    font: params.fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  cursorY -= lineHeight + 4;

  if (params.name) {
    params.page.drawText(params.name, {
      x: params.x,
      y: cursorY,
      size: 10,
      font: params.font,
      color: rgb(0.15, 0.15, 0.15),
    });
    cursorY -= lineHeight;
  }

  if (params.company) {
    params.page.drawText(params.company, {
      x: params.x,
      y: cursorY,
      size: 9,
      font: params.font,
      color: rgb(0.2, 0.2, 0.2),
    });
    cursorY -= lineHeight;
  }

  if (params.signatureType === 'typed' && params.signatureData) {
    params.page.drawText(params.signatureData, {
      x: params.x,
      y: cursorY,
      size: 14,
      font: params.font,
      color: rgb(0.05, 0.05, 0.35),
    });
    cursorY -= 24;
  } else if (
    params.signatureData &&
    (params.signatureType === 'drawn' || params.signatureType === 'uploaded')
  ) {
    const parsed = parseDataUrl(params.signatureData);
    if (parsed?.mime.includes('png')) {
      try {
        const image = await params.doc.embedPng(parsed.bytes);
        const maxWidth = params.width;
        const scale = Math.min(1, maxWidth / image.width);
        const height = image.height * scale;
        params.page.drawImage(image, {
          x: params.x,
          y: cursorY - height,
          width: image.width * scale,
          height,
        });
        cursorY -= height + 8;
      } catch {
        params.page.drawText('[Signature image]', {
          x: params.x,
          y: cursorY,
          size: 9,
          font: params.font,
          color: rgb(0.3, 0.3, 0.3),
        });
        cursorY -= lineHeight;
      }
    } else {
      params.page.drawText('[Signature on file]', {
        x: params.x,
        y: cursorY,
        size: 9,
        font: params.font,
        color: rgb(0.3, 0.3, 0.3),
      });
      cursorY -= lineHeight;
    }
  }

  params.page.drawText(`Signed: ${formatDate(params.signedAt ?? null)}`, {
    x: params.x,
    y: cursorY,
    size: 9,
    font: params.font,
    color: rgb(0.35, 0.35, 0.35),
  });
  cursorY -= lineHeight + 8;

  return cursorY;
}

function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }

    const words = paragraph.split(/\s+/);
    let current = '';

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }

    if (current) lines.push(current);
  }

  return lines;
}

export async function buildContractPdf(
  contract: ContractForPdf,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const drawLine = (text: string, size = 10, bold = false) => {
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= size + 4;
  };

  if (contract.brand_name) {
    drawLine(contract.brand_name, 14, true);
    y -= 4;
  }

  drawLine(contract.title, 18, true);
  drawLine(`Status: ${contract.status}`, 10);
  drawLine(
    `Total: ${formatPence(contract.total_pence, contract.currency)}`,
    10,
  );
  y -= 8;

  if (contract.client) {
    drawLine('Client', 12, true);
    const name =
      contract.client.display_name ??
      ([contract.client.first_name, contract.client.last_name]
        .filter(Boolean)
        .join(' ') ||
        '—');
    drawLine(name, 10);
    if (contract.client.company_name)
      drawLine(contract.client.company_name, 10);
    if (contract.client.email) drawLine(contract.client.email, 10);
    y -= 8;
  }

  drawLine('Agreement', 12, true);
  y -= 4;

  const bodyText = htmlToPlainText(contract.content_html || '');
  for (const line of wrapText(bodyText, 90)) {
    if (y < 220) break;
    if (!line) {
      y -= 8;
      continue;
    }
    page.drawText(line.slice(0, 100), {
      x: margin,
      y,
      size: 9,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= 11;
  }

  if ((contract.payment_plan?.length ?? 0) > 0) {
    y -= 8;
    drawLine('Payment plan', 12, true);
    for (const item of contract.payment_plan ?? []) {
      if (y < 220) break;
      drawLine(`${item.label}: ${item.percent}%`, 9);
    }
  }

  y = Math.min(y, 210);
  const columnWidth = (width - margin * 2 - 20) / 2;

  const authorBottom = await drawSignatureBlock({
    doc,
    page,
    x: margin,
    y,
    width: columnWidth,
    label: 'Author signature',
    name: contract.author_name,
    company: contract.author_company,
    signatureType: contract.author_signature_type,
    signatureData: contract.author_signature_data,
    signedAt: contract.author_signed_at,
    font,
    fontBold,
  });

  await drawSignatureBlock({
    doc,
    page,
    x: margin + columnWidth + 20,
    y,
    width: columnWidth,
    label: 'Recipient signature',
    name: contract.recipient_name ?? contract.client?.display_name,
    company: contract.recipient_company ?? contract.client?.company_name,
    signatureType: contract.recipient_signature_type,
    signatureData: contract.recipient_signature_data,
    signedAt: contract.recipient_signed_at,
    font,
    fontBold,
  });

  void authorBottom;

  return doc.save();
}
