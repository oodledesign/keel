import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { displayTitle, parseTags, resolveNoteContext } from './context-resolve';
import type { DocListItem } from './types';

const DOCS_SELECT = `
  id, title, content, kind, doc_type, is_pinned, tags,
  job_id, project_id, client_id, client_org_id, property_id, task_id,
  mime_type, file_url, file_path, storage_path, file_size_bytes,
  updated_at,
  jobs(title),
  projects(name),
  clients(display_name),
  properties(name),
  tasks(title)
`;

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

function mapDocRow(row: Record<string, unknown>): DocListItem {
  const content = (row.content as string | null) ?? null;
  const titleRaw = (row.title as string) ?? '';
  const filePath =
    (row.file_path as string | null) ??
    (row.storage_path as string | null) ??
    null;

  return {
    id: row.id as string,
    title: displayTitle(titleRaw, content ?? ''),
    content,
    kind: ((row.kind as string) ?? 'written') as 'written' | 'uploaded',
    docType: (row.doc_type as string | null) ?? null,
    isPinned: Boolean(row.is_pinned),
    tags: parseTags(row.tags),
    projectId: (row.project_id as string | null) ?? null,
    jobId: (row.job_id as string | null) ?? null,
    clientOrgId: (row.client_org_id as string | null) ?? null,
    clientId: (row.client_id as string | null) ?? null,
    propertyId: (row.property_id as string | null) ?? null,
    taskId: (row.task_id as string | null) ?? null,
    context: resolveNoteContext(row as Parameters<typeof resolveNoteContext>[0]),
    mimeType: (row.mime_type as string | null) ?? null,
    fileUrl: (row.file_url as string | null) ?? null,
    filePath,
    fileSizeBytes:
      typeof row.file_size_bytes === 'number'
        ? row.file_size_bytes
        : row.file_size_bytes != null
          ? Number(row.file_size_bytes)
          : null,
    updatedAt: row.updated_at as string,
  };
}

export type DocsQueryScope = {
  projectId?: string;
  jobId?: string;
  clientOrgId?: string;
  propertyId?: string;
  taskId?: string;
};

export async function loadAccountDocs(
  accountId: string,
  scope?: DocsQueryScope,
): Promise<{ docs: DocListItem[]; tableAvailable: boolean }> {
  const client = getSupabaseServerClient();

  let query = client
    .from('docs')
    .select(DOCS_SELECT)
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false });

  if (scope?.projectId) query = query.eq('project_id', scope.projectId);
  if (scope?.jobId) query = query.eq('job_id', scope.jobId);
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

  const docs = (data ?? []).map((row) =>
    mapDocRow(row as Record<string, unknown>),
  );

  return { docs, tableAvailable: !error };
}

export async function loadAccountDocById(
  accountId: string,
  docId: string,
): Promise<DocListItem | null> {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('docs')
    .select(DOCS_SELECT)
    .eq('account_id', accountId)
    .eq('id', docId)
    .maybeSingle();

  if (error && !isTableMissing(error)) throw error;
  if (!data) return null;
  return mapDocRow(data as Record<string, unknown>);
}
