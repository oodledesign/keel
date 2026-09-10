import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import {
  assertSupabaseOk,
  dealDisplayName,
  loadUserWorkspaces,
  pickDefined,
  toolJson,
} from './shared';
import type { OzerMcpToolRegistrar } from './types';

const PIPELINE_STAGES = [
  'lead',
  'qualified',
  'call_booked',
  'proposal_sent',
  'negotiation',
  'won',
  'lost',
  'shortlisted',
  'enquiry',
  'viewing',
  'negotiating',
  'under_offer',
  'signed',
  'idle',
  'discounted',
  'offer',
  'hots',
  'solicitors',
  'completed',
  'fell_through',
] as const;

const CLOSED_STAGES = [
  'won',
  'lost',
  'signed',
  'completed',
  'fell_through',
] as const;

const listPipelineDealsSchema = z.object({
  account_id: z
    .string()
    .uuid()
    .optional()
    .describe('Workspace id. Omit to list deals across authorized workspaces.'),
  stage: z.string().trim().optional(),
  business_id: z.string().uuid().optional(),
  include_closed: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'When false (default), hide won/lost/completed/signed/fell_through.',
    ),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

const getPipelineDealSchema = z.object({
  id: z.string().uuid(),
});

const updatePipelineDealSchema = z.object({
  id: z.string().uuid(),
  stage: z
    .enum(PIPELINE_STAGES)
    .optional()
    .describe('Safe stage move only. Does not change deal value.'),
  next_action_date: z
    .string()
    .trim()
    .nullable()
    .optional()
    .describe('YYYY-MM-DD or null to clear.'),
  notes: z
    .string()
    .trim()
    .nullable()
    .optional()
    .describe('Stored as pipeline next_action text. Not a money field.'),
});

type PipelineDealRow = {
  id: string;
  name?: string | null;
  contact_name?: string | null;
  company_name?: string | null;
  stage?: string | null;
  value?: number | null;
  client_org_id?: string | null;
  client_id?: string | null;
  expected_close_date?: string | null;
  next_action?: string | null;
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
    notes: row.next_action ?? null,
    client_org_id: row.client_org_id ?? null,
    client_id: row.client_id ?? null,
    expected_close_date: row.expected_close_date ?? null,
    next_action_date: row.next_action_date ?? null,
    account_id: row.account_id ?? null,
    business_id: row.business_id ?? null,
  };
}

const DEAL_SELECT =
  'id, name, contact_name, company_name, stage, value, next_action, next_action_date, account_id, business_id, client_id';

async function loadAccessibleDeal(
  supabase: SupabaseClient,
  accountIds: string[],
  dealId: string,
): Promise<PipelineDealRow> {
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

export const registerPipelineTools: OzerMcpToolRegistrar = (
  server,
  context,
) => {
  const { supabase, userId } = context;

  server.registerTool(
    'list_pipeline_deals',
    {
      description:
        'List pipeline deals in authorized workspaces. Defaults to open stages (excludes won/lost/completed). Pass stage or account_id only when the user asks. Does not change values.',
      inputSchema: listPipelineDealsSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const accountIds = input.account_id
        ? workspaces.some((workspace) => workspace.id === input.account_id)
          ? [input.account_id]
          : []
        : workspaces.map((workspace) => workspace.id);

      if (accountIds.length === 0) {
        return toolJson({ deals: [] });
      }

      let query = supabase
        .from('pipeline_deals')
        .select(DEAL_SELECT)
        .in('account_id', accountIds)
        .order('updated_at', { ascending: false })
        .limit(input.limit);

      if (input.stage) {
        query = query.eq('stage', input.stage);
      } else if (!input.include_closed) {
        query = query.not('stage', 'in', `(${CLOSED_STAGES.join(',')})`);
      }
      if (input.business_id) {
        query = query.eq('business_id', input.business_id);
      }

      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list pipeline deals');

      return toolJson({
        deals: (data ?? []).map((row) =>
          mapPipelineDeal(row as PipelineDealRow),
        ),
      });
    },
  );

  server.registerTool(
    'get_pipeline_deal',
    {
      description:
        'Get one pipeline deal by id (name, stage, next action, value). Read-only.',
      inputSchema: getPipelineDealSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const deal = await loadAccessibleDeal(
        supabase,
        workspaces.map((workspace) => workspace.id),
        input.id,
      );

      return toolJson({ deal: mapPipelineDeal(deal) });
    },
  );

  const updateDeal = async (
    input: z.infer<typeof updatePipelineDealSchema>,
  ) => {
    const workspaces = await loadUserWorkspaces(supabase, userId);
    const accountIds = workspaces.map((workspace) => workspace.id);
    await loadAccessibleDeal(supabase, accountIds, input.id);

    const updates = pickDefined({
      stage: input.stage,
      next_action_date: input.next_action_date,
      next_action: input.notes,
    });

    if (Object.keys(updates).length === 0) {
      throw new Error('Provide stage, next_action_date, and/or notes');
    }

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
  };

  // update_deal is the Phase 2 name; keep update_pipeline_deal as an alias.
  server.registerTool(
    'update_deal',
    {
      description:
        'Update a pipeline deal with safe fields only: stage, next_action_date, notes. Does not change value, delete the deal, or edit money fields.',
      inputSchema: updatePipelineDealSchema,
    },
    updateDeal,
  );

  server.registerTool(
    'update_pipeline_deal',
    {
      description:
        'Same as update_deal. Safe fields only: stage, next_action_date, notes. Does not change deal value.',
      inputSchema: updatePipelineDealSchema,
    },
    updateDeal,
  );
};
