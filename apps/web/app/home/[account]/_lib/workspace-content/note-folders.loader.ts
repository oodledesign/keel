import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type NoteFolderListItem = {
  id: string;
  name: string;
  parentFolderId: string | null;
  sortOrder: number;
  createdAt: string;
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

export async function loadAccountNoteFolders(
  accountId: string,
): Promise<{ folders: NoteFolderListItem[]; tableAvailable: boolean }> {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('note_folders')
    .select('id, name, parent_folder_id, sort_order, created_at')
    .eq('account_id', accountId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error && !isTableMissing(error)) {
    throw error;
  }

  if (error) {
    return { folders: [], tableAvailable: false };
  }

  return {
    tableAvailable: true,
    folders: (data ?? []).map((row) => ({
      id: row.id as string,
      name: (row.name as string) ?? 'Untitled',
      parentFolderId: (row.parent_folder_id as string | null) ?? null,
      sortOrder: (row.sort_order as number | null) ?? 0,
      createdAt: row.created_at as string,
    })),
  };
}
