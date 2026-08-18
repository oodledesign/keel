import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { resolveNoteContext } from './context-resolve';
import type { SavedLinkListItem } from './types';

const LINKS_SELECT = `
  id, title, url, description, favicon_url, og_image_url, is_pinned,
  project_id, client_id, client_org_id, property_id, task_id,
  updated_at,
  projects(name),
  clients(display_name),
  properties(name),
  tasks(title)
`;

export type LinksQueryScope = {
  projectId?: string;
  jobId?: string;
  clientOrgId?: string;
  propertyId?: string;
  taskId?: string;
};

function isTableMissing(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const m = (error.message ?? '').toLowerCase();
  return (
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    m.includes('could not find') ||
    error.code === 'PGRST205' ||
    error.code === '42P01'
  );
}

type LinksBuilder = {
  select: (columns: string) => LinksBuilder;
  insert: (values: Record<string, unknown>) => LinksBuilder;
  update: (values: Record<string, unknown>) => LinksBuilder;
  delete: () => LinksBuilder;
  eq: (column: string, value: string) => LinksBuilder;
  or: (filters: string) => LinksBuilder;
  order: (column: string, options: { ascending: boolean }) => LinksBuilder;
  maybeSingle: () => Promise<{
    data: Record<string, unknown> | null;
    error: { message?: string; code?: string } | null;
  }>;
  single: () => Promise<{
    data: Record<string, unknown> | null;
    error: { message?: string; code?: string } | null;
  }>;
  then: Promise<{
    data: unknown[] | null;
    error: { message?: string; code?: string } | null;
  }>['then'];
};

export function workspaceLinksTable(client: object) {
  return (client as unknown as { from: (table: string) => LinksBuilder }).from(
    'workspace_links',
  );
}

export function mapLinkRow(row: Record<string, unknown>): SavedLinkListItem {
  const projectId = (row.project_id as string | null) ?? null;
  return {
    id: row.id as string,
    title: ((row.title as string) ?? '').trim() || 'Untitled link',
    url: (row.url as string) ?? '',
    description: (row.description as string) ?? '',
    faviconUrl: (row.favicon_url as string | null) ?? null,
    ogImageUrl: (row.og_image_url as string | null) ?? null,
    isPinned: Boolean(row.is_pinned),
    projectId,
    jobId: projectId,
    clientOrgId: (row.client_org_id as string | null) ?? null,
    clientId: (row.client_id as string | null) ?? null,
    propertyId: (row.property_id as string | null) ?? null,
    taskId: (row.task_id as string | null) ?? null,
    context: resolveNoteContext(
      row as Parameters<typeof resolveNoteContext>[0],
    ),
    updatedAt: row.updated_at as string,
  };
}

export async function loadAccountLinks(
  accountId: string,
  scope?: LinksQueryScope,
): Promise<{ links: SavedLinkListItem[]; tableAvailable: boolean }> {
  const client = getSupabaseServerClient();

  let query = workspaceLinksTable(client)
    .select(LINKS_SELECT)
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false });

  const projectOrJobId = scope?.projectId ?? scope?.jobId;
  if (projectOrJobId) {
    query = query.eq('project_id', projectOrJobId);
  }
  if (scope?.clientOrgId) {
    query = query.or(
      `client_org_id.eq.${scope.clientOrgId},client_id.eq.${scope.clientOrgId}`,
    );
  }
  if (scope?.propertyId) query = query.eq('property_id', scope.propertyId);
  if (scope?.taskId) query = query.eq('task_id', scope.taskId);

  const { data, error } = await query;

  if (error && !isTableMissing(error)) {
    throw error;
  }

  const links = ((data ?? []) as unknown[]).map((row) =>
    mapLinkRow(row as Record<string, unknown>),
  );

  return { links, tableAvailable: !error };
}
