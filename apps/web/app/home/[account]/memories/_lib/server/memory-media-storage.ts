import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';

import { memoryObjectIsListed, splitMemoryStoragePath } from '../memory-media';

export async function requireUploadedMemoryObject(filePath: string) {
  const parts = splitMemoryStoragePath(filePath);
  if (!parts) {
    throw new Error('Upload did not finish. Try again.');
  }

  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin.storage
    .from(ACCOUNT_DOCS_BUCKET)
    .list(parts.folder, { search: parts.objectName, limit: 100 });

  if (error || !memoryObjectIsListed(data, parts.objectName)) {
    throw new Error('Upload did not finish. Try again.');
  }
}
