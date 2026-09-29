import 'server-only';

import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib';

import {
  isSafeHttpUrl,
  parseSurveyReportDocument,
} from '~/lib/building-surveyor/survey-report-document';
import {
  type SurveyPdfFonts,
  type SurveyPdfImage,
  buildSurveyReportPdf,
} from '~/lib/building-surveyor/survey-report-pdf';
import { sanitizePdfText } from '~/lib/invoices/pdf-text';

type ProposalForPdf = {
  title: string;
  status: string;
  content_html: string;
  kind?: string | null;
  body_document?: unknown;
  total_pence?: number | null;
  currency?: string | null;
  expires_at?: string | null;
  recipient_name?: string | null;
  brand_name?: string | null;
  brand_logo_url?: string | null;
  brand_primary_color?: string | null;
  survey_level?: 2 | 3 | null;
  survey_report_label?: string | null;
  survey_property_address?: string | null;
  report_date?: string | null;
  inspection_date?: string | null;
  surveyor_name?: string | null;
  surveyor_rics_number?: string | null;
  draft?: boolean;
  survey_fonts?: SurveyPdfFonts | null;
  rics_logo?: SurveyPdfImage | null;
  survey_assets?: Record<string, SurveyPdfImage | null>;
  imageBytesById?: Record<string, Uint8Array>;
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

async function fetchLogoBytes(
  url: string,
): Promise<{ bytes: Uint8Array; kind: 'png' | 'jpg' } | null> {
  return fetchImageBytes(url);
}

export async function fetchImageBytes(
  url: string,
): Promise<{ bytes: Uint8Array; kind: 'png' | 'jpg' } | null> {
  if (!isSafeHttpUrl(url)) return null;
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

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const safeText = sanitizePdfText(text);
  const paragraphs = safeText.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.replace(/\s+/g, ' ').trim().split(' ');
    if (words.length === 0 || (words.length === 1 && words[0] === '')) {
      lines.push('');
      continue;
    }

    let line = '';
    for (const word of words) {
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
        const next = chunk + char;
        if (font.widthOfTextAtSize(next, size) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk = next;
        }
      }
      line = chunk;
    }
    if (line) lines.push(line);
  }

  return lines;
}

type PdfWriter = {
  doc: PDFDocument;
  font: PDFFont;
  fontBold: PDFFont;
  page: PDFPage;
  width: number;
  height: number;
  margin: number;
  y: number;
};

function ensureSpace(writer: PdfWriter, needed: number) {
  if (writer.y - needed >= writer.margin + 36) return;
  writer.page = writer.doc.addPage([595, 842]);
  writer.width = writer.page.getSize().width;
  writer.height = writer.page.getSize().height;
  writer.y = writer.height - writer.margin;
}

function drawLines(
  writer: PdfWriter,
  lines: string[],
  size: number,
  font: PDFFont,
  gap = 13,
) {
  const maxWidth = writer.width - writer.margin * 2;
  for (const line of lines) {
    if (!line) {
      writer.y -= 8;
      continue;
    }
    const wrapped = wrapText(line, font, size, maxWidth);
    for (const part of wrapped) {
      ensureSpace(writer, gap + 4);
      writer.page.drawText(part, {
        x: writer.margin,
        y: writer.y,
        size,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });
      writer.y -= gap;
    }
  }
}

export async function buildProposalPdf(
  proposal: ProposalForPdf,
): Promise<Uint8Array> {
  const recipientName =
    proposal.recipient_name?.trim() ||
    proposal.client?.display_name?.trim() ||
    [proposal.client?.first_name, proposal.client?.last_name]
      .filter(Boolean)
      .join(' ') ||
    null;

  const surveyDocument =
    proposal.kind === 'survey_report'
      ? parseSurveyReportDocument(proposal.body_document)
      : null;

  if (surveyDocument && surveyDocument.blocks.length > 0) {
    return buildSurveyReportPdf({
      title: proposal.title,
      document: surveyDocument,
      imageBytesById: proposal.imageBytesById,
      loadImage: fetchImageBytes,
      logo: proposal.brand_logo_url
        ? await fetchImageBytes(proposal.brand_logo_url)
        : null,
      brandName: proposal.brand_name,
      brandColor: proposal.brand_primary_color,
      propertyAddress: proposal.survey_property_address,
      clientName: recipientName,
      reportDate: proposal.report_date
        ? formatDate(proposal.report_date)
        : null,
      inspectionDate: proposal.inspection_date,
      surveyorName: proposal.surveyor_name,
      surveyorRicsNumber: proposal.surveyor_rics_number,
      surveyLevel: proposal.survey_level,
      reportLabel: proposal.survey_report_label,
      fonts: proposal.survey_fonts,
      ricsLogo: proposal.rics_logo,
      assets: proposal.survey_assets,
      draft: proposal.draft ?? proposal.status === 'draft',
    });
  }

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const first = doc.addPage([595, 842]);
  const { width, height } = first.getSize();
  const margin = 50;
  const writer: PdfWriter = {
    doc,
    font,
    fontBold,
    page: first,
    width,
    height,
    margin,
    y: height - margin,
  };

  if (proposal.brand_logo_url) {
    const logo = await fetchLogoBytes(proposal.brand_logo_url);
    if (logo) {
      const image =
        logo.kind === 'png'
          ? await doc.embedPng(logo.bytes)
          : await doc.embedJpg(logo.bytes);
      const maxWidth = 120;
      const maxHeight = 48;
      const scale = Math.min(
        maxWidth / image.width,
        maxHeight / image.height,
        1,
      );
      const logoWidth = image.width * scale;
      const logoHeight = image.height * scale;
      writer.page.drawImage(image, {
        x: width - margin - logoWidth,
        y: writer.y - logoHeight + 8,
        width: logoWidth,
        height: logoHeight,
      });
    }
  }

  const isSurvey = proposal.kind === 'survey_report';
  const title =
    proposal.title?.trim() || (isSurvey ? 'Building survey' : 'Proposal');
  drawLines(
    writer,
    wrapText(title, fontBold, 20, width - margin * 2 - 130),
    20,
    fontBold,
    24,
  );

  if (proposal.brand_name) {
    drawLines(writer, [proposal.brand_name], 11, font, 16);
  }

  drawLines(writer, [`Status: ${proposal.status}`], 10, font, 14);

  if (proposal.total_pence != null) {
    drawLines(
      writer,
      [
        `Total: ${formatPence(proposal.total_pence, proposal.currency ?? 'gbp')}`,
      ],
      10,
      font,
      14,
    );
  }

  if (!isSurvey) {
    drawLines(
      writer,
      [`Expires: ${formatDate(proposal.expires_at)}`],
      10,
      font,
      16,
    );
  } else {
    writer.y -= 8;
  }

  if (recipientName) {
    drawLines(writer, ['Prepared for'], 11, fontBold, 14);
    drawLines(writer, [recipientName], 10, font, 13);
    if (proposal.client?.company_name) {
      drawLines(writer, [proposal.client.company_name], 10, font, 13);
    }
    if (proposal.client?.email) {
      drawLines(writer, [proposal.client.email], 10, font, 13);
    }
    writer.y -= 8;
  }

  drawLines(
    writer,
    [
      isSurvey
        ? proposal.brand_name
          ? `${proposal.brand_name} building survey report`
          : 'Building survey report'
        : 'Proposal',
    ],
    12,
    fontBold,
    18,
  );

  const bodyText = htmlToPlainText(proposal.content_html);
  drawLines(writer, bodyText.split('\n'), 10, font, 13);

  if (isSurvey && proposal.brand_name) {
    writer.y -= 10;
    drawLines(writer, [`Prepared by ${proposal.brand_name}`], 9, font, 12);
  }

  return doc.save();
}
