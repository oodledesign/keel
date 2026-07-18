import { NextResponse } from 'next/server';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { buildInvoicePdf } from '~/home/[account]/invoices/_lib/server/invoice-pdf';
import {
  buildInvoicePdfPayload,
  displayOptionsFromSearchParams,
} from '~/home/[account]/invoices/_lib/server/invoice-pdf-payload';

/**
 * GET /api/invoices/pdf?token=xxx  — Portal: load by public token, no auth. Returns PDF.
 * GET /api/invoices/pdf?invoiceId=xxx — Dashboard: auth required, RLS applies. Returns PDF.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const invoiceId = searchParams.get('invoiceId');
  const options = displayOptionsFromSearchParams(searchParams);

  if (token) {
    const client = getSupabaseServerAdminClient();
    const { data: invoice, error: invoiceError } = await client
      .from('invoices')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const payload = await buildInvoicePdfPayload(
      invoice,
      invoice.account_id,
      options,
    );
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
    const auth = await requireUser(client);

    if (!auth.data) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: invoice, error: invError } = await client
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();
    if (invError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const payload = await buildInvoicePdfPayload(
      invoice,
      invoice.account_id,
      options,
    );
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
