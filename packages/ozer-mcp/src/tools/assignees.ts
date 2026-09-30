import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import {
  type ContactNameRow,
  contactDisplayName,
  requireWorkspaceAccess,
  uniqueIds,
} from './lookup';
import { assertSupabaseOk, toolJson } from './shared';
import type { OzerMcpToolRegistrar } from './types';

export type TaskAssigneeKind = 'member' | 'contact';

export type TaskAssigneeOption = {
  kind: TaskAssigneeKind;
  /** auth user id for members, contacts.id for contacts. */
  id: string;
  name: string;
  email: string | null;
};

export type TaskAssigneeName = {
  assignee_kind: TaskAssigneeKind;
  assignee_name: string | null;
};

const MEMBER_ASSIGNEE_DESCRIPTION =
  'Team member (auth user id from list_task_assignees, kind=member) responsible for the task. Must belong to the task’s workspace. On update, pass null to reset to the authenticated user. Do not combine with assignee_contact_id.';
const CONTACT_ASSIGNEE_DESCRIPTION =
  'CRM contact id (from list_task_assignees, kind=contact) responsible for the task. Must belong to the task’s workspace and, when the task has a client, be linked to that client. The authenticated user stays the internal owner. On update, pass null to clear the contact. Do not combine with assignee_user_id.';

/** Shared assignee inputs for create/update task schemas. */
export const createAssigneeFields = {
  assignee_user_id: z
    .string()
    .uuid()
    .optional()
    .describe(MEMBER_ASSIGNEE_DESCRIPTION),
  assignee_contact_id: z
    .string()
    .uuid()
    .optional()
    .describe(CONTACT_ASSIGNEE_DESCRIPTION),
};

export const updateAssigneeFields = {
  assignee_user_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .describe(MEMBER_ASSIGNEE_DESCRIPTION),
  assignee_contact_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .describe(CONTACT_ASSIGNEE_DESCRIPTION),
};

const listTaskAssigneesSchema = z.object({
  account_id: z.string().uuid().describe('Workspace from list_workspaces.'),
  client_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      'Limit contacts to those linked to this CRM client. Team members are always included. Pass the task’s client when assigning a client task.',
    ),
  q: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .describe('Filter by name or email.'),
  kind: z
    .enum(['all', 'member', 'contact'])
    .optional()
    .default('all')
    .describe('all (default), member (team only), or contact (CRM only).'),
  limit: z.number().int().min(1).max(200).optional().default(80),
});

type MembershipRow = { user_id: string };
type AccountRow = {
  id: string;
  name?: string | null;
  email?: string | null;
};

function matchesQuery(option: TaskAssigneeOption, q: string | undefined) {
  if (!q) {
    return true;
  }

  const needle = q.toLowerCase();
  return (
    option.name.toLowerCase().includes(needle) ||
    Boolean(option.email?.toLowerCase().includes(needle))
  );
}

async function loadMemberOptions(
  supabase: SupabaseClient,
  accountId: string,
): Promise<TaskAssigneeOption[]> {
  const memberships = await supabase
    .from('accounts_memberships')
    .select('user_id')
    .eq('account_id', accountId);

  assertSupabaseOk(memberships.data, memberships.error, 'list team members');

  const userIds = uniqueIds(
    ((memberships.data ?? []) as MembershipRow[]).map((row) => row.user_id),
  );
  if (userIds.length === 0) {
    return [];
  }

  const accounts = await supabase
    .from('accounts')
    .select('id, name, email')
    .in('id', userIds);

  assertSupabaseOk(accounts.data, accounts.error, 'load team member profiles');

  const byId = new Map(
    ((accounts.data ?? []) as AccountRow[]).map((row) => [row.id, row]),
  );

  return userIds.map((id) => {
    const account = byId.get(id);
    const email = account?.email?.trim() || null;
    return {
      kind: 'member' as const,
      id,
      name: account?.name?.trim() || email || id.slice(0, 8),
      email,
    };
  });
}

/** Contact ids linked to a client (junction table plus legacy contacts.client_id). */
async function loadClientContactIds(
  supabase: SupabaseClient,
  clientId: string,
): Promise<string[]> {
  const [links, legacy] = await Promise.all([
    supabase
      .from('client_contacts')
      .select('contact_id')
      .eq('client_id', clientId),
    supabase.from('contacts').select('id').eq('client_id', clientId),
  ]);

  assertSupabaseOk(links.data, links.error, 'list client contacts');
  // contacts.client_id is legacy; ignore lookup failures on older schemas.
  const legacyRows = legacy.error
    ? []
    : ((legacy.data ?? []) as Array<{ id: string }>);

  return uniqueIds([
    ...((links.data ?? []) as Array<{ contact_id: string }>).map(
      (row) => row.contact_id,
    ),
    ...legacyRows.map((row) => row.id),
  ]);
}

async function loadContactOptions(
  supabase: SupabaseClient,
  accountId: string,
  clientId: string | undefined,
  limit: number,
): Promise<TaskAssigneeOption[]> {
  let query = supabase
    .from('contacts')
    .select('id, full_name, first_name, last_name, email, company_name')
    .eq('account_id', accountId)
    .order('full_name', { ascending: true })
    .limit(limit);

  if (clientId) {
    const contactIds = await loadClientContactIds(supabase, clientId);
    if (contactIds.length === 0) {
      return [];
    }
    query = query.in('id', contactIds);
  }

  const { data, error } = await query;
  assertSupabaseOk(data, error, 'list contacts');

  return ((data ?? []) as ContactNameRow[]).map((row) => ({
    kind: 'contact' as const,
    id: row.id,
    name: contactDisplayName(row) ?? row.id.slice(0, 8),
    email: row.email?.trim() || null,
  }));
}

export async function loadTaskAssigneeOptions(
  supabase: SupabaseClient,
  input: {
    accountId: string;
    clientId?: string;
    q?: string;
    kind?: 'all' | 'member' | 'contact';
    limit?: number;
  },
): Promise<TaskAssigneeOption[]> {
  const kind = input.kind ?? 'all';
  const limit = input.limit ?? 80;

  const [members, contacts] = await Promise.all([
    kind === 'contact'
      ? Promise.resolve([])
      : loadMemberOptions(supabase, input.accountId),
    kind === 'member'
      ? Promise.resolve([])
      : loadContactOptions(supabase, input.accountId, input.clientId, limit),
  ]);

  return [...members, ...contacts]
    .filter((option) => matchesQuery(option, input.q))
    .slice(0, limit);
}

export type TaskAssigneePatch = {
  /** Set only when the internal owner (tasks.user_id) must change. */
  user_id?: string;
  /** Set to a contact id or null to clear; omitted when unchanged. */
  assignee_contact_id?: string | null;
};

/**
 * Validate an assignee request against the task's workspace/client and return
 * the column changes to apply. Mirrors the web app's task assignment rules:
 * a contact is the responsible party while the acting user stays the internal
 * owner; a team member replaces the owner and clears any contact.
 * Returns an empty patch when neither field was provided.
 */
export async function resolveTaskAssigneePatch(
  supabase: SupabaseClient,
  userId: string,
  input: {
    assignee_user_id?: string | null;
    assignee_contact_id?: string | null;
  },
  task: { accountId: string | null; clientId: string | null },
): Promise<TaskAssigneePatch> {
  const memberId = input.assignee_user_id;
  const contactId = input.assignee_contact_id;

  if (memberId === undefined && contactId === undefined) {
    return {};
  }

  if (memberId && contactId) {
    throw new Error(
      'Provide either assignee_user_id or assignee_contact_id, not both.',
    );
  }

  if (contactId) {
    await assertContactAssignable(supabase, contactId, task);
    return { assignee_contact_id: contactId, user_id: userId };
  }

  if (memberId) {
    if (memberId !== userId) {
      await assertMemberAssignable(supabase, memberId, task.accountId);
    }
    return { assignee_contact_id: null, user_id: memberId };
  }

  if (memberId === null) {
    // Reset to the acting user and clear any contact assignee (also covers
    // both fields being null).
    return { assignee_contact_id: null, user_id: userId };
  }

  // Only assignee_contact_id is null: clear the contact, keep the owner.
  return { assignee_contact_id: null };
}

async function assertMemberAssignable(
  supabase: SupabaseClient,
  memberId: string,
  accountId: string | null,
) {
  if (!accountId) {
    throw new Error(
      'Assigning to another team member requires a workspace task. Set project_id or client_id first.',
    );
  }

  const { data, error } = await supabase
    .from('accounts_memberships')
    .select('user_id')
    .eq('account_id', accountId)
    .eq('user_id', memberId)
    .maybeSingle();

  assertSupabaseOk(data, error, 'verify team member');

  if (!data) {
    throw new Error(
      'Assignee is not a member of this task’s workspace. Use list_task_assignees to find valid members.',
    );
  }
}

async function assertContactAssignable(
  supabase: SupabaseClient,
  contactId: string,
  task: { accountId: string | null; clientId: string | null },
) {
  if (!task.accountId) {
    throw new Error(
      'Assigning to a contact requires a workspace task. Set project_id or client_id first.',
    );
  }

  const { data, error } = await supabase
    .from('contacts')
    .select('id, account_id, client_id')
    .eq('id', contactId)
    .maybeSingle();

  assertSupabaseOk(data, error, 'verify contact');

  const contact = data as {
    id: string;
    account_id?: string | null;
    client_id?: string | null;
  } | null;

  if (!contact || contact.account_id !== task.accountId) {
    throw new Error(
      'Contact not found in this task’s workspace. Use list_task_assignees to find valid contacts.',
    );
  }

  if (!task.clientId || contact.client_id === task.clientId) {
    return;
  }

  const link = await supabase
    .from('client_contacts')
    .select('contact_id')
    .eq('client_id', task.clientId)
    .eq('contact_id', contactId)
    .maybeSingle();

  assertSupabaseOk(link.data, link.error, 'verify client contact');

  if (!link.data) {
    throw new Error(
      'Contact is not linked to this task’s client. Use list_task_assignees with client_id to see the client’s contacts.',
    );
  }
}

/** Batch-resolve display names for the assignee on each task row. */
export async function loadTaskAssigneeNames(
  supabase: SupabaseClient,
  rows: Array<{
    id: string;
    user_id?: string | null;
    assignee_contact_id?: string | null;
  }>,
): Promise<Map<string, TaskAssigneeName>> {
  const result = new Map<string, TaskAssigneeName>();

  const contactIds = uniqueIds(rows.map((row) => row.assignee_contact_id));
  const memberIds = uniqueIds(
    rows.filter((row) => !row.assignee_contact_id).map((row) => row.user_id),
  );

  const [contacts, members] = await Promise.all([
    contactIds.length > 0
      ? supabase
          .from('contacts')
          .select('id, full_name, first_name, last_name, email, company_name')
          .in('id', contactIds)
      : Promise.resolve({ data: [], error: null }),
    memberIds.length > 0
      ? supabase.from('accounts').select('id, name, email').in('id', memberIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (contacts.error) {
    console.warn(
      '[ozer-mcp] could not load assignee contacts:',
      contacts.error.message,
    );
  }
  if (members.error) {
    console.warn(
      '[ozer-mcp] could not load assignee members:',
      members.error.message,
    );
  }

  const contactsById = new Map(
    ((contacts.data ?? []) as ContactNameRow[]).map((row) => [row.id, row]),
  );
  const membersById = new Map(
    ((members.data ?? []) as AccountRow[]).map((row) => [row.id, row]),
  );

  for (const row of rows) {
    if (row.assignee_contact_id) {
      result.set(row.id, {
        assignee_kind: 'contact',
        assignee_name: contactDisplayName(
          contactsById.get(row.assignee_contact_id) ?? null,
        ),
      });
    } else if (row.user_id) {
      const member = membersById.get(row.user_id);
      result.set(row.id, {
        assignee_kind: 'member',
        assignee_name: member?.name?.trim() || member?.email?.trim() || null,
      });
    }
  }

  return result;
}

export const registerAssigneeTools: OzerMcpToolRegistrar = (
  server,
  context,
) => {
  const { supabase, userId } = context;

  server.registerTool(
    'list_task_assignees',
    {
      description:
        'List who a task can be assigned to in a workspace: team members (kind=member, id is the user id for assignee_user_id) and CRM contacts (kind=contact, id is the contact id for assignee_contact_id). Pass client_id to limit contacts to a specific client’s contacts. Use the ids with create_task, update_task, create_subtask, or update_subtask.',
      inputSchema: listTaskAssigneesSchema,
    },
    async (input) => {
      await requireWorkspaceAccess(supabase, userId, input.account_id);

      const assignees = await loadTaskAssigneeOptions(supabase, {
        accountId: input.account_id,
        clientId: input.client_id,
        q: input.q,
        kind: input.kind,
        limit: input.limit,
      });

      return toolJson({
        assignees,
        count: assignees.length,
        current_user_id: userId,
        hint: 'Pass member ids as assignee_user_id and contact ids as assignee_contact_id. Only one may be set per task.',
      });
    },
  );
};
