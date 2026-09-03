import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { ContractForPdf } from '~/lib/contracts/build-contract-pdf';

type ContractRow = Record<string, unknown>;

function parsePaymentPlan(raw: unknown): ContractForPdf['payment_plan'] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is { label: string; percent: number } =>
      item != null &&
      typeof item === 'object' &&
      typeof (item as { label?: unknown }).label === 'string' &&
      typeof (item as { percent?: unknown }).percent === 'number',
  );
}

export async function buildContractPdfPayload(
  contract: ContractRow,
  accountId: string,
): Promise<ContractForPdf> {
  const client = getSupabaseServerAdminClient();

  const [{ data: clientRow }, { data: account }] = await Promise.all([
    contract.client_id
      ? client
          .from('clients')
          .select('display_name, first_name, last_name, company_name, email')
          .eq('id', contract.client_id as string)
          .eq('account_id', accountId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    client.from('accounts').select('name').eq('id', accountId).maybeSingle(),
  ]);

  return {
    id: (contract.id as string | undefined) ?? null,
    title: (contract.title as string) ?? 'Agreement',
    status: (contract.status as string) ?? 'draft',
    content_html: (contract.content_html as string) ?? '',
    total_pence: (contract.total_pence as number) ?? 0,
    currency: (contract.currency as string) ?? 'gbp',
    created_at: (contract.created_at as string | null | undefined) ?? null,
    updated_at: (contract.updated_at as string | null | undefined) ?? null,
    generated_at: new Date().toISOString(),
    payment_plan: parsePaymentPlan(contract.payment_plan),
    author_name: contract.author_name as string | null,
    author_company: contract.author_company as string | null,
    author_type: contract.author_type as string | null,
    author_signature_type: contract.author_signature_type as string | null,
    author_signature_data: contract.author_signature_data as string | null,
    author_signed_at: contract.author_signed_at as string | null,
    recipient_name: contract.recipient_name as string | null,
    recipient_company: contract.recipient_company as string | null,
    recipient_type: contract.recipient_type as string | null,
    recipient_signature_type: contract.recipient_signature_type as
      | string
      | null,
    recipient_signature_data: contract.recipient_signature_data as
      | string
      | null,
    recipient_signed_at: contract.recipient_signed_at as string | null,
    brand_name: account?.name ?? null,
    client: clientRow ?? null,
  };
}

export async function buildSignedContractPdfAttachment(params: {
  contract: ContractRow;
  accountId: string;
}): Promise<{ name: string; content: string; mimeType: string } | null> {
  try {
    const { buildContractPdf, contractPdfFilename } =
      await import('~/lib/contracts/build-contract-pdf');
    const payload = await buildContractPdfPayload(
      params.contract,
      params.accountId,
    );
    const pdfBytes = await buildContractPdf(payload);
    const filename = contractPdfFilename(payload.title).replace(
      /\.pdf$/i,
      payload.status === 'signed' ? '-signed.pdf' : '.pdf',
    );
    return {
      name: filename,
      content: Buffer.from(pdfBytes).toString('base64'),
      mimeType: 'application/pdf',
    };
  } catch (error) {
    console.error('[contracts] failed to build signed PDF attachment', error);
    return null;
  }
}
