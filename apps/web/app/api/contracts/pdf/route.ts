import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { buildContractPdfPayload } from '~/home/[account]/contracts/_lib/server/contract-pdf-payload';
import {
  buildContractPdf,
  contractPdfFilename,
} from '~/lib/contracts/build-contract-pdf';
import { loadFrozenContractSnapshot } from '~/home/[account]/contracts/_lib/server/contract-v2.server';
import { checkContractTokenAccess } from '~/lib/contracts/token-access';

async function pdfResponse(
  contract: Record<string, unknown>,
  accountId: string,
) {
  const payload = await buildContractPdfPayload(contract, accountId);
  const pdfBytes = await buildContractPdf(payload);
  const filename = contractPdfFilename(payload.title);
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
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 },
      );
    }

    // Reject draft, cancelled, revoked, and expired contracts — only
    // ready_to_sign / sent / signed contracts with a live token can be
    // downloaded via a public link.
    if (!checkContractTokenAccess(contract).accessible) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 },
      );
    }

    // Audit trail for public-link access (best-effort; never blocks the
    // download on a logging failure).
    void client
      .from('contract_events')
      .insert({
        account_id: contract.account_id,
        contract_id: contract.id,
        event_type: 'pdf_downloaded',
        payload: { via: 'token' },
        actor_id: null,
      })
      .then(
        () => undefined,
        () => undefined,
      );

    const snapshot = await loadFrozenContractSnapshot(contract);
    return pdfResponse(snapshot.contract, contract.account_id);
  }

  if (contractId) {
    const client = getSupabaseServerClient();
    const { data: contract, error } = await client
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();
    if (error || !contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 },
      );
    }

    return pdfResponse(contract, contract.account_id);
  }

  return NextResponse.json(
    { error: 'Provide token or contractId' },
    { status: 400 },
  );
}
