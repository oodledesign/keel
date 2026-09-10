import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import {
  type ContactNameRow,
  assertClientInWorkspace,
  clientDisplayName,
  composeContactFullName,
  contactDisplayName,
  filterContactsByQuery,
  loadLinkedNames,
  loadSearchableContacts,
  requireWorkspaceAccess,
} from './lookup';
import {
  type McpWorkspace,
  assertSupabaseOk,
  isMissingColumnError,
  isMissingRelationError,
  loadUserWorkspaces,
  pickDefined,
  toolJson,
  writeWithOptionalColumns,
} from './shared';
import type { OzerMcpToolRegistrar } from './types';

const searchContactsSchema = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe('Name, email, company, or industry search.'),
  account_id: z.string().uuid().optional(),
  client_id: z
    .string()
    .uuid()
    .optional()
    .describe('Only pass when the user names a specific CRM client.'),
  industry: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional()
    .describe(
      'Only pass when the user names an industry. Uses contacts.industry.',
    ),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

const listContactsSchema = z.object({
  account_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      'Workspace id. Omit to list contacts across authorized workspaces.',
    ),
  client_id: z
    .string()
    .uuid()
    .optional()
    .describe('Only pass when the user names a specific CRM client.'),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

const getContactSchema = z.object({
  id: z.string().uuid(),
});

const createContactSchema = z.object({
  account_id: z.string().uuid().describe('Workspace from list_workspaces.'),
  first_name: z.string().trim().optional(),
  last_name: z.string().trim().optional(),
  full_name: z
    .string()
    .trim()
    .optional()
    .describe('Use when first/last are not split.'),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  company_name: z.string().trim().optional(),
  industry: z
    .string()
    .trim()
    .optional()
    .describe('Optional contacts.industry value. Do not invent categories.'),
  client_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      'Link to a CRM client. Use search_clients when the user names one.',
    ),
  role: z
    .string()
    .trim()
    .optional()
    .describe('Per-client role on client_contacts (founder, finance, ops, …).'),
  is_primary: z.boolean().optional().default(false),
});

const updateContactSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string().trim().optional(),
  last_name: z.string().trim().nullable().optional(),
  full_name: z.string().trim().optional(),
  email: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  company_name: z.string().trim().nullable().optional(),
  industry: z.string().trim().nullable().optional(),
  client_id: z
    .string()
    .uuid()
    .optional()
    .describe('Link this contact to a CRM client if not already linked.'),
  role: z.string().trim().nullable().optional(),
});

export const CONTACT_SELECT =
  'id, full_name, first_name, last_name, email, phone, company_name, industry, account_id, client_id, created_at, updated_at';

const CONTACT_SELECT_LEGACY =
  'id, full_name, first_name, last_name, email, phone, account_id, client_id, created_at, updated_at';

export type ContactRow = ContactNameRow & {
  created_at?: string | null;
  updated_at?: string | null;
};

type ContactClientLink = {
  client_id: string;
  client_name: string | null;
  role: string | null;
  is_primary: boolean;
};

type ContactCategory = {
  id: string;
  name: string | null;
};

export function splitContactName(fullName: string): {
  firstName: string;
  lastName: string | null;
} {
  const trimmed = fullName.trim();
  const space = trimmed.indexOf(' ');
  if (space <= 0) {
    return { firstName: trimmed, lastName: null };
  }

  return {
    firstName: trimmed.slice(0, space).trim(),
    lastName: trimmed.slice(space + 1).trim() || null,
  };
}

export function resolveContactNameParts(input: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}) {
  const fullName = composeContactFullName(input);
  if (input.firstName?.trim()) {
    return {
      firstName: input.firstName.trim(),
      lastName: input.lastName?.trim() || null,
      fullName,
    };
  }

  const split = splitContactName(fullName);
  return {
    firstName: split.firstName,
    lastName: split.lastName,
    fullName,
  };
}

export function mapContact(
  row: ContactRow,
  extras?: {
    workspace_name?: string | null;
    workspace_slug?: string | null;
    clients?: ContactClientLink[];
    categories?: ContactCategory[];
  },
) {
  return {
    id: row.id,
    name: contactDisplayName(row),
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    company_name: row.company_name ?? null,
    industry: row.industry ?? null,
    account_id: row.account_id ?? null,
    workspace_name: extras?.workspace_name ?? null,
    workspace_slug: extras?.workspace_slug ?? null,
    clients: extras?.clients ?? [],
    categories: extras?.categories ?? [],
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
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

async function loadContactRow(
  supabase: SupabaseClient,
  id: string,
): Promise<ContactRow> {
  const withIndustry = await supabase
    .from('contacts')
    .select(CONTACT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (withIndustry.error && isMissingColumnError(withIndustry.error)) {
    const legacy = await supabase
      .from('contacts')
      .select(CONTACT_SELECT_LEGACY)
      .eq('id', id)
      .maybeSingle();

    assertSupabaseOk(legacy.data, legacy.error, 'get contact');
    if (!legacy.data) {
      throw new Error('Contact not found');
    }

    return legacy.data as ContactRow;
  }

  assertSupabaseOk(withIndustry.data, withIndustry.error, 'get contact');
  if (!withIndustry.data) {
    throw new Error('Contact not found');
  }

  return withIndustry.data as ContactRow;
}

async function loadContactClientLinks(
  supabase: SupabaseClient,
  contactId: string,
  fallbackClientId?: string | null,
): Promise<ContactClientLink[]> {
  const junction = await supabase
    .from('client_contacts')
    .select('client_id, role, is_primary')
    .eq('contact_id', contactId);

  let clientIds: Array<{
    client_id: string;
    role: string | null;
    is_primary: boolean;
  }> = [];

  if (!junction.error) {
    clientIds = (
      (junction.data ?? []) as Array<{
        client_id: string;
        role?: string | null;
        is_primary?: boolean | null;
      }>
    ).map((row) => ({
      client_id: row.client_id,
      role: row.role ?? null,
      is_primary: Boolean(row.is_primary),
    }));
  } else if (
    !isMissingRelationError(junction.error) &&
    !isMissingColumnError(junction.error)
  ) {
    assertSupabaseOk(junction.data, junction.error, 'load contact clients');
  } else if (fallbackClientId) {
    clientIds = [
      { client_id: fallbackClientId, role: null, is_primary: false },
    ];
  }

  if (clientIds.length === 0 && fallbackClientId) {
    clientIds = [
      { client_id: fallbackClientId, role: null, is_primary: false },
    ];
  }

  if (clientIds.length === 0) {
    return [];
  }

  const names = await loadLinkedNames(
    supabase,
    clientIds.map((row) => ({
      id: row.client_id,
      client_id: row.client_id,
    })),
  );

  return clientIds.map((row) => ({
    client_id: row.client_id,
    client_name: names.get(row.client_id)?.client_name ?? null,
    role: row.role,
    is_primary: row.is_primary,
  }));
}

async function loadContactCategories(
  supabase: SupabaseClient,
  contactId: string,
): Promise<ContactCategory[]> {
  const result = await supabase
    .from('campaign_contact_category_assignments')
    .select(
      'category_id, campaign_contact_categories ( id, name, archived_at )',
    )
    .eq('contact_id', contactId);

  if (result.error) {
    return [];
  }

  return (
    (result.data ?? []) as Array<{
      category_id?: string | null;
      campaign_contact_categories?:
        | {
            id?: string | null;
            name?: string | null;
            archived_at?: string | null;
          }
        | Array<{
            id?: string | null;
            name?: string | null;
            archived_at?: string | null;
          }>
        | null;
    }>
  )
    .map((row) => {
      const category = Array.isArray(row.campaign_contact_categories)
        ? row.campaign_contact_categories[0]
        : row.campaign_contact_categories;
      if (!category?.id || category.archived_at) {
        return null;
      }

      return {
        id: category.id,
        name: category.name ?? null,
      };
    })
    .filter((row): row is ContactCategory => row !== null);
}

async function linkContactToClient(
  supabase: SupabaseClient,
  input: {
    contactId: string;
    clientId: string;
    role?: string | null;
    isPrimary?: boolean;
  },
) {
  const link = await supabase.from('client_contacts').insert({
    client_id: input.clientId,
    contact_id: input.contactId,
    role: input.role?.trim() || null,
    is_primary: input.isPrimary ?? false,
  });

  if (!link.error) {
    return;
  }

  if (isMissingRelationError(link.error)) {
    const legacy = await supabase
      .from('contacts')
      .update({
        client_id: input.clientId,
        role: input.role?.trim() || null,
        is_primary: input.isPrimary ?? false,
      })
      .eq('id', input.contactId);

    assertSupabaseOk(legacy.data, legacy.error, 'link contact to client');
    return;
  }

  if (/duplicate|unique/i.test(link.error.message ?? '')) {
    if (input.role !== undefined) {
      await supabase
        .from('client_contacts')
        .update({
          role: input.role?.trim() || null,
        })
        .eq('client_id', input.clientId)
        .eq('contact_id', input.contactId);
    }
    return;
  }

  assertSupabaseOk(link.data, link.error, 'link contact to client');
}

async function filterRowsByClient(
  supabase: SupabaseClient,
  rows: Array<SearchableNamedContact>,
  clientId: string,
): Promise<Array<SearchableNamedContact>> {
  const junction = await supabase
    .from('client_contacts')
    .select('contact_id')
    .eq('client_id', clientId);

  if (!junction.error) {
    const ids = new Set(
      ((junction.data ?? []) as Array<{ contact_id: string }>).map(
        (row) => row.contact_id,
      ),
    );
    return rows.filter(
      (row) => ids.has(row.id) || row.row.client_id === clientId,
    );
  }

  return rows.filter((row) => row.row.client_id === clientId);
}

type SearchableNamedContact = {
  id: string;
  name: string;
  account_id: string | null;
  row: ContactNameRow;
};

export const registerContactTools: OzerMcpToolRegistrar = (server, context) => {
  const { supabase, userId } = context;

  server.registerTool(
    'search_contacts',
    {
      description:
        'Search CRM contacts (public.contacts — people, not portal client_orgs or CRM clients) by name, email, company, or industry. Use this before create_contact when the user names someone. Pass client_id or industry only when the user names those. Do not invent category filters.',
      inputSchema: searchContactsSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const accountIds = input.account_id
        ? workspaces.some((workspace) => workspace.id === input.account_id)
          ? [input.account_id]
          : []
        : workspaces.map((workspace) => workspace.id);

      if (accountIds.length === 0) {
        return toolJson({ contacts: [] });
      }

      let matches = filterContactsByQuery(
        await loadSearchableContacts(supabase, accountIds),
        input.q,
        200,
      );

      if (input.industry) {
        const needle = input.industry.trim().toLowerCase();
        matches = matches.filter((match) =>
          (match.row.industry ?? '').toLowerCase().includes(needle),
        );
      }

      if (input.client_id) {
        matches = await filterRowsByClient(supabase, matches, input.client_id);
      }

      matches = matches.slice(0, input.limit);
      const workspacesById = new Map(
        workspaces.map((workspace) => [workspace.id, workspace]),
      );

      return toolJson({
        contacts: matches.map((match) => {
          const workspace = match.account_id
            ? workspacesById.get(match.account_id)
            : undefined;

          return {
            id: match.id,
            name: match.name,
            email: match.row.email ?? null,
            phone: match.row.phone ?? null,
            company_name: match.row.company_name ?? null,
            industry: match.row.industry ?? null,
            account_id: match.account_id,
            workspace_name: workspace?.name ?? null,
            workspace_slug: workspace?.slug ?? null,
          };
        }),
      });
    },
  );

  server.registerTool(
    'list_contacts',
    {
      description:
        'List CRM contacts in authorized workspaces. Optional client_id only when the user names a client (use search_clients first). Prefer search_contacts when looking up a person by name.',
      inputSchema: listContactsSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const accountIds = input.account_id
        ? workspaces.some((workspace) => workspace.id === input.account_id)
          ? [input.account_id]
          : []
        : workspaces.map((workspace) => workspace.id);

      if (accountIds.length === 0) {
        return toolJson({ contacts: [] });
      }

      let rows = await loadSearchableContacts(supabase, accountIds);
      if (input.client_id) {
        rows = await filterRowsByClient(supabase, rows, input.client_id);
      }

      rows = rows
        .sort((left, right) => left.name.localeCompare(right.name))
        .slice(0, input.limit);

      return toolJson({
        contacts: rows.map((row) =>
          mapContact(row.row, workspaceExtras(workspaces, row.account_id)),
        ),
      });
    },
  );

  server.registerTool(
    'get_contact',
    {
      description:
        'Get one CRM contact by id with workspace name, linked CRM clients, industry, and campaign category names when those tables exist. Does not invent fields.',
      inputSchema: getContactSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const contact = await loadContactRow(supabase, input.id);
      const accountId = contact.account_id;
      if (
        !accountId ||
        !workspaces.some((workspace) => workspace.id === accountId)
      ) {
        throw new Error('Contact not found');
      }

      const [clients, categories] = await Promise.all([
        loadContactClientLinks(supabase, contact.id, contact.client_id),
        loadContactCategories(supabase, contact.id),
      ]);

      return toolJson({
        contact: mapContact(contact, {
          ...workspaceExtras(workspaces, accountId),
          clients,
          categories,
        }),
      });
    },
  );

  server.registerTool(
    'create_contact',
    {
      description:
        'Create a CRM contact (person) in a workspace. Search with search_contacts first when the user names someone. Optional client_id links via client_contacts — use search_clients for the client. industry is contacts.industry; do not invent category columns. Cannot delete contacts.',
      inputSchema: createContactSchema,
    },
    async (input) => {
      const workspaces = await requireWorkspaceAccess(
        supabase,
        userId,
        input.account_id,
      );

      const linkedClient = input.client_id
        ? await assertClientInWorkspace(
            supabase,
            input.client_id,
            input.account_id,
          )
        : null;

      const names = resolveContactNameParts({
        firstName: input.first_name,
        lastName: input.last_name,
        fullName: input.full_name,
      });
      if (!names.fullName) {
        throw new Error('Provide first_name or full_name');
      }

      const created = await writeWithOptionalColumns<ContactRow>(
        (row) =>
          supabase
            .from('contacts')
            .insert(row)
            .select(CONTACT_SELECT_LEGACY)
            .single(),
        {
          account_id: input.account_id,
          user_id: userId,
          client_id: input.client_id ?? null,
          first_name: names.firstName,
          last_name: names.lastName,
          full_name: names.fullName,
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          company_name: input.company_name?.trim() || null,
          industry: input.industry?.trim() || null,
        },
        'create contact',
      );

      const row = created;
      if (input.client_id) {
        await linkContactToClient(supabase, {
          contactId: row.id,
          clientId: input.client_id,
          role: input.role,
          isPrimary: input.is_primary,
        });
      }

      const clients = linkedClient
        ? [
            {
              client_id: linkedClient.id,
              client_name: clientDisplayName(linkedClient),
              role: input.role?.trim() || null,
              is_primary: Boolean(input.is_primary),
            },
          ]
        : [];

      return toolJson({
        contact: mapContact(row, {
          ...workspaceExtras(workspaces, input.account_id),
          clients,
        }),
      });
    },
  );

  server.registerTool(
    'update_contact',
    {
      description:
        'Patch a CRM contact: name, email, phone, company_name, or industry. Optional client_id links the person to a CRM client. Only provided fields change. Cannot delete contacts.',
      inputSchema: updateContactSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const existing = await loadContactRow(supabase, input.id);
      const accountId = existing.account_id;
      if (
        !accountId ||
        !workspaces.some((workspace) => workspace.id === accountId)
      ) {
        throw new Error('Contact not found');
      }

      const nameTouched =
        input.first_name !== undefined ||
        input.last_name !== undefined ||
        input.full_name !== undefined;

      const names = nameTouched
        ? resolveContactNameParts({
            firstName:
              input.first_name !== undefined
                ? input.first_name
                : existing.first_name,
            lastName:
              input.last_name !== undefined
                ? input.last_name
                : existing.last_name,
            fullName:
              input.full_name !== undefined
                ? input.full_name
                : existing.full_name,
          })
        : null;

      if (names && !names.fullName) {
        throw new Error('Contact name cannot be empty');
      }

      const updates = pickDefined({
        ...(names
          ? {
              first_name: names.firstName,
              last_name: names.lastName,
              full_name: names.fullName,
            }
          : {}),
        email: input.email,
        phone: input.phone,
        company_name: input.company_name,
        industry: input.industry,
      });

      if (
        Object.keys(updates).length === 0 &&
        !input.client_id &&
        input.role === undefined
      ) {
        throw new Error('Provide at least one field to update');
      }

      let row = existing;
      if (Object.keys(updates).length > 0) {
        const updated = await writeWithOptionalColumns<ContactRow>(
          (payload) =>
            supabase
              .from('contacts')
              .update(payload)
              .eq('id', input.id)
              .eq('account_id', accountId)
              .select(CONTACT_SELECT_LEGACY)
              .maybeSingle(),
          updates,
          'update contact',
        );

        row = updated;
      }

      if (input.client_id) {
        await assertClientInWorkspace(supabase, input.client_id, accountId);
        await linkContactToClient(supabase, {
          contactId: input.id,
          clientId: input.client_id,
          role: input.role,
        });
      } else if (input.role !== undefined) {
        const links = await loadContactClientLinks(
          supabase,
          input.id,
          existing.client_id,
        );
        const primary = links.find((link) => link.is_primary) ?? links[0];
        if (primary) {
          await supabase
            .from('client_contacts')
            .update({ role: input.role })
            .eq('contact_id', input.id)
            .eq('client_id', primary.client_id);
        }
      }

      const [clients, categories] = await Promise.all([
        loadContactClientLinks(supabase, input.id, row.client_id),
        loadContactCategories(supabase, input.id),
      ]);

      return toolJson({
        contact: mapContact(row, {
          ...workspaceExtras(workspaces, accountId),
          clients,
          categories,
        }),
      });
    },
  );
};
