import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { buildContractPdf } from '~/home/[account]/contracts/_lib/server/contract-pdf';

async function buildPayload(contract: Record<string, unknown>, accountId: string) {
  const client = getSupabaseServerAdminClient();

  const [{ data: clientRow }, { data: account }] = await Promise.all([
    contract.client_id
      ? client
          .from('clients')
          .select(
            'display_name, first_name, last_name, company_name, email, address_line_1, address_line_2, city, postcode, country',
          )
          .eq('id', contract.client_id as string)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    client.from('accounts').select('name').eq('id', accountId).maybeSingle(),
  ]);

  const paymentPlan = Array.isArray(contract.payment_plan)
    ? contract.payment_plan.filter(
        (item): item is { label: string; percent: number } =>
          item != null &&
          typeof item === 'object' &&
          typeof (item as { label?: unknown }).label === 'string' &&
          typeof (item as { percent?: unknown }).percent === 'number',
      )
    : [];

  return {
    title: (contract.title as string) ?? 'Agreement',
    status: (contract.status as string) ?? 'draft',
    content_html: (contract.content_html as string) ?? '',
    total_pence: (contract.total_pence as number) ?? 0,
    currency: (contract.currency as string) ?? 'gbp',
    payment_plan: paymentPlan,
    author_name: contract.author_name as string | null,
    author_company: contract.author_company as string | null,
    author_type: contract.author_type as string | null,
    author_signature_type: contract.author_signature_type as string | null,
    author_signature_data: contract.author_signature_data as string | null,
    author_signed_at: contract.author_signed_at as string | null,
    recipient_name: contract.recipient_name as string | null,
    recipient_company: contract.recipient_company as string | null,
    recipient_type: contract.recipient_type as string | null,
    recipient_signature_type: contract.recipient_signature_type as string | null,
    recipient_signature_data: contract.recipient_signature_data as string | null,
    recipient_signed_at: contract.recipient_signed_at as string | null,
    brand_name: account?.name ?? null,
    client: clientRow ?? null,
  };
}

/**
 * GET /api/contracts/pdf?token=xxx — Portal: load by public token, no auth.
 * GET /api/contracts/pdf?contractId=xxx — Dashboard: auth required, RLS applies.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const contractId = searchParams.get('contractId');

  if (token) {
    const client = getSupabaseServerAdminClient();
    const { data: contract, error } = await client
      .from('contracts')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (error || !contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const payload = await buildPayload(contract, contract.account_id);
    const pdfBytes = await buildContractPdf(payload);
    const slug = (contract.title as string | null)?.trim() || 'agreement';
    const filename = `contract-${slug.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;
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

  if (contractId) {
    const client = getSupabaseServerClient();
    const { data: contract, error } = await client
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();
    if (error || !contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const payload = await buildPayload(contract, contract.account_id);
    const pdfBytes = await buildContractPdf(payload);
    const slug = (contract.title as string | null)?.trim() || 'agreement';
    const filename = `contract-${slug.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;
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

  return NextResponse.json({ error: 'Provide token or contractId' }, { status: 400 });
}
