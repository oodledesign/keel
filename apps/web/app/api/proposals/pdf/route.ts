import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';

import { buildProposalPdf } from '~/home/[account]/proposals/_lib/server/proposal-pdf';

async function buildPayload(proposal: Record<string, unknown>, accountId: string) {
  const client = getSupabaseServerAdminClient();
  const [{ data: clientRow }, brand, { data: account }] = await Promise.all([
    proposal.client_id
      ? client
          .from('clients')
          .select('display_name, first_name, last_name, company_name, email')
          .eq('id', proposal.client_id as string)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    loadAccountBrandResolved(accountId),
    client.from('accounts').select('name').eq('id', accountId).maybeSingle(),
  ]);

  return {
    title: (proposal.title as string) ?? 'Proposal',
    status: (proposal.status as string) ?? 'draft',
    content_html: (proposal.content_html as string) ?? '',
    total_pence: proposal.total_pence as number | null,
    currency: (proposal.currency as string) ?? 'gbp',
    expires_at: proposal.expires_at as string | null,
    recipient_name: proposal.recipient_name as string | null,
    brand_name: account?.name ?? null,
    brand_logo_url: brand.logo_url,
    client: clientRow ?? null,
  };
}

/**
 * GET /api/proposals/pdf?token=xxx  — Portal: load by public token, no auth.
 * GET /api/proposals/pdf?proposalId=xxx — Dashboard: auth required, RLS applies.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const proposalId = searchParams.get('proposalId');

  if (token) {
    const client = getSupabaseServerAdminClient();
    const { data: proposal, error: proposalError } = await client
      .from('proposals')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (proposalError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const payload = await buildPayload(proposal, proposal.account_id);
    const pdfBytes = await buildProposalPdf(payload);
    const filename = `proposal-${(proposal.title ?? 'document').replace(/[^\w-]+/g, '-').slice(0, 40)}.pdf`;
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

  if (proposalId) {
    const client = getSupabaseServerClient();
    const { data: proposal, error: invError } = await client
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();
    if (invError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const payload = await buildPayload(proposal, proposal.account_id);
    const pdfBytes = await buildProposalPdf(payload);
    const filename = `proposal-${(proposal.title ?? 'document').replace(/[^\w-]+/g, '-').slice(0, 40)}.pdf`;
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

  return NextResponse.json({ error: 'Provide token or proposalId' }, { status: 400 });
}
