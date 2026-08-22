import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { requireCommercialBillableActor } from '~/lib/commercial/require-commercial-billable-actor';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { createListingsService } from '../_lib/server/listings.service';

interface PageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{
    name?: string;
    notes?: string;
    askingRent?: string;
    clientId?: string;
    dealId?: string;
    sopAssist?: string;
  }>;
}

async function NewDisposalPage({ params, searchParams }: PageProps) {
  const { account: slug } = await params;
  const query = await searchParams;
  const workspace = await loadTeamWorkspace(slug);
  const accountId = workspace.account.id as string;
  const user = await requireUserInServerComponent();
  await requireCommercialBillableActor(accountId, 'create or edit disposals');

  const client = getSupabaseServerClient();
  const name = query.name?.trim() || 'Untitled disposal';
  const askingRent = query.askingRent?.trim();

  const listing = await createListingsService(client).createListing({
    accountId,
    name,
    status: 'draft',
    notes: query.notes?.trim() || null,
    askingRentPence: askingRent
      ? Math.round(parseFloat(askingRent) * 100)
      : null,
    instructingClientId: query.clientId?.trim() || null,
    createdBy: user.id,
  });

  const editPath = pathsConfig.app.accountListingEdit
    .replace('[account]', slug)
    .replace('[id]', listing.id);

  const qs = new URLSearchParams();
  if (query.dealId?.trim()) qs.set('dealId', query.dealId.trim());
  if (query.sopAssist?.trim()) qs.set('sopAssist', query.sopAssist.trim());

  redirect(`${editPath}${qs.size ? `?${qs.toString()}` : ''}`);
}

export default withI18n(NewDisposalPage);
