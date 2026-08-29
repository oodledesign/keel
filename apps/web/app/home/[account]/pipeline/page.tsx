import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { loadPipelineDataForAccount } from '~/home/(user)/_lib/server/pipeline.loader';
import type { PipelineListingOption } from '~/home/(user)/pipeline/_components/pipeline-board';
import { createClientsService } from '~/home/[account]/clients/_lib/server/clients.service';
import type { ClientOption } from '~/home/[account]/projects/_components/client-combobox';
import { createRequirementsService } from '~/home/[account]/requirements/_lib/server/requirements.service';
import type { CommercialRequirement } from '~/home/[account]/requirements/_lib/server/requirements.service';
import { DEFAULT_BUILDING_SURVEYOR_BOARD_NAME } from '~/lib/building-surveyor/pipeline-stages';
import { isBuildingSurveyorTerminalStage } from '~/lib/building-surveyor/pipeline-stages';
import { DEFAULT_COMMERCIAL_WIP_BOARD_NAME } from '~/lib/commercial/commercial-constants';
import { isCommercialTerminalStage } from '~/lib/commercial/pipeline-stage-config';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath } from '../_lib/role-access';
import { isWorkModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../_lib/server/workspace-route-guard';
import { WorkspacePipelineBoardWrapper } from './_components/workspace-pipeline-board-wrapper';
import { loadLatestCareLogByInstruction } from './_lib/server/instruction-care-compliance.actions';
import { loadPipelineBoardSettings } from './_lib/server/pipeline-stage-settings.loader';
import { loadWipAttentionDigest } from './_lib/server/wip-attention.loader';
import { loadWipDeskActivity } from './_lib/server/wip-desk-activity.loader';

interface TeamAccountPipelinePageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  return { title: 'WIP' };
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
  redirectIfSpaceNotIn(workspace, accountSlug, [
    'work',
    'commercial-property',
    'building-surveyor',
  ]);

  if (!isWorkModuleEnabled(workspace.moduleSettings, 'pipeline')) {
    redirect(getDefaultAccountPath(accountSlug));
  }

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const [data, clientsResult] = await Promise.all([
    loadPipelineDataForAccount(accountId),
    createClientsService(client)
      .listClients({ accountId, page: 1, pageSize: 100 })
      .catch((error) => {
        console.error('[pipeline] failed to preload clients', {
          accountId,
          error: error instanceof Error ? error.message : String(error),
        });
        return { data: [] as unknown[], total: 0 };
      }),
  ]);
  const initialClients: ClientOption[] = (
    (clientsResult.data ?? []) as Array<{
      id: string;
      display_name: string | null;
      company_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      client_type?: string | null;
    }>
  ).map((row) => ({
    id: row.id,
    display_name: row.display_name ?? null,
    company_name: row.company_name ?? null,
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
    client_type: row.client_type ?? null,
  }));
  const isCommercial = workspace.workspaceProfile === 'commercial_property';
  const isSurveyor = workspace.workspaceProfile === 'building_surveyor';

  let listings: PipelineListingOption[] = [];
  let stageConfig = undefined;
  let boardName = DEFAULT_COMMERCIAL_WIP_BOARD_NAME;
  let requirements: CommercialRequirement[] = [];
  let attentionDigest = null as Awaited<
    ReturnType<typeof loadWipAttentionDigest>
  > | null;
  let deskActivity = [] as Awaited<ReturnType<typeof loadWipDeskActivity>>;
  let latestCareByDealId: Record<string, string> = {};

  if (isCommercial) {
    // commercial_* tables may lag generated Database types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = client as any;
    const [
      listingResult,
      boardSettings,
      agentResult,
      requirementsList,
      attention,
      activity,
    ] = await Promise.all([
      db
        .from('commercial_listings')
        .select(
          'id, name, disposal_type, asking_rent_pence, asking_price_pence',
        )
        .eq('account_id', accountId)
        .order('name', { ascending: true }),
      loadPipelineBoardSettings(accountId),
      db
        .from('commercial_listing_agents')
        .select('listing_id, user_id, sort_order')
        .eq('account_id', accountId)
        .order('sort_order', { ascending: true }),
      createRequirementsService(client).listRequirements(accountId),
      loadWipAttentionDigest(client, accountId),
      loadWipDeskActivity(client, accountId),
    ]);

    requirements = requirementsList;
    attentionDigest = attention;
    deskActivity = activity;

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
    stageConfig = boardSettings.stages;
    boardName = boardSettings.boardName;

    latestCareByDealId = await loadLatestCareLogByInstruction(
      data.deals.map((deal) => deal.id),
    );
  }

  const activeDeals = data.deals.filter((d) => {
    if (isCommercial) {
      return !isCommercialTerminalStage(d.stage);
    }
    if (isSurveyor) {
      return !isBuildingSurveyorTerminalStage(d.stage);
    }
    return d.stage !== 'won' && d.stage !== 'lost';
  });
  const totalValue = activeDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const headerTitle = isCommercial
    ? boardName
    : isSurveyor
      ? DEFAULT_BUILDING_SURVEYOR_BOARD_NAME
      : 'Pipeline';
  const headerDescription = isCommercial
    ? undefined
    : isSurveyor
      ? `${activeDeals.length} open enquiries · ${formatCurrency(totalValue)} quoted`
      : `${activeDeals.length} active leads · ${formatCurrency(totalValue)} total value`;

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title={headerTitle}
        description={headerDescription}
        className={
          isCommercial ? 'flex px-4 py-1.5 lg:px-8' : 'flex px-4 py-3 lg:px-8'
        }
      />
      <PageBody className="flex min-h-0 flex-1 flex-col bg-[var(--workspace-shell-canvas)] p-0 lg:px-0">
        <WorkspacePipelineBoardWrapper
          initialData={data}
          accountSlug={accountSlug}
          accountId={accountId}
          initialClients={initialClients}
          variant={
            isCommercial ? 'commercial' : isSurveyor ? 'surveyor' : 'work'
          }
          listings={listings}
          stageConfig={stageConfig}
          boardName={boardName}
          initialRequirements={requirements}
          attentionDigest={attentionDigest}
          deskActivity={deskActivity}
          latestCareByDealId={latestCareByDealId}
          hideBoardTitle
        />
      </PageBody>
    </>
  );
}

export default withI18n(TeamAccountPipelinePage);
