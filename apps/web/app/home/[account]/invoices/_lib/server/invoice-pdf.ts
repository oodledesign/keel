import 'server-only';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type InvoiceForPdf = {
  invoice_number: string;
  status: string;
  due_at: string | null;
  total_pence: number;
  currency: string;
  notes: string | null;
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
};

function formatPence(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

function formatDate(iso: string | null): string {
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

export async function buildInvoicePdf(invoice: InvoiceForPdf): Promise<Uint8Array> {
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
    options?: { bold?: boolean },
  ) => {
    const f = options?.bold ? fontBold : font;
    page.drawText(text, { x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
    y -= size + 2;
  };

  drawText(`Invoice ${invoice.invoice_number}`, margin, 20, { bold: true });
  y -= 8;

  drawText(`Status: ${invoice.status}`, margin, 10);
  drawText(`Due date: ${formatDate(invoice.due_at)}`, margin, 10);
  y -= 12;

  if (invoice.client) {
    drawText('Bill to', margin, 12, { bold: true });
    const name =
      invoice.client.display_name ??
      ([invoice.client.first_name, invoice.client.last_name].filter(Boolean).join(' ') || '—');
    drawText(name, margin, 10);
    if (invoice.client.company_name) drawText(invoice.client.company_name, margin, 10);
    if (invoice.client.email) drawText(invoice.client.email, margin, 10);
    const addr = [
      invoice.client.address_line_1,
      invoice.client.address_line_2,
      [invoice.client.city, invoice.client.postcode].filter(Boolean).join(' '),
      invoice.client.country,
    ]
      .filter(Boolean)
      .join(', ');
    if (addr) drawText(addr, margin, 10);
    y -= 16;
  }

  drawText('Line items', margin, 12, { bold: true });
  y -= 6;

  const tableTop = y;
  const col1 = margin;
  const col2 = width - margin - 80;
  const col3 = width - margin - 55;
  const col4 = width - margin - 30;

  page.drawText('Description', { x: col1, y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Qty', { x: col2, y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Unit', { x: col3, y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Total', { x: col4, y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  y -= 14;

  for (const row of invoice.items ?? []) {
    page.drawText(row.description.slice(0, 50), { x: col1, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(String(row.quantity), { x: col2, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(formatPence(row.unit_price_pence), { x: col3, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(formatPence(row.total_pence), { x: col4, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 12;
  }

  y -= 8;
  page.drawText(`Total: ${formatPence(invoice.total_pence)}`, { x: col3, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  y -= 16;

  if (invoice.notes) {
    drawText('Notes', margin, 10, { bold: true });
    drawText(invoice.notes.slice(0, 500), margin, 9);
  }

  return doc.save();
}
