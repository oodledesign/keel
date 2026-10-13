import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '~/lib/database.types';

/** Columns the Mac Assistant mirrors for its screen-recording library. */
export const RECORDER_VIDEO_FOLDER_COLUMNS =
  'id, account_id, name, parent_folder_id, created_at';

export type RecorderVideoFolder = {
  id: string;
  account_id: string;
  name: string;
  parent_folder_id: string | null;
  created_at: string;
};

export async function loadRecorderVideoFolder(
  client: SupabaseClient<Database>,
  folderId: string,
): Promise<RecorderVideoFolder | null> {
  const { data, error } = await client
    .from('video_folders')
    .select(RECORDER_VIDEO_FOLDER_COLUMNS)
    .eq('id', folderId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as RecorderVideoFolder | null) ?? null;
}

/** Strips `account_id` so responses match the shape the Mac client decodes. */
export function toRecorderFolderResponse(folder: RecorderVideoFolder) {
  return {
    id: folder.id,
    name: folder.name,
    parent_folder_id: folder.parent_folder_id,
    created_at: folder.created_at,
  };
}
