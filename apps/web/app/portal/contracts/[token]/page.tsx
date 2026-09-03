import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  loadFrozenContractSnapshot,
  markContractReadByToken,
} from '~/home/[account]/contracts/_lib/server/contract-v2.server';
import { isContractSigningExpired } from '~/lib/contracts/signing-order';
import { checkContractTokenAccess } from '~/lib/contracts/token-access';

import { PortalContractView } from './portal-contract-view';

interface PortalContractPageProps {
  params: Promise<{ token: string }>;
}

async function getContractByToken(token: string) {
  const client = getSupabaseServerAdminClient();

  const { data: contract, error } = await client
    .from('contracts')
    .select('*')
    .eq('public_token', token)
    .maybeSingle();

  if (error || !contract) return null;

  // Reject draft, cancelled, revoked, and expired contracts — only
  // ready_to_sign / sent / signed contracts with a live token are
  // viewable through the portal.
  if (!checkContractTokenAccess(contract).accessible) return null;

  const clientPromise = contract.client_id
    ? client
        .from('clients')
        .select(
          'display_name, first_name, last_name, company_name, email, address_line_1, address_line_2, city, postcode, country',
        )
        .eq('id', contract.client_id)
        // Defense-in-depth: never let a mismatched client_id pull in
        // another workspace's client details.
        .eq('account_id', contract.account_id)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const { data: account } = await client
    .from('accounts')
    .select('id, name, slug')
    .eq('id', contract.account_id)
    .maybeSingle();

  const { data: clientData } = await clientPromise;

  const paymentPlan = Array.isArray(contract.payment_plan)
    ? contract.payment_plan.filter(
        (item: unknown): item is { label: string; percent: number } =>
          item != null &&
          typeof item === 'object' &&
          typeof (item as { label?: unknown }).label === 'string' &&
          typeof (item as { percent?: unknown }).percent === 'number',
      )
    : [];

  const snapshot = await loadFrozenContractSnapshot({
    ...contract,
    payment_plan: paymentPlan,
  });

  return {
    ...snapshot.contract,
    payment_plan: Array.isArray(snapshot.contract.payment_plan)
      ? snapshot.contract.payment_plan
      : paymentPlan,
    client: clientData ?? null,
    account: account ?? null,
    signers: snapshot.signers,
    signing_expires_at: contract.signing_expires_at ?? null,
    signing_expired: isContractSigningExpired(
      (contract.signing_expires_at as string | null) ?? null,
    ),
  } as Record<string, unknown>;
}

export default async function PortalContractPage({
  params,
}: PortalContractPageProps) {
  const { token } = await params;
  if (!token) notFound();

  await markContractReadByToken(token);

  const contract = await getContractByToken(token);
  if (!contract) notFound();

  const status = String((contract as { status?: string }).status ?? '');
  const isCancelled = status === 'cancelled';
  const isSigned = status === 'signed';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
        >
          ← Back to home
        </Link>
      </div>
      {isCancelled ? (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
          This agreement is no longer available.
        </div>
      ) : null}
      {isSigned ? (
        <div className="mb-6 rounded-lg border border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] px-4 py-3 text-[#97D9AA]">
          This agreement has been fully signed. Thank you.
        </div>
      ) : null}
      {Boolean((contract as { signing_expired?: boolean }).signing_expired) &&
      !isSigned ? (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-100">
          The signing deadline for this agreement has passed. You can still
          view it, but it can no longer be signed.
        </div>
      ) : null}
      <PortalContractView contract={contract} token={token} />
    </div>
  );
}
