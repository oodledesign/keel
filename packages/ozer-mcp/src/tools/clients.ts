import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import {
  type ClientNameRow,
  clientDisplayName,
  filterNamedByQuery,
  loadSearchableClients,
  requireWorkspaceAccess,
  resolveClientStoredDisplayName,
} from './lookup';
import {
  type McpWorkspace,
  OPEN_TASK_STATUSES,
  assertClientOrgAccess,
  assertSupabaseOk,
  dealDisplayName,
  isMissingColumnError,
  isMissingRelationError,
  loadUserWorkspaces,
  pickDefined,
  throwSupabaseError,
  toolJson,
  writeWithOptionalColumns,
} from './shared';
import type { OzerMcpToolRegistrar } from './types';

const clientTypeSchema = z.enum(['individual', 'business']);
const commercialRoleSchema = z.enum([
  'landlord',
  'tenant',
  'investor',
  'solicitor',
  'agent',
  'other',
]);

const searchClientsSchema = z.object({
  q: z.string().trim().min(1).max(200).describe('CRM client name search.'),
  account_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

const listClientsSchema = z.object({
  account_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      'Workspace id. Omit to list CRM clients across authorized workspaces.',
    ),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

const getClientSchema = z.object({
  id: z
    .string()
    .uuid()
    .describe('CRM client id from search_clients or list_clients.'),
});

const createClientSchema = z.object({
  account_id: z.string().uuid().describe('Workspace from list_workspaces.'),
  client_type: clientTypeSchema.optional().default('business'),
  company_name: z
    .string()
    .trim()
    .optional()
    .describe('Required for business clients.'),
  first_name: z
    .string()
    .trim()
    .optional()
    .describe('Required for individual clients.'),
  last_name: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  website: z.string().trim().optional(),
  city: z.string().trim().optional(),
  address_line_1: z.string().trim().optional(),
  address_line_2: z.string().trim().optional(),
  postcode: z.string().trim().optional(),
  country: z.string().trim().optional(),
  commercial_role: commercialRoleSchema.optional(),
});

const updateClientSchema = z.object({
  id: z.string().uuid(),
  client_type: clientTypeSchema.optional(),
  company_name: z.string().trim().nullable().optional(),
  first_name: z.string().trim().nullable().optional(),
  last_name: z.string().trim().nullable().optional(),
  email: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  website: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  address_line_1: z.string().trim().nullable().optional(),
  address_line_2: z.string().trim().nullable().optional(),
  postcode: z.string().trim().nullable().optional(),
  country: z.string().trim().nullable().optional(),
  commercial_role: commercialRoleSchema.nullable().optional(),
});

const getClientOrgSchema = z.object({
  id: z.string().uuid(),
});

export const CRM_CLIENT_SELECT =
  'id, display_name, first_name, last_name, company_name, email, phone, website, city, address_line_1, address_line_2, postcode, country, client_type, commercial_role, account_id, created_at, updated_at, archived_at';

const CRM_CLIENT_SELECT_LEGACY =
  'id, display_name, first_name, last_name, company_name, email, phone, website, city, address_line_1, address_line_2, postcode, country, client_type, commercial_role, account_id, created_at, updated_at';

export type CrmClientRow = ClientNameRow & {
  phone?: string | null;
  city?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  postcode?: string | null;
  country?: string | null;
  commercial_role?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  archived_at?: string | null;
};

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

type LinkedContactRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: boolean;
};

export function mapCrmClient(
  row: CrmClientRow,
  extras?: {
    workspace_name?: string | null;
    workspace_slug?: string | null;
  },
) {
  return {
    id: row.id,
    name: clientDisplayName(row),
    client_type: row.client_type ?? null,
    company_name: row.company_name ?? null,
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    website: row.website ?? null,
    city: row.city ?? null,
    address_line_1: row.address_line_1 ?? null,
    address_line_2: row.address_line_2 ?? null,
    postcode: row.postcode ?? null,
    country: row.country ?? null,
    commercial_role: row.commercial_role ?? null,
    account_id: row.account_id ?? null,
    workspace_name: extras?.workspace_name ?? null,
    workspace_slug: extras?.workspace_slug ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

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

export function buildCrmClientWritePayload(input: {
  clientType: 'individual' | 'business';
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  city?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  postcode?: string | null;
  country?: string | null;
  commercial_role?: string | null;
}) {
  const firstName =
    input.clientType === 'individual' ? input.firstName?.trim() || null : null;
  const lastName =
    input.clientType === 'individual' ? input.lastName?.trim() || null : null;
  const companyName =
    input.clientType === 'business' ? input.companyName?.trim() || null : null;

  return {
    client_type: input.clientType,
    first_name: firstName,
    last_name: lastName,
    company_name: companyName,
    display_name: resolveClientStoredDisplayName({
      clientType: input.clientType,
      companyName,
      firstName,
      lastName,
    }),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    website: input.website?.trim() || null,
    city: input.city?.trim() || null,
    address_line_1: input.address_line_1?.trim() || null,
    address_line_2: input.address_line_2?.trim() || null,
    postcode: input.postcode?.trim() || null,
    country: input.country?.trim() || null,
    commercial_role: input.commercial_role ?? null,
  };
}

function workspaceExtras(
  workspaces: McpWorkspace[],
  accountId: string | null | undefined,
) {
  const workspace = accountId
    ? workspaces.find((item) => item.id === accountId)
    : undefined;

  return {
    workspace_name: workspace?.name ?? null,
    workspace_slug: workspace?.slug ?? null,
  };
}

async function selectCrmClients(
  supabase: SupabaseClient,
  accountIds: string[],
) {
  const withArchive = await supabase
    .from('clients')
    .select(CRM_CLIENT_SELECT)
    .in('account_id', accountIds)
    .is('archived_at', null)
    .order('display_name', { ascending: true, nullsFirst: false });

  if (!withArchive.error) {
    return (withArchive.data ?? []) as CrmClientRow[];
  }

  if (!isMissingColumnError(withArchive.error)) {
    throwSupabaseError('list CRM clients', withArchive.error);
  }

  const legacy = await supabase
    .from('clients')
    .select(CRM_CLIENT_SELECT_LEGACY)
    .in('account_id', accountIds)
    .order('display_name', { ascending: true, nullsFirst: false });

  assertSupabaseOk(legacy.data, legacy.error, 'list CRM clients');
  return (legacy.data ?? []) as CrmClientRow[];
}

async function loadCrmClientRow(
  supabase: SupabaseClient,
  id: string,
): Promise<CrmClientRow> {
  const withArchive = await supabase
    .from('clients')
    .select(CRM_CLIENT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (withArchive.error && isMissingColumnError(withArchive.error)) {
    const legacy = await supabase
      .from('clients')
      .select(CRM_CLIENT_SELECT_LEGACY)
      .eq('id', id)
      .maybeSingle();

    assertSupabaseOk(legacy.data, legacy.error, 'get CRM client');
    if (!legacy.data) {
      throw new Error('Client not found');
    }

    return legacy.data as CrmClientRow;
  }

  assertSupabaseOk(withArchive.data, withArchive.error, 'get CRM client');
  if (!withArchive.data) {
    throw new Error('Client not found');
  }

  return withArchive.data as CrmClientRow;
}

async function loadLinkedContacts(
  supabase: SupabaseClient,
  clientId: string,
): Promise<LinkedContactRow[]> {
  const junction = await supabase
    .from('client_contacts')
    .select(
      'role, is_primary, contacts ( id, full_name, first_name, last_name, email, phone )',
    )
    .eq('client_id', clientId)
    .order('is_primary', { ascending: false });

  if (!junction.error) {
    return (
      (junction.data ?? []) as Array<{
        role?: string | null;
        is_primary?: boolean | null;
        contacts?:
          | {
              id?: string | null;
              full_name?: string | null;
              first_name?: string | null;
              last_name?: string | null;
              email?: string | null;
              phone?: string | null;
            }
          | Array<{
              id?: string | null;
              full_name?: string | null;
              first_name?: string | null;
              last_name?: string | null;
              email?: string | null;
              phone?: string | null;
            }>
          | null;
      }>
    )
      .map((row) => {
        const contact = Array.isArray(row.contacts)
          ? row.contacts[0]
          : row.contacts;
        if (!contact?.id) {
          return null;
        }

        return {
          id: contact.id,
          name: clientDisplayName({
            id: contact.id,
            first_name: contact.first_name,
            last_name: contact.last_name,
            display_name: contact.full_name,
          }),
          email: contact.email ?? null,
          phone: contact.phone ?? null,
          role: row.role ?? null,
          is_primary: Boolean(row.is_primary),
        };
      })
      .filter((row): row is LinkedContactRow => row !== null);
  }

  if (
    !isMissingRelationError(junction.error) &&
    !isMissingColumnError(junction.error)
  ) {
    throwSupabaseError('load client contacts', junction.error);
  }

  const legacy = await supabase
    .from('contacts')
    .select(
      'id, full_name, first_name, last_name, email, phone, role, is_primary',
    )
    .eq('client_id', clientId)
    .order('is_primary', { ascending: false });

  if (legacy.error) {
    return [];
  }

  return (
    (legacy.data ?? []) as Array<{
      id: string;
      full_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      phone?: string | null;
      role?: string | null;
      is_primary?: boolean | null;
    }>
  ).map((row) => ({
    id: row.id,
    name: clientDisplayName({
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      display_name: row.full_name,
    }),
    email: row.email ?? null,
    phone: row.phone ?? null,
    role: row.role ?? null,
    is_primary: Boolean(row.is_primary),
  }));
}

async function maybeCreatePrimaryContact(
  supabase: SupabaseClient,
  userId: string,
  input: {
    accountId: string;
    clientId: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  },
) {
  const fullName = [input.firstName, input.lastName]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ');

  const contact = await writeWithOptionalColumns<{ id?: string }>(
    (row) => supabase.from('contacts').insert(row).select('id').single(),
    {
      account_id: input.accountId,
      user_id: userId,
      client_id: input.clientId,
      first_name: input.firstName,
      last_name: input.lastName,
      full_name: fullName,
      email: input.email,
      phone: input.phone,
    },
    'create client contact',
  );

  const contactId = contact.id;
  if (!contactId) {
    return;
  }

  const link = await supabase.from('client_contacts').insert({
    client_id: input.clientId,
    contact_id: contactId,
    is_primary: true,
  });

  if (link.error && !isMissingRelationError(link.error)) {
    assertSupabaseOk(link.data, link.error, 'link client contact');
  }
}

export const registerClientTools: OzerMcpToolRegistrar = (server, context) => {
  const { supabase, userId } = context;

  server.registerTool(
    'search_clients',
    {
      description:
        'Fuzzy-search CRM clients (public.clients — not portal client_orgs) by name across authorized workspaces. Returns id, name, email, type, and workspace. Use this when the user names a client before create_client, create_contact, create_task, create_project, or extract_tasks. Do not invent extra filters.',
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
            client_type: match.row.client_type ?? null,
            company_name: match.row.company_name ?? null,
            email: match.row.email ?? null,
            phone: match.row.phone ?? null,
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
        'List CRM clients (public.clients) in authorized workspaces. These are not portal client_orgs — use list_client_orgs for portal orgs. Do not pass account_id unless the user names a workspace. Use search_clients when the user names a client.',
      inputSchema: listClientsSchema,
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

      const rows = (await selectCrmClients(supabase, accountIds)).slice(
        0,
        input.limit,
      );

      return toolJson({
        clients: rows.map((row) =>
          mapCrmClient(row, workspaceExtras(workspaces, row.account_id)),
        ),
      });
    },
  );

  server.registerTool(
    'get_client',
    {
      description:
        'Get one CRM client by id with workspace name, linked contacts, and outstanding tasks. Use search_clients when the user names a client. For portal orgs use get_client_org.',
      inputSchema: getClientSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const client = await loadCrmClientRow(supabase, input.id);
      const accountId = client.account_id;
      if (
        !accountId ||
        !workspaces.some((workspace) => workspace.id === accountId)
      ) {
        throw new Error('Client not found');
      }

      if (client.archived_at) {
        throw new Error('Client not found');
      }

      const [contacts, taskResult] = await Promise.all([
        loadLinkedContacts(supabase, input.id),
        supabase
          .from('tasks')
          .select('id, title, status, priority, due_date, project_id, area_id')
          .eq('client_id', input.id)
          .in('status', [...OPEN_TASK_STATUSES])
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(20),
      ]);

      assertSupabaseOk(taskResult.data, taskResult.error, 'load client tasks');

      return toolJson({
        client: mapCrmClient(client, workspaceExtras(workspaces, accountId)),
        contacts,
        open_tasks: ((taskResult.data ?? []) as TaskRow[]).map(mapTask),
      });
    },
  );

  server.registerTool(
    'create_client',
    {
      description:
        'Create a CRM client (public.clients) in a workspace. account_id is required. Business clients need company_name; individuals need first_name. Call search_clients first when the user names an existing client. Cannot delete clients. Does not create portal client_orgs.',
      inputSchema: createClientSchema,
    },
    async (input) => {
      const workspaces = await requireWorkspaceAccess(
        supabase,
        userId,
        input.account_id,
      );
      const clientType = input.client_type ?? 'business';
      if (clientType === 'individual' && !input.first_name?.trim()) {
        throw new Error('first_name is required for individual clients');
      }
      if (clientType === 'business' && !input.company_name?.trim()) {
        throw new Error('company_name is required for business clients');
      }
      const payload = buildCrmClientWritePayload({
        clientType,
        companyName: input.company_name,
        firstName: input.first_name,
        lastName: input.last_name,
        email: input.email,
        phone: input.phone,
        website: input.website,
        city: input.city,
        address_line_1: input.address_line_1,
        address_line_2: input.address_line_2,
        postcode: input.postcode,
        country: input.country,
        commercial_role: input.commercial_role,
      });

      const created = await writeWithOptionalColumns<CrmClientRow>(
        (row) =>
          supabase
            .from('clients')
            .insert(row)
            .select(CRM_CLIENT_SELECT_LEGACY)
            .single(),
        {
          account_id: input.account_id,
          created_by: userId,
          ...payload,
        },
        'create client',
      );

      const row = created;
      if (clientType === 'individual' && payload.first_name) {
        await maybeCreatePrimaryContact(supabase, userId, {
          accountId: input.account_id,
          clientId: row.id,
          firstName: payload.first_name,
          lastName: payload.last_name,
          email: payload.email,
          phone: payload.phone,
        });
      }

      return toolJson({
        client: mapCrmClient(
          row,
          workspaceExtras(workspaces, input.account_id),
        ),
      });
    },
  );

  server.registerTool(
    'update_client',
    {
      description:
        'Patch a CRM client the user can access. Only provided fields change. Recalculates display name from type/name fields. Cannot delete or archive a client.',
      inputSchema: updateClientSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const existing = await loadCrmClientRow(supabase, input.id);
      const accountId = existing.account_id;
      if (
        !accountId ||
        !workspaces.some((workspace) => workspace.id === accountId)
      ) {
        throw new Error('Client not found');
      }

      const clientType =
        input.client_type ??
        (existing.client_type === 'individual' ? 'individual' : 'business');

      if (clientType === 'individual') {
        const firstName = (
          input.first_name !== undefined
            ? input.first_name
            : existing.first_name
        )?.trim();
        if (!firstName) {
          throw new Error('first_name is required for individual clients');
        }
      } else {
        const companyName = (
          input.company_name !== undefined
            ? input.company_name
            : existing.company_name
        )?.trim();
        if (!companyName) {
          throw new Error('company_name is required for business clients');
        }
      }

      const nameTouched =
        input.client_type !== undefined ||
        input.company_name !== undefined ||
        input.first_name !== undefined ||
        input.last_name !== undefined;

      const identity = nameTouched
        ? buildCrmClientWritePayload({
            clientType,
            companyName:
              input.company_name !== undefined
                ? input.company_name
                : existing.company_name,
            firstName:
              input.first_name !== undefined
                ? input.first_name
                : existing.first_name,
            lastName:
              input.last_name !== undefined
                ? input.last_name
                : existing.last_name,
          })
        : null;

      const updates = pickDefined({
        ...(identity
          ? {
              client_type: identity.client_type,
              first_name: identity.first_name,
              last_name: identity.last_name,
              company_name: identity.company_name,
              display_name: identity.display_name,
            }
          : {}),
        email: input.email,
        phone: input.phone,
        website: input.website,
        city: input.city,
        address_line_1: input.address_line_1,
        address_line_2: input.address_line_2,
        postcode: input.postcode,
        country: input.country,
        commercial_role: input.commercial_role,
      });

      if (Object.keys(updates).length === 0) {
        throw new Error('Provide at least one field to update');
      }

      const updated = await writeWithOptionalColumns<CrmClientRow>(
        (row) =>
          supabase
            .from('clients')
            .update(row)
            .eq('id', input.id)
            .eq('account_id', accountId)
            .select(CRM_CLIENT_SELECT_LEGACY)
            .maybeSingle(),
        updates,
        'update client',
      );

      return toolJson({
        client: mapCrmClient(updated, workspaceExtras(workspaces, accountId)),
      });
    },
  );

  server.registerTool(
    'list_client_orgs',
    {
      description:
        'List client portal organizations (client_orgs via client_members). These are not CRM clients. Prefer list_clients or search_clients for CRM work.',
      inputSchema: z.object({}),
    },
    async () => {
      const { data, error } = await supabase
        .from('client_members')
        .select('client_org_id, client_orgs(id, name, business_id)')
        .eq('user_id', userId);

      assertSupabaseOk(data, error, 'list client orgs');

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

      return toolJson({ client_orgs: clients });
    },
  );

  server.registerTool(
    'get_client_org',
    {
      description:
        'Get a portal client organization (client_orgs) with open tasks and pipeline deals. For CRM clients use get_client.',
      inputSchema: getClientOrgSchema,
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
        client_org: mapClientOrg(clientOrg),
        open_tasks: tasks.map(mapTask),
        pipeline_deals: deals.map((deal) => mapDeal(deal, input.id)),
      });
    },
  );
};
