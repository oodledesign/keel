import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { buildInvoicePdf } from '~/home/[account]/invoices/_lib/server/invoice-pdf';

/**
 * GET /api/invoices/pdf?token=xxx  — Portal: load by public token, no auth. Returns PDF.
 * GET /api/invoices/pdf?invoiceId=xxx — Dashboard: auth required, RLS applies. Returns PDF.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const invoiceId = searchParams.get('invoiceId');

  if (token) {
    const client = getSupabaseServerAdminClient();
    const { data: invoice, error: invoiceError } = await client
      .from('invoices')
      .select(
        'id, client_id, invoice_number, status, due_at, total_pence, currency, notes',
      )
      .eq('public_token', token)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const [{ data: items }, { data: clientRow }] = await Promise.all([
      client
        .from('invoice_items')
        .select('description, quantity, unit_price_pence, total_pence')
        .eq('invoice_id', invoice.id)
        .order('sort_order', { ascending: true }),
      invoice.client_id
        ? client
            .from('clients')
            .select(
              'display_name, first_name, last_name, company_name, email, address_line_1, address_line_2, city, postcode, country',
            )
            .eq('id', invoice.client_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const payload = {
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      due_at: invoice.due_at,
      total_pence: invoice.total_pence,
      currency: invoice.currency ?? 'gbp',
      notes: invoice.notes,
      items: items ?? [],
      client: clientRow ?? null,
    };
    const pdfBytes = await buildInvoicePdf(payload);
    const filename = `invoice-${invoice.invoice_number}.pdf`;
    const body = Buffer.from(pdfBytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(body.length),
      },
    });
  }

  if (invoiceId) {
    const client = getSupabaseServerClient();
    const { data: invoice, error: invError } = await client
      .from('invoices')
      .select('id, client_id, invoice_number, status, due_at, total_pence, currency, notes')
      .eq('id', invoiceId)
      .single();
    if (invError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    const { data: items } = await client
      .from('invoice_items')
      .select('description, quantity, unit_price_pence, total_pence')
      .eq('invoice_id', invoice.id)
      .order('sort_order', { ascending: true });
    let clientRow: Record<string, unknown> | null = null;
    if (invoice.client_id) {
      const { data } = await client
        .from('clients')
        .select('display_name, first_name, last_name, company_name, email, address_line_1, address_line_2, city, postcode, country')
        .eq('id', invoice.client_id)
        .single();
      clientRow = data;
    }
    const payload = {
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      due_at: invoice.due_at,
      total_pence: invoice.total_pence,
      currency: invoice.currency ?? 'gbp',
      notes: invoice.notes,
      items: items ?? [],
      client: clientRow,
    };
    const pdfBytes = await buildInvoicePdf(payload);
    const filename = `invoice-${invoice.invoice_number}.pdf`;
    const body = Buffer.from(pdfBytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(body.length),
      },
    });
  }

  return NextResponse.json(
    { error: 'Provide token or invoiceId' },
    { status: 400 },
  );
}
