import { z } from 'zod';

import { filterNamedByQuery, loadSearchableClients } from './lookup';
import {
  OPEN_TASK_STATUSES,
  assertClientOrgAccess,
  assertSupabaseOk,
  dealDisplayName,
  loadUserWorkspaces,
  toolJson,
} from './shared';
import type { OzerMcpToolRegistrar } from './types';

const getClientSchema = z.object({
  id: z.string().uuid(),
});

const searchClientsSchema = z.object({
  q: z.string().trim().min(1).max(200).describe('CRM client name search.'),
  account_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

type ClientOrgRow = {
  id: string;
  name?: string | null;
  website?: string | null;
  status?: string | null;
  business_id?: string | null;
};

type TaskRow = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  project_id: string | null;
  area_id: string | null;
};

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
};

function mapClientOrg(row: ClientOrgRow) {
  return {
    id: row.id,
    name: row.name ?? null,
    website: row.website ?? null,
    status: row.status ?? null,
  };
}

function mapTask(row: TaskRow) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date,
    project_id: row.project_id,
    area_id: row.area_id,
  };
}

function mapDeal(row: PipelineDealRow, clientOrgId: string) {
  return {
    id: row.id,
    name: dealDisplayName(row),
    stage: row.stage ?? null,
    value: row.value ?? null,
    client_org_id: row.client_org_id ?? clientOrgId,
    expected_close_date:
      row.expected_close_date ?? row.next_action_date ?? null,
  };
}

export const registerClientTools: OzerMcpToolRegistrar = (server, context) => {
  const { supabase, userId } = context;

  server.registerTool(
    'search_clients',
    {
      description:
        'Fuzzy-search CRM clients (not portal client_orgs) by name across authorized workspaces. Returns id, name, and workspace. Use this when the user names a client before create_task, create_project, or extract_tasks. Do not search just to list current tasks.',
      inputSchema: searchClientsSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const accountIds = input.account_id
        ? workspaces.some((workspace) => workspace.id === input.account_id)
          ? [input.account_id]
          : []
        : workspaces.map((workspace) => workspace.id);

      if (accountIds.length === 0) {
        return toolJson({ clients: [] });
      }

      const matches = filterNamedByQuery(
        await loadSearchableClients(supabase, accountIds),
        input.q,
        input.limit,
      );
      const workspacesById = new Map(
        workspaces.map((workspace) => [workspace.id, workspace]),
      );

      return toolJson({
        clients: matches.map((match) => {
          const workspace = match.account_id
            ? workspacesById.get(match.account_id)
            : undefined;

          return {
            id: match.id,
            name: match.name,
            account_id: match.account_id,
            workspace_name: workspace?.name ?? null,
            workspace_slug: workspace?.slug ?? null,
          };
        }),
      });
    },
  );

  server.registerTool(
    'list_clients',
    {
      description:
        'List client portal organizations (client_orgs via client_members). These are not CRM clients and are not required before list_tasks. For current work across clients, call list_tasks with no client filter.',
      inputSchema: z.object({}),
    },
    async () => {
      const { data, error } = await supabase
        .from('client_members')
        .select('client_org_id, client_orgs(id, name, business_id)')
        .eq('user_id', userId);

      assertSupabaseOk(data, error, 'list clients');

      const clients = (data ?? [])
        .map((row) => {
          const org = (
            row as {
              client_orgs?: ClientOrgRow | ClientOrgRow[] | null;
            }
          ).client_orgs;

          const resolved = Array.isArray(org) ? org[0] : org;
          if (!resolved?.id) {
            return null;
          }

          return mapClientOrg(resolved);
        })
        .filter(
          (client): client is NonNullable<typeof client> => client !== null,
        );

      return toolJson({ clients });
    },
  );

  server.registerTool(
    'get_client',
    {
      description:
        'Get a client organization with open tasks and pipeline deals for the authenticated user.',
      inputSchema: getClientSchema,
    },
    async (input) => {
      await assertClientOrgAccess(supabase, userId, input.id);

      const { data: org, error: orgError } = await supabase
        .from('client_orgs')
        .select('id, name, business_id')
        .eq('id', input.id)
        .maybeSingle();

      assertSupabaseOk(org, orgError, 'get client org');

      if (!org) {
        throw new Error('Client org not found');
      }

      const clientOrg = org as ClientOrgRow;
      const accountId = clientOrg.business_id;

      const { data: linkedClients, error: linkedClientsError } = await supabase
        .from('clients')
        .select('id')
        .eq('client_org_id', input.id);

      assertSupabaseOk(
        linkedClients,
        linkedClientsError,
        'load linked clients',
      );

      const clientIds = (linkedClients ?? []).map(
        (row) => (row as { id: string }).id,
      );

      let tasks: TaskRow[] = [];

      if (clientIds.length > 0) {
        const { data: taskRows, error: tasksError } = await supabase
          .from('tasks')
          .select('id, title, status, priority, due_date, project_id, area_id')
          .eq('user_id', userId)
          .in('status', [...OPEN_TASK_STATUSES])
          .in('client_id', clientIds)
          .order('due_date', { ascending: true, nullsFirst: false });

        assertSupabaseOk(taskRows, tasksError, 'load client tasks');
        tasks = (taskRows ?? []) as TaskRow[];
      }

      let deals: PipelineDealRow[] = [];

      if (accountId) {
        const { data: dealRows, error: dealsError } = await supabase
          .from('pipeline_deals')
          .select(
            'id, name, contact_name, company_name, stage, value, next_action_date, client_org_id',
          )
          .eq('account_id', accountId)
          .eq('client_org_id', input.id);

        assertSupabaseOk(dealRows, dealsError, 'load client pipeline deals');
        deals = (dealRows ?? []) as PipelineDealRow[];
      }

      return toolJson({
        client: mapClientOrg(clientOrg),
        open_tasks: tasks.map(mapTask),
        pipeline_deals: deals.map((deal) => mapDeal(deal, input.id)),
      });
    },
  );
};
