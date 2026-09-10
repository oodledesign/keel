import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type McpWorkspace,
  assertSupabaseOk,
  loadUserWorkspaces,
} from './shared';

export type ProjectNameRow = {
  id: string;
  name?: string | null;
  title?: string | null;
  status?: string | null;
  client_id?: string | null;
  account_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  end_date?: string | null;
};

export type ClientNameRow = {
  id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  account_id?: string | null;
};

export type SearchableNamed = {
  id: string;
  name: string;
  account_id: string | null;
};

export type NameMatchConfidence = 'high' | 'medium';

export type NameMatch = SearchableNamed & {
  confidence: NameMatchConfidence;
};

export type LinkedNames = {
  project_name: string | null;
  client_name: string | null;
  workspace_name: string | null;
  workspace_slug: string | null;
};

export function uniqueIds(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

export function projectDisplayName(
  project: ProjectNameRow | null | undefined,
): string | null {
  return project?.name?.trim() || project?.title?.trim() || null;
}

export function clientDisplayName(
  client: ClientNameRow | null | undefined,
): string | null {
  const displayName = client?.display_name?.trim();
  if (displayName) {
    return displayName;
  }

  const fullName = [client?.first_name, client?.last_name]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim())
    .join(' ');

  return fullName || client?.company_name?.trim() || null;
}

export function findBestNameMatch(
  query: string | null | undefined,
  rows: SearchableNamed[],
): NameMatch | null {
  const needle = query?.trim().toLowerCase();
  if (!needle || rows.length === 0) {
    return null;
  }

  const exact = rows.filter((row) => row.name.trim().toLowerCase() === needle);
  if (exact[0]) {
    return { ...exact[0], confidence: 'high' };
  }

  if (needle.length < 3) {
    return null;
  }

  const partial = rows.filter((row) => {
    const name = row.name.trim().toLowerCase();
    return name.includes(needle) || needle.includes(name);
  });

  if (!partial[0]) {
    return null;
  }

  partial.sort((left, right) => left.name.length - right.name.length);
  return { ...partial[0], confidence: 'medium' };
}

export async function loadSearchableClients(
  supabase: SupabaseClient,
  accountIds: string[],
): Promise<Array<SearchableNamed & { row: ClientNameRow }>> {
  if (accountIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('clients')
    .select('id, display_name, first_name, last_name, company_name, account_id')
    .in('account_id', accountIds);

  assertSupabaseOk(data, error, 'load clients for search');

  return ((data ?? []) as ClientNameRow[])
    .map((row) => {
      const name = clientDisplayName(row);
      if (!name || !row.id) {
        return null;
      }

      return {
        id: row.id,
        name,
        account_id: row.account_id ?? null,
        row,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function loadSearchableProjects(
  supabase: SupabaseClient,
  accountIds: string[],
): Promise<Array<SearchableNamed & { row: ProjectNameRow }>> {
  if (accountIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, title, status, client_id, account_id')
    .in('account_id', accountIds);

  assertSupabaseOk(data, error, 'load projects for search');

  return ((data ?? []) as ProjectNameRow[])
    .map((row) => {
      const name = projectDisplayName(row);
      if (!name || !row.id) {
        return null;
      }

      return {
        id: row.id,
        name,
        account_id: row.account_id ?? null,
        row,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export function filterNamedByQuery<T extends SearchableNamed>(
  rows: T[],
  query: string,
  limit: number,
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }

  return rows
    .filter((row) => row.name.toLowerCase().includes(needle))
    .sort((left, right) => {
      const leftExact = left.name.toLowerCase() === needle ? 0 : 1;
      const rightExact = right.name.toLowerCase() === needle ? 0 : 1;
      if (leftExact !== rightExact) {
        return leftExact - rightExact;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, limit);
}

export async function loadLinkedNames(
  supabase: SupabaseClient,
  rows: Array<{
    id: string;
    project_id?: string | null;
    client_id?: string | null;
    account_id?: string | null;
  }>,
  workspaces: McpWorkspace[] = [],
): Promise<Map<string, LinkedNames>> {
  const extras = new Map<string, LinkedNames>();
  const workspacesById = new Map(
    workspaces.map((workspace) => [workspace.id, workspace]),
  );

  const projectIds = uniqueIds(rows.map((row) => row.project_id));
  const clientIds = uniqueIds(rows.map((row) => row.client_id));
  const accountIds = uniqueIds(
    rows
      .map((row) => row.account_id)
      .filter((id) => id && !workspacesById.has(id)),
  );

  const [projectsResult, clientsResult, accountsResult] = await Promise.all([
    projectIds.length > 0
      ? supabase.from('projects').select('id, name, title').in('id', projectIds)
      : Promise.resolve({ data: [], error: null }),
    clientIds.length > 0
      ? supabase
          .from('clients')
          .select('id, display_name, first_name, last_name, company_name')
          .in('id', clientIds)
      : Promise.resolve({ data: [], error: null }),
    accountIds.length > 0
      ? supabase
          .from('accounts')
          .select('id, name, slug, space_type, is_personal_account')
          .in('id', accountIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (projectsResult.error) {
    console.warn(
      '[ozer-mcp] could not load project names:',
      projectsResult.error.message,
    );
  }
  if (clientsResult.error) {
    console.warn(
      '[ozer-mcp] could not load client names:',
      clientsResult.error.message,
    );
  }
  if (accountsResult.error) {
    console.warn(
      '[ozer-mcp] could not load workspace names:',
      accountsResult.error.message,
    );
  }

  const projectsById = new Map(
    ((projectsResult.data ?? []) as ProjectNameRow[]).map((row) => [
      row.id,
      row,
    ]),
  );
  const clientsById = new Map(
    ((clientsResult.data ?? []) as ClientNameRow[]).map((row) => [row.id, row]),
  );

  for (const account of (accountsResult.data ?? []) as McpWorkspace[]) {
    if (account.id) {
      workspacesById.set(account.id, {
        id: account.id,
        name: account.name?.trim() || null,
        slug: account.slug?.trim() || null,
        space_type: account.space_type ?? null,
        is_personal_account: Boolean(account.is_personal_account),
      });
    }
  }

  for (const row of rows) {
    const workspace = row.account_id
      ? workspacesById.get(row.account_id)
      : undefined;

    extras.set(row.id, {
      project_name: projectDisplayName(
        row.project_id ? (projectsById.get(row.project_id) ?? null) : null,
      ),
      client_name: clientDisplayName(
        row.client_id ? (clientsById.get(row.client_id) ?? null) : null,
      ),
      workspace_name: workspace?.name ?? null,
      workspace_slug: workspace?.slug ?? null,
    });
  }

  return extras;
}

export async function requireWorkspaceAccess(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<McpWorkspace[]> {
  const workspaces = await loadUserWorkspaces(supabase, userId);
  if (!workspaces.some((workspace) => workspace.id === accountId)) {
    throw new Error('Access denied for this workspace');
  }

  return workspaces;
}
