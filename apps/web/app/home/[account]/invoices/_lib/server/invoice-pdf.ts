import 'server-only';

import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFPage,
  rgb,
} from 'pdf-lib';

export type InvoiceForPdf = {
  invoice_number: string;
  status: string;
  due_at: string | null;
  issued_at?: string | null;
  title?: string | null;
  reference_number?: string | null;
  total_pence: number;
  subtotal_pence?: number;
  discount_pence?: number;
  tax_pence?: number;
  late_fee_pence?: number;
  deposit_due_pence?: number;
  currency: string;
  notes: string | null;
  footer_message?: string | null;
  brand_name?: string | null;
  logo_url?: string | null;
  payment_url?: string | null;
  sender_name?: string | null;
  sender_email?: string | null;
  business_email?: string | null;
  business_phone?: string | null;
  business_website?: string | null;
  show_reference?: boolean;
  show_due_date?: boolean;
  show_issued_date?: boolean;
  show_notes?: boolean;
  show_footer?: boolean;
  show_logo?: boolean;
  show_payment_link?: boolean;
  items: Array<{
    description: string;
    quantity: number;
    unit_price_pence: number;
    total_pence: number;
  }>;
  client: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
    email?: string | null;
    address_line_1?: string | null;
    address_line_2?: string | null;
    city?: string | null;
    postcode?: string | null;
    country?: string | null;
  } | null;
  bank?: {
    bank_account_name?: string | null;
    bank_sort_code?: string | null;
    bank_account_number?: string | null;
    bank_iban?: string | null;
    bank_bic?: string | null;
    bank_transfer_instructions?: string | null;
  } | null;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;

const COLORS = {
  ink: rgb(0.12, 0.12, 0.14),
  muted: rgb(0.42, 0.42, 0.46),
  faint: rgb(0.62, 0.62, 0.66),
  line: rgb(0.88, 0.88, 0.9),
  tableHead: rgb(0.96, 0.96, 0.97),
  link: rgb(0.12, 0.35, 0.62),
  draft: rgb(0.72, 0.45, 0.18),
};

function formatAmount(pence: number): string {
  return (pence / 100).toFixed(2);
}

function formatMoneyLabel(pence: number, currency: string): string {
  return `${currency.toUpperCase()} ${formatAmount(pence)}`;
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  if (words.length === 0 || (words.length === 1 && words[0] === '')) {
    return [''];
  }

  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) {
      lines.push(line);
    }

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

  if (line) {
    lines.push(line);
  }

  return lines.length > 0 ? lines : [''];
}

const ALLOWED_LOGO_HOSTS = [
  process.env['NEXT_PUBLIC_SUPABASE_URL']
    ? new URL(process.env['NEXT_PUBLIC_SUPABASE_URL']).hostname
    : null,
].filter(Boolean) as string[];

function isAllowedLogoUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_LOGO_HOSTS.some((h) => hostname === h);
  } catch {
    return false;
  }
}

async function embedLogo(doc: PDFDocument, logoUrl: string | null | undefined) {
  if (!logoUrl) return null;
  if (!isAllowedLogoUrl(logoUrl)) return null;
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('png') || logoUrl.toLowerCase().includes('.png')) {
      return doc.embedPng(bytes);
    }
    return doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

function drawRightText(
  page: PDFPage,
  text: string,
  xRight: number,
  y: number,
  size: number,
  font: PDFFont,
  color = COLORS.ink,
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xRight - width, y, size, font, color });
}

function drawLines(
  page: PDFPage,
  lines: string[],
  x: number,
  startY: number,
  size: number,
  font: PDFFont,
  lineHeight: number,
  color = COLORS.ink,
) {
  let y = startY;
  for (const line of lines) {
    page.drawText(line, { x, y, size, font, color });
    y -= lineHeight;
  }
  return y;
}

function drawRightLines(
  page: PDFPage,
  lines: string[],
  xRight: number,
  startY: number,
  size: number,
  font: PDFFont,
  lineHeight: number,
  color = COLORS.ink,
) {
  let y = startY;
  for (const line of lines) {
    drawRightText(page, line, xRight, y, size, font, color);
    y -= lineHeight;
  }
  return y;
}

function drawPayButton(
  page: PDFPage,
  label: string,
  x: number,
  y: number,
  width: number,
  fontBold: PDFFont,
) {
  const height = 28;
  page.drawRectangle({
    x,
    y: y - height + 6,
    width,
    height,
    color: COLORS.link,
  });
  const textWidth = fontBold.widthOfTextAtSize(label, 10);
  page.drawText(label, {
    x: x + (width - textWidth) / 2,
    y: y - height + 14,
    size: 10,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  return height + 8;
}

export async function buildInvoicePdf(
  invoice: InvoiceForPdf,
): Promise<Uint8Array> {
  const showDueDate = invoice.show_due_date !== false;
  const showIssuedDate = invoice.show_issued_date !== false;
  const showNotes = invoice.show_notes !== false;
  const showFooter = invoice.show_footer !== false;
  const showLogo = invoice.show_logo !== false;
  const showPaymentLink = invoice.show_payment_link !== false;
  const currency = (invoice.currency || 'GBP').toUpperCase();
  const reference = invoice.reference_number?.trim() || invoice.invoice_number;
  const tableWidth = PAGE_WIDTH - MARGIN * 2;
  const columnGap = 24;
  const columnWidth = (tableWidth - columnGap) / 2;
  const rightColumnRight = PAGE_WIDTH - MARGIN;
  const rightColumnX = MARGIN + columnWidth + columnGap;

  const businessLines = [
    invoice.brand_name?.trim() || null,
    invoice.business_email?.trim() || null,
    invoice.business_phone?.trim() || null,
    invoice.business_website?.trim() || null,
  ].filter(Boolean) as string[];

  const paymentFeeNote =
    showFooter && showPaymentLink && invoice.payment_url
      ? (
          invoice.footer_message?.trim() ||
          'Paying online by card (Stripe payment link) may incur a small processing fee.'
        )
      : null;

  const thankYouMessage = showFooter ? 'Thank you for your business.' : null;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const bankDetailLines =
    invoice.bank?.bank_account_number || invoice.bank?.bank_iban
      ? (
          [
            invoice.bank.bank_account_name
              ? `Account name: ${invoice.bank.bank_account_name}`
              : null,
            invoice.bank.bank_sort_code
              ? `Sort code: ${invoice.bank.bank_sort_code}`
              : null,
            invoice.bank.bank_account_number
              ? `Account number: ${invoice.bank.bank_account_number}`
              : null,
            invoice.bank.bank_iban ? `IBAN: ${invoice.bank.bank_iban}` : null,
            invoice.bank.bank_bic ? `BIC: ${invoice.bank.bank_bic}` : null,
            `Reference: ${reference}`,
            invoice.bank.bank_transfer_instructions,
          ].filter(Boolean) as string[]
        ).flatMap((line) => wrapText(line, font, 9, columnWidth))
      : [];

  const paymentLinkLines =
    showPaymentLink && invoice.payment_url
      ? wrapText(invoice.payment_url, font, 8, columnWidth)
      : [];

  const paymentFeeLines = paymentFeeNote
    ? wrapText(paymentFeeNote, font, 8, columnWidth)
    : [];

  let paymentBlockHeight = 0;
  if (paymentLinkLines.length > 0) {
    paymentBlockHeight = Math.max(
      paymentBlockHeight,
      36 +
        paymentLinkLines.length * 11 +
        (paymentFeeLines.length > 0 ? 6 + paymentFeeLines.length * 10 : 0),
    );
  }
  if (bankDetailLines.length > 0) {
    paymentBlockHeight = Math.max(
      paymentBlockHeight,
      14 + bankDetailLines.length * 12,
    );
  }

  let minContentY = 28 + 14;
  if (thankYouMessage) {
    minContentY += 18;
  }
  minContentY += paymentBlockHeight + 16;
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const logo = showLogo ? await embedLogo(doc, invoice.logo_url) : null;
  const headerTop = PAGE_HEIGHT - MARGIN;
  const logoMaxW = 120;
  const logoMaxH = 56;

  let logoBottom = headerTop - logoMaxH;
  if (logo) {
    const scale = Math.min(logoMaxW / logo.width, logoMaxH / logo.height);
    const w = logo.width * scale;
    const h = logo.height * scale;
    logoBottom = headerTop - h;
    page.drawImage(logo, {
      x: PAGE_WIDTH - MARGIN - w,
      y: logoBottom,
      width: w,
      height: h,
    });
  }

  page.drawText('INVOICE', {
    x: MARGIN,
    y: headerTop - 32,
    size: 28,
    font: fontBold,
    color: COLORS.ink,
  });

  if (invoice.status === 'draft') {
    page.drawText('DRAFT', {
      x: MARGIN,
      y: headerTop - 50,
      size: 10,
      font: fontBold,
      color: COLORS.draft,
    });
  }

  const metaRight = PAGE_WIDTH - MARGIN;
  let metaY = logoBottom - 20;
  drawRightText(
    page,
    `Invoice # ${invoice.invoice_number}`,
    metaRight,
    metaY,
    10,
    fontBold,
    COLORS.ink,
  );
  metaY -= 16;

  if (showIssuedDate) {
    drawRightText(
      page,
      `Issued ${formatDateShort(invoice.issued_at)}`,
      metaRight,
      metaY,
      10,
      font,
      COLORS.muted,
    );
    metaY -= 14;
  }

  if (showDueDate) {
    drawRightText(
      page,
      `Due ${formatDateShort(invoice.due_at)}`,
      metaRight,
      metaY,
      10,
      font,
      COLORS.muted,
    );
    metaY -= 14;
  }

  const headerBottom = Math.min(headerTop - 58, metaY);
  const partyRowY = headerBottom - 48;

  page.drawText('From:', {
    x: MARGIN,
    y: partyRowY,
    size: 10,
    font: fontBold,
    color: COLORS.muted,
  });
  drawRightText(
    page,
    'Billed to:',
    rightColumnRight,
    partyRowY,
    10,
    fontBold,
    COLORS.muted,
  );

  let leftPartyY = partyRowY - 18;
  if (businessLines.length > 0) {
    leftPartyY = drawLines(
      page,
      businessLines,
      MARGIN,
      leftPartyY,
      10,
      font,
      14,
      COLORS.ink,
    );
  }

  const clientLines: string[] = [];
  if (invoice.client) {
    const name =
      invoice.client.company_name?.trim() ||
      invoice.client.display_name?.trim() ||
      [invoice.client.first_name, invoice.client.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
    if (name) clientLines.push(name);
    if (
      invoice.client.company_name?.trim() &&
      name !== invoice.client.company_name.trim() &&
      invoice.client.display_name?.trim()
    ) {
      clientLines.push(invoice.client.display_name.trim());
    }
    if (invoice.client.email?.trim()) {
      clientLines.push(invoice.client.email.trim());
    }
    const addressParts = [
      invoice.client.address_line_1,
      invoice.client.address_line_2,
      [invoice.client.city, invoice.client.postcode].filter(Boolean).join(' '),
      invoice.client.country,
    ].filter(Boolean) as string[];
    if (addressParts.length > 0) {
      clientLines.push(addressParts.join(', '));
    }
  }

  let rightPartyY = partyRowY - 18;
  if (clientLines.length > 0) {
    rightPartyY = drawRightLines(
      page,
      clientLines,
      rightColumnRight,
      rightPartyY,
      10,
      font,
      14,
      COLORS.ink,
    );
  }

  let y = Math.min(leftPartyY, rightPartyY) - 28;

  const tableX = MARGIN;
  const colQty = tableX + tableWidth - 170;
  const colRate = tableX + tableWidth - 110;
  const colAmount = tableX + tableWidth;
  const itemColWidth = colQty - tableX - 12;
  const headerHeight = 24;

  page.drawRectangle({
    x: tableX,
    y: y - headerHeight + 8,
    width: tableWidth,
    height: headerHeight,
    color: COLORS.tableHead,
  });

  const headerY = y - 4;
  page.drawText('ITEM', {
    x: tableX + 10,
    y: headerY,
    size: 8,
    font: fontBold,
    color: COLORS.muted,
  });
  page.drawText('QTY', {
    x: colQty,
    y: headerY,
    size: 8,
    font: fontBold,
    color: COLORS.muted,
  });
  page.drawText('RATE', {
    x: colRate,
    y: headerY,
    size: 8,
    font: fontBold,
    color: COLORS.muted,
  });
  drawRightText(
    page,
    'AMOUNT',
    colAmount - 10,
    headerY,
    8,
    fontBold,
    COLORS.muted,
  );
  y -= headerHeight + 6;

  for (const row of invoice.items ?? []) {
    const descriptionLines = wrapText(row.description, font, 10, itemColWidth);
    const rowLineCount = Math.max(descriptionLines.length, 1);
    const rowHeight = rowLineCount * 13 + 10;

    if (y - rowHeight < minContentY) {
      break;
    }

    drawLines(page, descriptionLines, tableX + 10, y, 10, font, 13, COLORS.ink);
    page.drawText(String(row.quantity), {
      x: colQty,
      y,
      size: 10,
      font,
      color: COLORS.ink,
    });
    drawRightText(
      page,
      formatAmount(row.unit_price_pence),
      colRate + 52,
      y,
      10,
      font,
      COLORS.ink,
    );
    drawRightText(
      page,
      formatAmount(row.total_pence),
      colAmount - 10,
      y,
      10,
      font,
      COLORS.ink,
    );

    y -= rowHeight;
    page.drawLine({
      start: { x: tableX, y: y + 4 },
      end: { x: tableX + tableWidth, y: y + 4 },
      thickness: 0.5,
      color: COLORS.line,
    });
  }

  y -= 18;
  const totalsX = colAmount - 10;

  drawRightText(
    page,
    `Subtotal ${formatMoneyLabel(invoice.subtotal_pence ?? invoice.total_pence, currency)}`,
    totalsX,
    y,
    10,
    font,
    COLORS.muted,
  );
  y -= 16;

  if ((invoice.discount_pence ?? 0) > 0) {
    drawRightText(
      page,
      `Discount -${formatMoneyLabel(invoice.discount_pence ?? 0, currency)}`,
      totalsX,
      y,
      10,
      font,
      COLORS.muted,
    );
    y -= 14;
  }

  if ((invoice.tax_pence ?? 0) > 0) {
    drawRightText(
      page,
      `Tax ${formatMoneyLabel(invoice.tax_pence ?? 0, currency)}`,
      totalsX,
      y,
      10,
      font,
      COLORS.muted,
    );
    y -= 14;
  }

  if ((invoice.late_fee_pence ?? 0) > 0) {
    drawRightText(
      page,
      `Late fee ${formatMoneyLabel(invoice.late_fee_pence ?? 0, currency)}`,
      totalsX,
      y,
      10,
      font,
      COLORS.muted,
    );
    y -= 14;
  }

  drawRightText(
    page,
    `Total due ${currency}`,
    totalsX,
    y,
    11,
    fontBold,
    COLORS.ink,
  );
  y -= 18;
  drawRightText(
    page,
    formatAmount(invoice.total_pence),
    totalsX,
    y,
    18,
    fontBold,
    COLORS.ink,
  );
  y -= 28;

  if ((invoice.deposit_due_pence ?? 0) > 0) {
    drawRightText(
      page,
      `Deposit due ${formatMoneyLabel(invoice.deposit_due_pence ?? 0, currency)}`,
      totalsX,
      y,
      10,
      font,
      COLORS.muted,
    );
    y -= 20;
  }

  if (showNotes && invoice.notes?.trim()) {
    page.drawText('Notes', {
      x: MARGIN,
      y,
      size: 10,
      font: fontBold,
      color: COLORS.ink,
    });
    y -= 14;
    const noteLines = wrapText(invoice.notes.trim(), font, 9, tableWidth);
    y = drawLines(page, noteLines, MARGIN, y, 9, font, 12, COLORS.muted);
    y -= 8;
  }

  let bottomY = 28;
  const pageLabel = `Page 1 of 1 - Invoice #${invoice.invoice_number}`;
  const pageLabelWidth = font.widthOfTextAtSize(pageLabel, 8);
  page.drawText(pageLabel, {
    x: (PAGE_WIDTH - pageLabelWidth) / 2,
    y: bottomY,
    size: 8,
    font,
    color: COLORS.faint,
  });

  bottomY += 18;

  if (thankYouMessage) {
    const thankYouWidth = font.widthOfTextAtSize(thankYouMessage, 10);
    page.drawText(thankYouMessage, {
      x: (PAGE_WIDTH - thankYouWidth) / 2,
      y: bottomY,
      size: 10,
      font,
      color: COLORS.muted,
    });
    bottomY += 22;
  }

  const paymentTopY = bottomY + paymentBlockHeight;

  if (bankDetailLines.length > 0) {
    page.drawText('Bank transfer', {
      x: rightColumnX,
      y: paymentTopY,
      size: 10,
      font: fontBold,
      color: COLORS.ink,
    });
    drawLines(
      page,
      bankDetailLines,
      rightColumnX,
      paymentTopY - 14,
      9,
      font,
      12,
      COLORS.muted,
    );
  }

  if (paymentLinkLines.length > 0 && invoice.payment_url) {
    let payY = paymentTopY;
    const buttonHeight = drawPayButton(
      page,
      'Pay now online',
      MARGIN,
      payY,
      Math.min(columnWidth, 180),
      fontBold,
    );
    payY -= buttonHeight;
    payY = drawLines(
      page,
      paymentLinkLines,
      MARGIN,
      payY,
      8,
      font,
      11,
      COLORS.link,
    );
    if (paymentFeeLines.length > 0) {
      payY -= 4;
      drawLines(
        page,
        paymentFeeLines,
        MARGIN,
        payY,
        8,
        font,
        10,
        COLORS.muted,
      );
    }
  }

  return doc.save();
}
