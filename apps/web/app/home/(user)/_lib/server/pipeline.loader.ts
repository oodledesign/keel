import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { PIPELINE_WORKSPACE_BUSINESS_PREFIX } from '~/home/(user)/_lib/pipeline-constants';
import {
  loadBusinessIdsForTeamAccount,
  loadTeamAccountIdsForUser,
  loadUserWorkspaceAccounts,
} from '~/home/_lib/server/workspace-scope';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

// ─── Types ───────────────────────────────────────────────────────────

export type PipelineDeal = {
  id: string;
  contactName: string;
  companyName: string;
  value: number;
  stage: string;
  nextAction: string;
  nextActionDate: string | null;
  businessId: string;
  businessName: string;
  businessColor: string | null;
};

export type PipelineData = {
  deals: PipelineDeal[];
  businesses: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
};

type PipelineDealRow = {
  id: string;
  contact_name?: string | null;
  company_name?: string | null;
  value?: number | null;
  stage?: string | null;
  next_action?: string | null;
  next_action_date?: string | null;
  business_id?: string | null;
  account_id?: string | null;
  businesses?: { name?: string | null; colour?: string | null } | null;
  accounts?: { name?: string | null } | null;
};

type BusinessRow = {
  id: string;
  name?: string | null;
  colour?: string | null;
};

function mapDealRow(row: PipelineDealRow): PipelineDeal {
  const bizName =
    row.businesses?.name?.trim() ||
    row.accounts?.name?.trim() ||
    'Workspace';
  const syntheticBizId =
    row.business_id ??
    (row.account_id ? `${PIPELINE_WORKSPACE_BUSINESS_PREFIX}${row.account_id}` : '');
  return {
    id: row.id,
    contactName: row.contact_name ?? '',
    companyName: row.company_name ?? '',
    value: row.value ?? 0,
    stage: row.stage ?? 'lead',
    nextAction: row.next_action ?? '',
    nextActionDate: row.next_action_date ?? null,
    businessId: syntheticBizId,
    businessName: bizName,
    businessColor: row.businesses?.colour ?? null,
  };
}

export { PIPELINE_WORKSPACE_BUSINESS_PREFIX } from '~/home/(user)/_lib/pipeline-constants';

const DEAL_SELECT =
  'id, contact_name, company_name, value, stage, next_action, next_action_date, business_id, account_id, businesses(name, colour), accounts(name)';

// ─── Loader ──────────────────────────────────────────────────────────

/** Personal pipeline: deals on any workspace the user belongs to, plus legacy owner-scoped businesses. */
export const loadPipelineData = cache(async (): Promise<PipelineData> => {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();
  const userId = user.id;

  const workspaceIds = await loadTeamAccountIdsForUser(client, userId);

  const bizIdSet = new Set<string>();
  for (const wid of workspaceIds) {
    const bids = await loadBusinessIdsForTeamAccount(client, wid);
    bids.forEach((id) => bizIdSet.add(id));
  }

  const { data: ownedBiz } = await client
    .from('businesses')
    .select('id')
    .eq('owner_id', userId);
  for (const row of ownedBiz ?? []) {
    const id = (row as { id: string }).id;
    if (id) bizIdSet.add(id);
  }

  const orParts: string[] = [];
  if (workspaceIds.length > 0) {
    orParts.push(`account_id.in.(${workspaceIds.join(',')})`);
  }
  const bizList = [...bizIdSet];
  if (bizList.length > 0) {
    orParts.push(`business_id.in.(${bizList.join(',')})`);
  }

  let deals: PipelineDeal[] = [];

  if (orParts.length > 0) {
    let dealsQuery = client
      .from('pipeline_deals')
      .select(DEAL_SELECT)
      .order('created_at', { ascending: false });

    dealsQuery =
      orParts.length === 1
        ? dealsQuery.or(orParts[0])
        : dealsQuery.or(orParts.join(','));

    const dealsResult = await dealsQuery;
    deals = (dealsResult.data ?? []).map((row) =>
      mapDealRow(row as PipelineDealRow),
    );
  }

  const legacyOwnedBiz = await client
    .from('businesses')
    .select('id, name, colour')
    .eq('owner_id', userId);

  const bizRowsMap = new Map<string, BusinessRow>();

  for (const row of legacyOwnedBiz.data ?? []) {
    const r = row as BusinessRow;
    bizRowsMap.set(r.id, r);
  }

  if (bizList.length > 0) {
    const { data: linkedBiz } = await client
      .from('businesses')
      .select('id, name, colour')
      .in('id', bizList);
    for (const row of linkedBiz ?? []) {
      const r = row as BusinessRow;
      bizRowsMap.set(r.id, r);
    }
  }

  const workspaces = await loadUserWorkspaceAccounts(client, userId);
  const workspaceTargets = workspaces.map((ws) => ({
    id: `${PIPELINE_WORKSPACE_BUSINESS_PREFIX}${ws.id}`,
    name: ws.name?.trim() || ws.slug?.trim() || 'Workspace',
    color: null as string | null,
  }));

  const legacyBusinesses = [...bizRowsMap.values()].map((row) => ({
    id: row.id,
    name: row.name ?? '',
    color: row.colour ?? null,
  }));

  const seen = new Set<string>();
  const businesses = [...workspaceTargets, ...legacyBusinesses].filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });

  return { deals, businesses };
});

/** Deals for a team workspace: account_id match or legacy business_id under this workspace. */
export const loadPipelineDataForAccount = cache(
  async (accountId: string): Promise<PipelineData> => {
    const client = getSupabaseServerClient();
    await requireUserInServerComponent();

    const businessIds = await loadBusinessIdsForTeamAccount(client, accountId);

    const orParts = [`account_id.eq.${accountId}`];
    if (businessIds.length > 0) {
      orParts.push(`business_id.in.(${businessIds.join(',')})`);
    }

    const dealsResult = await client
      .from('pipeline_deals')
      .select(DEAL_SELECT)
      .or(orParts.join(','))
      .order('created_at', { ascending: false });

    const deals: PipelineDeal[] = (dealsResult.data ?? []).map((row) =>
      mapDealRow(row as PipelineDealRow),
    );

    const bizRows: BusinessRow[] = [];

    if (businessIds.length > 0) {
      const { data } = await client
        .from('businesses')
        .select('id, name, colour')
        .in('id', businessIds);
      for (const row of data ?? []) {
        bizRows.push(row as BusinessRow);
      }
    }

    const { data: accountRow } = await client
      .from('accounts')
      .select('id, name')
      .eq('id', accountId)
      .maybeSingle();

    const synthetic: BusinessRow = {
      id: `${PIPELINE_WORKSPACE_BUSINESS_PREFIX}${accountId}`,
      name: (accountRow as { name?: string | null } | null)?.name ?? 'Workspace',
      colour: null,
    };

    const businesses = [
      {
        id: synthetic.id,
        name: synthetic.name ?? '',
        color: synthetic.colour ?? null,
      },
      ...bizRows.map((row) => ({
        id: row.id,
        name: row.name ?? '',
        color: row.colour ?? null,
      })),
    ];

    return { deals, businesses };
  },
);

// ─── Mutation: update deal stage ─────────────────────────────────────

export async function updateDealStage(dealId: string, newStage: string) {
  const client = getSupabaseServerClient();

  const { error } = await client
    .from('pipeline_deals')
    .update({ stage: newStage })
    .eq('id', dealId);

  if (error) throw error;
}
