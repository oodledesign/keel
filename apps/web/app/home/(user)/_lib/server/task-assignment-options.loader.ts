import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getDbForWorkspaceTaskAssignmentOptions } from '~/home/_lib/server/workspace-scope';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import type { TaskAssignmentOption } from '../actions/task-actions';

type ProjectAssignmentRow = {
  id: string;
  name?: string | null;
  account_id?: string | null;
  accounts?: { id?: string; name?: string | null } | null;
  businesses?: { colour?: string | null } | null;
};

type AreaAssignmentRow = {
  id: string;
  name?: string | null;
  colour?: string | null;
};

type ClientAssignmentRow = {
  id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

function clientAssignmentLabel(row: ClientAssignmentRow): string {
  const dn = row.display_name?.trim();
  if (dn) return dn;
  const parts = [row.first_name, row.last_name]
    .filter((x): x is string => Boolean(x && String(x).trim()))
    .map((x) => String(x).trim())
    .join(' ');
  return parts || 'Client';
}

/** Projects + CRM clients for one workspace — tasks list shows rows linked to either. */
export const loadTaskAssignmentOptionsForWorkspace = cache(
  async (accountId: string): Promise<TaskAssignmentOption[]> => {
    const userClient = getSupabaseServerClient();
    const user = await requireUserInServerComponent();

    const readDb = await getDbForWorkspaceTaskAssignmentOptions(
      userClient,
      user.id,
      accountId,
    );

    const [projectsResult, clientsResult, accountResult] = await Promise.all([
      readDb
        .from('projects')
        .select('id, name, account_id, accounts(id, name), businesses(colour)')
        .eq('account_id', accountId)
        .not('status', 'in', '("completed","cancelled","archived")'),
      readDb
        .from('clients')
        .select('id, display_name, first_name, last_name, account_id')
        .eq('account_id', accountId),
      readDb.from('accounts').select('name').eq('id', accountId).maybeSingle(),
    ]);

    const accountName =
      (accountResult.data as { name?: string | null } | null)?.name?.trim() ||
      null;

    const projects: TaskAssignmentOption[] = (projectsResult.data ?? []).map(
      (row: ProjectAssignmentRow) => ({
        id: row.id,
        name: row.name ?? 'Untitled project',
        type: 'project' as const,
        color: row.businesses?.colour ?? null,
        accountId: row.account_id ?? row.accounts?.id ?? null,
        accountName: row.accounts?.name?.trim() || accountName,
      }),
    );

    const clients: TaskAssignmentOption[] = (clientsResult.data ?? []).map(
      (row: ClientAssignmentRow) => ({
        id: row.id,
        name: clientAssignmentLabel(row),
        type: 'client' as const,
        color: null,
        accountId,
        accountName,
      }),
    );

    return [...projects, ...clients];
  },
);

export const loadTaskAssignmentOptions = cache(
  async (): Promise<TaskAssignmentOption[]> => {
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();

    const [projectsResult, areasResult] = await Promise.all([
      client
        .from('projects')
        .select('id, name, account_id, accounts(id, name), businesses(colour)')
        .not('status', 'in', '("completed","cancelled","archived")'),
      client
        .from('areas')
        .select('id, name, colour')
        .eq('user_id', user.id),
    ]);

    const projects: TaskAssignmentOption[] = (projectsResult.data ?? []).map(
      (row: ProjectAssignmentRow) => ({
        id: row.id,
        name: row.name ?? 'Untitled project',
        type: 'project' as const,
        color: row.businesses?.colour ?? null,
        accountId: row.account_id ?? row.accounts?.id ?? null,
        accountName: row.accounts?.name?.trim() || null,
      }),
    );

    const areas: TaskAssignmentOption[] = (areasResult.data ?? []).map(
      (row: AreaAssignmentRow) => ({
        id: row.id,
        name: row.name ?? 'Untitled area',
        type: 'area' as const,
        color: row.colour ?? null,
      }),
    );

    return [...projects, ...areas];
  },
);
