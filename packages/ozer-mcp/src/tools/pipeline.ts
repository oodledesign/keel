import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { OzerMcpToolRegistrar } from './types';
import {
  assertSupabaseOk,
  dealDisplayName,
  loadUserAccountIds,
  pickDefined,
  toolJson,
} from './shared';

const listPipelineDealsSchema = z.object({
  stage: z.string().trim().optional(),
  business_id: z.string().uuid().optional(),
});

const updatePipelineDealSchema = z.object({
  id: z.string().uuid(),
  stage: z.string().trim().optional(),
  value: z.number().optional(),
});

type PipelineDealRow = {
  id: string;
  name?: string | null;
  contact_name?: string | null;
  company_name?: string | null;
  stage?: string | null;
  value?: number | null;
  client_org_id?: string | null;
  expected_close_date?: string | null;
  next_action_date?: string | null;
  account_id?: string | null;
  business_id?: string | null;
};

function mapPipelineDeal(row: PipelineDealRow) {
  return {
    id: row.id,
    name: dealDisplayName(row),
    stage: row.stage ?? null,
    value: row.value ?? null,
    client_org_id: row.client_org_id ?? null,
    expected_close_date:
      row.expected_close_date ?? row.next_action_date ?? null,
  };
}

const DEAL_SELECT =
  'id, name, contact_name, company_name, stage, value, next_action_date, account_id, business_id';

async function loadAccessibleDeal(
  supabase: SupabaseClient,
  userId: string,
  dealId: string,
): Promise<PipelineDealRow> {
  const accountIds = await loadUserAccountIds(supabase, userId);
  if (accountIds.length === 0) {
    throw new Error('Pipeline deal not found');
  }

  const { data, error } = await supabase
    .from('pipeline_deals')
    .select(DEAL_SELECT)
    .eq('id', dealId)
    .in('account_id', accountIds)
    .maybeSingle();

  assertSupabaseOk(data, error, 'get pipeline deal');

  if (!data) {
    throw new Error('Pipeline deal not found');
  }

  return data as PipelineDealRow;
}

export const registerPipelineTools: OzerMcpToolRegistrar = (server, context) => {
  const { supabase, userId } = context;

  server.registerTool(
    'list_pipeline_deals',
    {
      description:
        'List pipeline deals in workspaces the authenticated user belongs to.',
      inputSchema: listPipelineDealsSchema,
    },
    async (input) => {
      const accountIds = await loadUserAccountIds(supabase, userId);
      if (accountIds.length === 0) {
        return toolJson({ deals: [] });
      }

      let query = supabase
        .from('pipeline_deals')
        .select(DEAL_SELECT)
        .in('account_id', accountIds)
        .order('created_at', { ascending: false });

      if (input.stage) {
        query = query.eq('stage', input.stage);
      }
      if (input.business_id) {
        query = query.eq('business_id', input.business_id);
      }

      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list pipeline deals');

      return toolJson({ deals: (data ?? []).map(mapPipelineDeal) });
    },
  );

  server.registerTool(
    'update_pipeline_deal',
    {
      description:
        'Update a pipeline deal stage or value in a workspace the user can access.',
      inputSchema: updatePipelineDealSchema,
    },
    async (input) => {
      await loadAccessibleDeal(supabase, userId, input.id);

      const updates = pickDefined({
        stage: input.stage,
        value: input.value,
      });

      if (Object.keys(updates).length === 0) {
        throw new Error('Provide stage and/or value to update');
      }

      const accountIds = await loadUserAccountIds(supabase, userId);

      const { data, error } = await supabase
        .from('pipeline_deals')
        .update(updates)
        .eq('id', input.id)
        .in('account_id', accountIds)
        .select(DEAL_SELECT)
        .maybeSingle();

      assertSupabaseOk(data, error, 'update pipeline deal');

      if (!data) {
        throw new Error('Pipeline deal not found');
      }

      return toolJson({ deal: mapPipelineDeal(data as PipelineDealRow) });
    },
  );
};
