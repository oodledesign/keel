import 'server-only';

import { createHash } from 'node:crypto';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import { buildContractPdfPayload } from '~/home/[account]/contracts/_lib/server/contract-pdf-payload';
import {
  type ContractForPdf,
  type ContractPdfAudit,
  buildContractPdf,
  contractPdfFilename,
} from '~/lib/contracts/build-contract-pdf';

/**
 * After a surveyor terms-of-business contract is fully signed: build the PDF
 * with an audit page, store it, and record path + sha256 on the contract.
 */
export async function storeSignedSurveyorTobPdf(input: {
  accountId: string;
  contractId: string;
}): Promise<{ path: string; sha256: string } | null> {
  const admin = getSupabaseServerAdminClient();

  const { data: contract, error } = await admin
    .from('contracts')
    .select('*')
    .eq('id', input.contractId)
    .eq('account_id', input.accountId)
    .maybeSingle();
  if (error || !contract) {
    console.error('[tob-pdf] contract load failed', error?.message);
    return null;
  }

  const isTerms = Boolean(
    (contract as { is_terms_of_business?: boolean | null })
      .is_terms_of_business,
  );
  if (!isTerms) return null;

  const sentVersionId = (contract as { sent_version_id?: string | null })
    .sent_version_id;
  const [{ data: version }, { data: signers }] = await Promise.all([
    sentVersionId
      ? admin
          .from('contract_versions')
          .select('content_hash, frozen_at')
          .eq('id', sentVersionId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    sentVersionId
      ? admin
          .from('contract_signers')
          .select(
            'role, name, email, signed_at, signed_ip, signed_user_agent, signing_order',
          )
          .eq('contract_id', input.contractId)
          .eq('version_id', sentVersionId)
          .order('signing_order', { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const audit: ContractPdfAudit = {
    contentHash:
      (version as { content_hash?: string | null } | null)?.content_hash ??
      null,
    sentAt: (contract as { sent_at?: string | null }).sent_at ?? null,
    viewedAt:
      (contract as { recipient_viewed_at?: string | null })
        .recipient_viewed_at ??
      (contract as { viewed_at?: string | null }).viewed_at ??
      null,
    signers: (
      (signers ?? []) as Array<{
        role?: string | null;
        name?: string | null;
        email?: string | null;
        signed_at?: string | null;
        signed_ip?: string | null;
        signed_user_agent?: string | null;
      }>
    ).map((signer) => ({
      role: String(signer.role ?? 'signer'),
      name: String(signer.name ?? 'Signer'),
      email: signer.email ?? null,
      signedAt: signer.signed_at ?? null,
      signedIp: signer.signed_ip ?? null,
      signedUserAgent: signer.signed_user_agent ?? null,
    })),
  };

  // Fall back to author/recipient columns when the roster is empty.
  if (audit.signers.length === 0) {
    audit.signers = [
      {
        role: 'author',
        name: String(
          (contract as { author_name?: string | null }).author_name ?? 'Author',
        ),
        signedAt: (contract as { author_signed_at?: string | null })
          .author_signed_at,
        signedIp: (contract as { author_signed_ip?: string | null })
          .author_signed_ip,
        signedUserAgent: (
          contract as { author_signed_user_agent?: string | null }
        ).author_signed_user_agent,
      },
      {
        role: 'recipient',
        name: String(
          (contract as { recipient_name?: string | null }).recipient_name ??
            'Client',
        ),
        email: (contract as { recipient_email?: string | null })
          .recipient_email,
        signedAt: (contract as { recipient_signed_at?: string | null })
          .recipient_signed_at,
        signedIp: (contract as { recipient_signed_ip?: string | null })
          .recipient_signed_ip,
        signedUserAgent: (
          contract as { recipient_signed_user_agent?: string | null }
        ).recipient_signed_user_agent,
      },
    ];
  }

  const basePayload: ContractForPdf = await buildContractPdfPayload(
    contract as Record<string, unknown>,
    input.accountId,
  );
  const pdfBytes = await buildContractPdf({
    ...basePayload,
    status: 'signed',
    audit,
  });
  const sha256 = createHash('sha256').update(pdfBytes).digest('hex');
  const filename = contractPdfFilename(basePayload.title).replace(
    /\.pdf$/i,
    '-signed.pdf',
  );
  const path = `${input.accountId}/contracts/${input.contractId}/${filename}`;

  const { error: uploadError } = await admin.storage
    .from(ACCOUNT_DOCS_BUCKET)
    .upload(path, Buffer.from(pdfBytes), {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (uploadError) {
    console.error('[tob-pdf] upload failed', uploadError.message);
    return null;
  }

  const { error: updateError } = await admin
    .from('contracts')
    .update({
      signed_pdf_path: path,
      signed_pdf_sha256: sha256,
    } as never)
    .eq('id', input.contractId)
    .eq('account_id', input.accountId);
  if (updateError) {
    console.error('[tob-pdf] path update failed', updateError.message);
    return null;
  }

  return { path, sha256 };
}
