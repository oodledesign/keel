import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { loadPipelineDataForAccount } from '~/home/(user)/_lib/server/pipeline.loader';
import type { PipelineListingOption } from '~/home/(user)/pipeline/_components/pipeline-board';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath } from '../_lib/role-access';
import { isWorkModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../_lib/server/workspace-route-guard';
import { WorkspacePipelineBoardWrapper } from './_components/workspace-pipeline-board-wrapper';
import { loadPipelineBoardStageSettings } from './_lib/server/pipeline-stage-settings.loader';

interface TeamAccountPipelinePageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  return { title: 'Deals' };
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

async function TeamAccountPipelinePage({
  params,
}: TeamAccountPipelinePageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work', 'commercial-property']);

  if (!isWorkModuleEnabled(workspace.moduleSettings, 'pipeline')) {
    redirect(getDefaultAccountPath(accountSlug));
  }

  const accountId = workspace.account.id as string;
  const data = await loadPipelineDataForAccount(accountId);
  const isCommercial = workspace.workspaceProfile === 'commercial_property';

  let listings: PipelineListingOption[] = [];
  let stageConfig = undefined;

  if (isCommercial) {
    const client = getSupabaseServerClient();
    // commercial_* tables may lag generated Database types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = client as any;
    const [listingResult, stages, agentResult] = await Promise.all([
      db
        .from('commercial_listings')
        .select(
          'id, name, disposal_type, asking_rent_pence, asking_price_pence',
        )
        .eq('account_id', accountId)
        .order('name', { ascending: true }),
      loadPipelineBoardStageSettings(accountId),
      db
        .from('commercial_listing_agents')
        .select('listing_id, user_id, sort_order')
        .eq('account_id', accountId)
        .order('sort_order', { ascending: true }),
    ]);

    const agentRows = (agentResult.data ?? []) as Array<{
      listing_id: string;
      user_id: string;
      sort_order: number;
    }>;
    const userIds = [...new Set(agentRows.map((r) => r.user_id))];
    const memberById = new Map<
      string,
      { name: string; pictureUrl: string | null }
    >();

    if (userIds.length > 0) {
      const { data: accounts } = await client
        .from('accounts')
        .select('id, name, picture_url')
        .in('id', userIds);
      for (const row of accounts ?? []) {
        memberById.set(row.id as string, {
          name: (row.name as string) || 'Member',
          pictureUrl: (row.picture_url as string | null) ?? null,
        });
      }
    }

    const agentsByListing = new Map<
      string,
      Array<{ userId: string; name: string; pictureUrl: string | null }>
    >();
    for (const row of agentRows) {
      const member = memberById.get(row.user_id);
      if (!member) continue;
      const list = agentsByListing.get(row.listing_id) ?? [];
      list.push({
        userId: row.user_id,
        name: member.name,
        pictureUrl: member.pictureUrl,
      });
      agentsByListing.set(row.listing_id, list);
    }

    listings = (
      (listingResult.data ?? []) as Array<{
        id: string;
        name: string | null;
        disposal_type: string | null;
        asking_rent_pence: number | null;
        asking_price_pence: number | null;
      }>
    ).map((row) => ({
      id: row.id,
      name: row.name || 'Untitled disposal',
      disposalType: row.disposal_type,
      askingRentPence: row.asking_rent_pence,
      askingPricePence: row.asking_price_pence,
      actingAgents: agentsByListing.get(row.id) ?? [],
    }));
    stageConfig = stages;
  }

  const activeDeals = data.deals.filter((d) => {
    if (isCommercial) {
      return (
        d.stage !== 'signed' &&
        d.stage !== 'discounted' &&
        d.stage !== 'won' &&
        d.stage !== 'lost'
      );
    }
    return d.stage !== 'won' && d.stage !== 'lost';
  });
  const totalValue = activeDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const headerTitle = isCommercial ? 'Deals' : 'Pipeline';
  const headerDescription = isCommercial
    ? `${activeDeals.length} active ${activeDeals.length === 1 ? 'deal' : 'deals'} · ${formatCurrency(totalValue)} total value`
    : `${activeDeals.length} active leads · ${formatCurrency(totalValue)} total value`;

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title={headerTitle}
        description={headerDescription}
      />
      <PageBody className="flex min-h-0 flex-1 flex-col bg-[var(--workspace-shell-canvas)] p-0">
        <WorkspacePipelineBoardWrapper
          initialData={data}
          accountSlug={accountSlug}
          accountId={accountId}
          variant={isCommercial ? 'commercial' : 'work'}
          listings={listings}
          stageConfig={stageConfig}
        />
      </PageBody>
    </>
  );
}

export default withI18n(TeamAccountPipelinePage);
