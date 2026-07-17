import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { deleteSourceChunks, indexAccount, indexSource } from './indexer';
import type { BrainSourceType } from './paths';

export function queueBrainIndexSource(
  accountId: string,
  sourceType: BrainSourceType,
  sourceId: string,
) {
  const admin = getSupabaseServerAdminClient();
  void indexSource(admin, accountId, sourceType, sourceId).catch((err) => {
    console.error('[brain] indexSource failed', {
      accountId,
      sourceType,
      sourceId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export function queueBrainDeleteSource(sourceId: string) {
  const admin = getSupabaseServerAdminClient();
  void deleteSourceChunks(admin, sourceId).catch((err) => {
    console.error('[brain] deleteSourceChunks failed', {
      sourceId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export function queueBrainIndexAccount(accountId: string) {
  const admin = getSupabaseServerAdminClient();
  void indexAccount(admin, accountId).catch((err) => {
    console.error('[brain] indexAccount failed', {
      accountId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
