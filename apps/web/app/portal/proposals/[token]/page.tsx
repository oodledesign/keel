import { notFound } from 'next/navigation';

import Link from 'next/link';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { markProposalReadByToken } from '~/home/[account]/proposals/_lib/server/proposal-v2.server';

import { PortalProposalView } from './portal-proposal-view';

interface PortalProposalPageProps {
  params: Promise<{ token: string }>;
}

async function getProposalByToken(token: string) {
  const client = getSupabaseServerAdminClient();

  const { data: proposal, error: proposalError } = await client
    .from('proposals')
    .select('*')
    .eq('public_token', token)
    .maybeSingle();

  if (proposalError || !proposal) {
    return null;
  }

  const [{ data: comments }, { data: clientData }, { data: dealData }] = await Promise.all([
    client
      .from('proposal_comments')
      .select('id, author_name, body, created_at')
      .eq('proposal_id', proposal.id)
      .order('created_at', { ascending: true }),
    proposal.client_id
      ? client
          .from('clients')
          .select('display_name, first_name, last_name, company_name, email')
          .eq('id', proposal.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    proposal.deal_id
      ? client
          .from('pipeline_deals')
          .select('contact_name, company_name, name')
          .eq('id', proposal.deal_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...proposal,
    comments: comments ?? [],
    client: clientData ?? null,
    deal: dealData ?? null,
  } as Record<string, unknown>;
}

export default async function PortalProposalPage({ params }: PortalProposalPageProps) {
  const { token } = await params;
  if (!token) notFound();

  await markProposalReadByToken(token);

  const proposal = await getProposalByToken(token);
  if (!proposal) notFound();

  const status = String((proposal as { status?: string }).status ?? '');
  if (status === 'draft') {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">
          ← Back to home
        </Link>
      </div>
      <PortalProposalView proposal={proposal} token={token} />
    </div>
  );
}
