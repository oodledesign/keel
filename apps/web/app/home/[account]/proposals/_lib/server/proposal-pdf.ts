import 'server-only';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type ProposalForPdf = {
  title: string;
  status: string;
  content_html: string;
  total_pence?: number | null;
  currency?: string | null;
  expires_at?: string | null;
  recipient_name?: string | null;
  brand_name?: string | null;
  brand_logo_url?: string | null;
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

/** Strip HTML tags and preserve basic block structure as plain text lines. */
export function htmlToPlainText(html: string): string {
  if (!html.trim()) return '';

  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  text = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

async function fetchLogoBytes(url: string): Promise<{ bytes: Uint8Array; kind: 'png' | 'jpg' } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? '';
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (contentType.includes('png') || url.toLowerCase().endsWith('.png')) {
      return { bytes, kind: 'png' };
    }
    if (
      contentType.includes('jpeg') ||
      contentType.includes('jpg') ||
      url.toLowerCase().match(/\.jpe?g$/)
    ) {
      return { bytes, kind: 'jpg' };
    }
    return null;
  } catch {
    return null;
  }
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

export async function buildProposalPdf(proposal: ProposalForPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  if (proposal.brand_logo_url) {
    const logo = await fetchLogoBytes(proposal.brand_logo_url);
    if (logo) {
      const image =
        logo.kind === 'png'
          ? await doc.embedPng(logo.bytes)
          : await doc.embedJpg(logo.bytes);
      const maxWidth = 120;
      const maxHeight = 48;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const logoWidth = image.width * scale;
      const logoHeight = image.height * scale;
      page.drawImage(image, {
        x: width - margin - logoWidth,
        y: y - logoHeight + 8,
        width: logoWidth,
        height: logoHeight,
      });
    }
  }

  const title = proposal.title?.trim() || 'Proposal';
  page.drawText(title, {
    x: margin,
    y,
    size: 20,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 28;

  if (proposal.brand_name) {
    page.drawText(proposal.brand_name, {
      x: margin,
      y,
      size: 11,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 16;
  }

  page.drawText(`Status: ${proposal.status}`, {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 14;

  if (proposal.total_pence != null) {
    page.drawText(
      `Total: ${formatPence(proposal.total_pence, proposal.currency ?? 'gbp')}`,
      { x: margin, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) },
    );
    y -= 14;
  }

  page.drawText(`Expires: ${formatDate(proposal.expires_at)}`, {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 20;

  const recipientName =
    proposal.recipient_name?.trim() ||
    proposal.client?.display_name?.trim() ||
    [proposal.client?.first_name, proposal.client?.last_name].filter(Boolean).join(' ') ||
    null;

  if (recipientName) {
    page.drawText('Prepared for', {
      x: margin,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= 14;
    page.drawText(recipientName, {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= 12;
    if (proposal.client?.company_name) {
      page.drawText(proposal.client.company_name, {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });
      y -= 12;
    }
    if (proposal.client?.email) {
      page.drawText(proposal.client.email, {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });
      y -= 12;
    }
    y -= 8;
  }

  page.drawText('Proposal', {
    x: margin,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 16;

  const bodyText = htmlToPlainText(proposal.content_html);
  const lines = wrapText(bodyText, 90);

  for (const line of lines) {
    if (y < margin + 40) break;
    if (!line) {
      y -= 8;
      continue;
    }
    page.drawText(line.slice(0, 120), {
      x: margin,
      y,
      size: 9,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= 12;
  }

  return doc.save();
}
