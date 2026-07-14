import 'server-only';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type InvoiceForPdf = {
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

function formatPence(pence: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase() || 'GBP',
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

async function embedLogo(
  doc: PDFDocument,
  logoUrl: string | null | undefined,
) {
  if (!logoUrl) return null;
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

export async function buildInvoicePdf(invoice: InvoiceForPdf): Promise<Uint8Array> {
  const showReference = invoice.show_reference !== false;
  const showDueDate = invoice.show_due_date !== false;
  const showIssuedDate = invoice.show_issued_date !== false;
  const showNotes = invoice.show_notes !== false;
  const showFooter = invoice.show_footer !== false;
  const showLogo = invoice.show_logo !== false;
  const showPaymentLink = invoice.show_payment_link !== false;

  const currency = (invoice.currency || 'GBP').toUpperCase();

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const drawText = (
    text: string,
    x: number,
    size: number,
    options?: { bold?: boolean; color?: ReturnType<typeof rgb> },
  ) => {
    const f = options?.bold ? fontBold : font;
    page.drawText(text, {
      x,
      y,
      size,
      font: f,
      color: options?.color ?? rgb(0.1, 0.1, 0.1),
    });
    y -= size + 2;
  };

  const logo = showLogo ? await embedLogo(doc, invoice.logo_url) : null;
  if (logo) {
    const maxW = 110;
    const maxH = 42;
    const scale = Math.min(maxW / logo.width, maxH / logo.height);
    const w = logo.width * scale;
    const h = logo.height * scale;
    page.drawImage(logo, {
      x: width - margin - w,
      y: y - h + 14,
      width: w,
      height: h,
    });
  }

  if (invoice.brand_name) {
    drawText(invoice.brand_name, margin, 11, {
      bold: true,
      color: rgb(0.25, 0.25, 0.25),
    });
    y -= 2;
  }

  const heading =
    invoice.title?.trim() || `Invoice ${invoice.invoice_number}`;
  drawText(heading, margin, 20, { bold: true });
  y -= 4;

  drawText(`Invoice #${invoice.invoice_number}`, margin, 10);
  if (invoice.status === 'draft') {
    drawText('Status: Draft', margin, 10, { color: rgb(0.45, 0.35, 0.2) });
  }

  const reference =
    invoice.reference_number?.trim() || invoice.invoice_number;
  if (showReference) {
    drawText(`Reference: ${reference}`, margin, 10);
  }
  if (showIssuedDate) {
    drawText(`Issue date: ${formatDate(invoice.issued_at)}`, margin, 10);
  }
  if (showDueDate) {
    drawText(`Due date: ${formatDate(invoice.due_at)}`, margin, 10);
  }
  y -= 10;

  if (invoice.client) {
    drawText('Bill to', margin, 12, { bold: true });
    const name =
      invoice.client.display_name ??
      ([invoice.client.first_name, invoice.client.last_name]
        .filter(Boolean)
        .join(' ') ||
        '—');
    drawText(name, margin, 10);
    if (invoice.client.company_name) {
      drawText(invoice.client.company_name, margin, 10);
    }
    if (invoice.client.email) drawText(invoice.client.email, margin, 10);
    const address = [
      invoice.client.address_line_1,
      invoice.client.address_line_2,
      [invoice.client.city, invoice.client.postcode].filter(Boolean).join(' '),
      invoice.client.country,
    ]
      .filter(Boolean)
      .join(', ');
    if (address) drawText(address.slice(0, 90), margin, 9);
    y -= 14;
  }

  drawText('Line items', margin, 12, { bold: true });
  y -= 6;

  const col1 = margin;
  const col2 = width - margin - 80;
  const col3 = width - margin - 55;
  const col4 = width - margin - 30;

  page.drawText('Description', {
    x: col1,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText('Qty', {
    x: col2,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText('Unit', {
    x: col3,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText('Total', {
    x: col4,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 14;

  for (const row of invoice.items ?? []) {
    page.drawText(row.description.slice(0, 50), {
      x: col1,
      y,
      size: 9,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    page.drawText(String(row.quantity), {
      x: col2,
      y,
      size: 9,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    page.drawText(formatPence(row.unit_price_pence, currency), {
      x: col3,
      y,
      size: 9,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    page.drawText(formatPence(row.total_pence, currency), {
      x: col4,
      y,
      size: 9,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= 12;
  }

  y -= 8;
  if ((invoice.discount_pence ?? 0) > 0) {
    page.drawText(`Discount: -${formatPence(invoice.discount_pence ?? 0, currency)}`, {
      x: col3 - 40,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 12;
  }
  if ((invoice.tax_pence ?? 0) > 0) {
    page.drawText(`Tax: ${formatPence(invoice.tax_pence ?? 0, currency)}`, {
      x: col3 - 40,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 12;
  }
  if ((invoice.late_fee_pence ?? 0) > 0) {
    page.drawText(`Late fee: ${formatPence(invoice.late_fee_pence ?? 0, currency)}`, {
      x: col3 - 40,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 12;
  }
  page.drawText(`Total: ${formatPence(invoice.total_pence, currency)}`, {
    x: col3 - 40,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 16;

  if ((invoice.deposit_due_pence ?? 0) > 0) {
    drawText(
      `Deposit due: ${formatPence(invoice.deposit_due_pence ?? 0, currency)}`,
      margin,
      10,
    );
  }

  if (showNotes && invoice.notes) {
    drawText('Notes', margin, 10, { bold: true });
    drawText(invoice.notes.slice(0, 500), margin, 9);
  }

  if (showFooter && invoice.footer_message) {
    drawText(invoice.footer_message.slice(0, 500), margin, 9);
  }

  if (invoice.bank?.bank_account_number || invoice.bank?.bank_iban) {
    y -= 8;
    drawText('Bank transfer details', margin, 11, { bold: true });
    if (invoice.bank.bank_account_name) {
      drawText(`Account name: ${invoice.bank.bank_account_name}`, margin, 9);
    }
    if (invoice.bank.bank_sort_code) {
      drawText(`Sort code: ${invoice.bank.bank_sort_code}`, margin, 9);
    }
    if (invoice.bank.bank_account_number) {
      drawText(`Account number: ${invoice.bank.bank_account_number}`, margin, 9);
    }
    if (invoice.bank.bank_iban) {
      drawText(`IBAN: ${invoice.bank.bank_iban}`, margin, 9);
    }
    if (invoice.bank.bank_bic) {
      drawText(`BIC: ${invoice.bank.bank_bic}`, margin, 9);
    }
    drawText(`Reference: ${reference}`, margin, 9);
    if (invoice.bank.bank_transfer_instructions) {
      drawText(invoice.bank.bank_transfer_instructions.slice(0, 300), margin, 9);
    }
  }

  if (showPaymentLink && invoice.payment_url) {
    y -= 12;
    drawText('Pay online', margin, 11, { bold: true });
    drawText(invoice.payment_url, margin, 9, { color: rgb(0.15, 0.35, 0.65) });
    drawText(
      'Open this link to view and pay this invoice online.',
      margin,
      8,
      { color: rgb(0.4, 0.4, 0.4) },
    );
  }

  return doc.save();
}
